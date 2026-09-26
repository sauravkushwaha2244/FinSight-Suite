from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel, Field
from app.auth import get_current_user, require_admin, require_authenticated
from app.supabase_client import get_service_client
from app.optimizer import run_optimization, simulate_reallocation
import app.db as db
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/budget", tags=["Budget"])

# ── Canonical demo data for ABC Technologies ──────────────────────────────────
DEMO_CATEGORIES = [
    {"id": 1, "name": "Marketing", "current_budget": 200000, "min_spend": 50000, "max_spend": 500000, "is_locked": False, "category_name": "Marketing"},
    {"id": 2, "name": "Engineering", "current_budget": 350000, "min_spend": 100000, "max_spend": 800000, "is_locked": False, "category_name": "Engineering"},
    {"id": 3, "name": "Sales", "current_budget": 220000, "min_spend": 80000, "max_spend": 600000, "is_locked": False, "category_name": "Sales"},
    {"id": 4, "name": "Operations", "current_budget": 180000, "min_spend": 60000, "max_spend": 400000, "is_locked": True, "category_name": "Operations"},
    {"id": 5, "name": "HR", "current_budget": 120000, "min_spend": 40000, "max_spend": 300000, "is_locked": False, "category_name": "HR"},
    {"id": 6, "name": "Legal", "current_budget": 80000, "min_spend": 20000, "max_spend": 200000, "is_locked": True, "category_name": "Legal"},
    {"id": 7, "name": "R&D", "current_budget": 250000, "min_spend": 80000, "max_spend": 700000, "is_locked": False, "category_name": "R&D"},
    {"id": 8, "name": "Infrastructure", "current_budget": 150000, "min_spend": 50000, "max_spend": 350000, "is_locked": False, "category_name": "Infrastructure"},
    {"id": 9, "name": "Customer Support", "current_budget": 90000, "min_spend": 30000, "max_spend": 250000, "is_locked": False, "category_name": "Customer Support"},
    {"id": 10, "name": "Administration", "current_budget": 60000, "min_spend": 20000, "max_spend": 150000, "is_locked": False, "category_name": "Administration"},
]

DEMO_PRIORITIES = [
    {"priority_name": "Growth", "weight": 30, "description": "Market share expansion and customer acquisition"},
    {"priority_name": "Profitability", "weight": 25, "description": "Gross margin optimization and unit economics"},
    {"priority_name": "Innovation", "weight": 20, "description": "Core product development and AI engineering capabilities"},
    {"priority_name": "Efficiency", "weight": 15, "description": "Operational streamlining and automation"},
    {"priority_name": "Compliance", "weight": 10, "description": "Regulatory compliance, data security, and governance"},
]


# ── Pydantic schemas ─────────────────────────────────────────────────────────
class Constraint(BaseModel):
    category: Optional[str] = None
    category_id: Optional[int] = None
    exact: float


class OptimizeRequest(BaseModel):
    total_budget: float
    period: Optional[str] = "Q4 2026"
    scenario_type: Optional[str] = None
    scenario: Optional[str] = None
    locked_categories: Optional[dict] = None
    constraints: Optional[List[Constraint]] = []


class PriorityItem(BaseModel):
    id: Optional[int] = None
    priority_name: str
    weight: float
    description: Optional[str] = ""


class PrioritiesRequest(BaseModel):
    period: Optional[str] = "Q4 2026"
    priorities: List[PriorityItem]


class SimulateRequest(BaseModel):
    org_id: Optional[str] = None
    proposed_change: dict  # {"from_category": "Marketing", "to_category": "Reserve", "amount": 12000}
    scenario: str = "balanced"


class SimulateResponse(BaseModel):
    current_score: float
    projected_score: float
    score_delta: float
    current_allocation: dict
    projected_allocation: dict
    feasible: bool
    violation_reason: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────────────────
def _demo_optimize(total_budget: float, scenario_type: str, constraints: list):
    """Deterministic optimization fallback that calculates recommendations across all 10 categories."""
    try:
        return run_optimization(
            org_id="org-abc-tech",
            total_budget=total_budget,
            scenario_type=scenario_type,
            constraints=constraints,
        )
    except Exception as opt_err:
        logger.warning(f"run_optimization fallback in _demo_optimize failed: {opt_err}")

    db_cats = db.get_categories("org-abc-tech")
    categories = db_cats if db_cats else DEMO_CATEGORIES

    # Partition locked vs unlocked
    constraint_map = {}
    for c in constraints:
        c_cat = c.get("category") if isinstance(c, dict) else getattr(c, "category", None)
        c_cat_id = c.get("category_id") if isinstance(c, dict) else getattr(c, "category_id", None)
        c_exact = c.get("exact") if isinstance(c, dict) else getattr(c, "exact", 0.0)
        if c_cat:
            constraint_map[str(c_cat).strip().lower()] = float(c_exact)
        if c_cat_id is not None:
            constraint_map[f"id_{c_cat_id}"] = float(c_exact)

    locked_sum = 0.0
    unlocked_cats = []
    result_map = {}

    for cat in categories:
        name = cat["name"]
        cat_id = cat.get("id")
        key = str(name).strip().lower()
        if key in constraint_map:
            exact = constraint_map[key]
            result_map[name] = exact
            locked_sum += exact
        elif f"id_{cat_id}" in constraint_map:
            exact = constraint_map[f"id_{cat_id}"]
            result_map[name] = exact
            locked_sum += exact
        else:
            unlocked_cats.append(cat)

    remaining_budget = max(0.0, total_budget - locked_sum)
    total_unlocked_curr = sum(float(c["current_budget"]) for c in unlocked_cats) or 1.0

    multiplier_map = {
        "conservative": {"Marketing": 0.95, "Engineering": 1.02, "Sales": 1.00, "Operations": 1.00, "HR": 0.98, "Legal": 1.00, "R&D": 1.02, "Infrastructure": 1.02, "Customer Support": 1.01, "Administration": 0.95},
        "balanced": {"Marketing": 1.15, "Engineering": 1.12, "Sales": 1.10, "Operations": 1.00, "HR": 0.95, "Legal": 1.00, "R&D": 1.14, "Infrastructure": 1.05, "Customer Support": 1.08, "Administration": 0.92},
        "aggressive": {"Marketing": 1.35, "Engineering": 1.25, "Sales": 1.20, "Operations": 1.00, "HR": 0.90, "Legal": 1.00, "R&D": 1.30, "Infrastructure": 1.10, "Customer Support": 1.12, "Administration": 0.85},
    }
    factors = multiplier_map.get(scenario_type, multiplier_map["balanced"])

    # Compute preliminary allocations for unlocked
    weights = {}
    for cat in unlocked_cats:
        name = cat["name"]
        curr = float(cat["current_budget"])
        mult = factors.get(name, 1.05)
        weights[name] = curr * mult

    total_w = sum(weights.values()) or 1.0
    for name, w in weights.items():
        result_map[name] = round(remaining_budget * (w / total_w), 2)

    # Exact sum residual correction
    allocated_sum = sum(result_map.values())
    residual = round(total_budget - allocated_sum, 2)
    if residual != 0 and unlocked_cats:
        largest_unlocked = max(unlocked_cats, key=lambda c: float(c["current_budget"]))["name"]
        result_map[largest_unlocked] = round(result_map[largest_unlocked] + residual, 2)

    spend_records = db.get_historical_spend("org-abc-tech")
    from app.optimizer import compute_historical_roi
    metrics = compute_historical_roi(spend_records, categories)

    result = []
    for cat in categories:
        name = cat["name"]
        current = float(cat["current_budget"])
        recommended = result_map.get(name, current)
        change = 0.0 if current == 0 else ((recommended - current) / current) * 100
        roi_meta = metrics.get(name, {})
        is_locked = str(name).strip().lower() in constraint_map or f"id_{cat.get('id')}" in constraint_map
        result.append({
            "category_id": cat.get("id"),
            "category_name": name,
            "category": name,
            "current_budget": current,
            "recommended_budget": recommended,
            "change_percent": round(change, 1),
            "historical_roi": roi_meta.get("historical_roi", 1.25),
            "historical_spend": roi_meta.get("historical_spend", 0),
            "is_locked": is_locked,
            "projected_impact": "Locked Target" if is_locked else ("High ROI growth" if factors.get(name, 1.0) > 1.1 else "Stabilized"),
            "confidence": 0.95,
            "scenario_type": scenario_type,
        })
    return result


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/optimize", summary="Run budget optimization")
def optimize_budget(
    request: OptimizeRequest,
    user: dict = Depends(get_current_user),
):
    """
    Run SLSQP constrained budget optimization across categories.

    - **scenario_type**: `conservative` | `balanced` | `aggressive`
    - **constraints**: Optional exact locked values per category
    - Returns recommendations with confidence scores and projected impact
    """
    org_id = user.get("org_id") or "org-abc-tech"
    supabase = get_service_client()

    # Standardize scenario parameter (support both scenario_type and scenario)
    scenario_type = (request.scenario_type or request.scenario or "balanced").lower().strip()
    if scenario_type not in ["conservative", "balanced", "aggressive"]:
        scenario_type = "balanced"

    # Merge locked_categories and constraints into unified constraints list
    constraints_raw = [c.model_dump() for c in (request.constraints or [])]
    if request.locked_categories:
        for cat_name, val in request.locked_categories.items():
            if val is not None:
                constraints_raw.append({"category": cat_name, "exact": float(val)})

    try:
        recommendations = run_optimization(
            org_id=org_id,
            total_budget=request.total_budget,
            period=request.period or "Q4 2026",
            scenario_type=scenario_type,
            supabase_client=supabase,
            constraints=constraints_raw,
            locked_categories=request.locked_categories,
        )

        if not recommendations:
            recommendations = _demo_optimize(request.total_budget, scenario_type, constraints_raw)

        # Persist recommendations to SQLite database
        try:
            db.save_recommendations(
                recommendations,
                org_id=org_id,
                period=request.period or "Q4 2026",
                scenario_type=scenario_type,
            )
        except Exception as db_err:
            logger.warning(f"Could not persist recommendations to SQLite: {db_err}")

        # Persist to Supabase if available
        if supabase:
            try:
                records = [{
                    "org_id": org_id,
                    "period": request.period or "Q4 2026",
                    "category_id": rec.get("category_id"),
                    "category_name": rec.get("category_name"),
                    "current_budget": rec.get("current_budget"),
                    "recommended_budget": rec.get("recommended_budget"),
                    "projected_impact": rec.get("projected_impact"),
                    "confidence": rec.get("confidence", 0.94),
                    "scenario_type": scenario_type,
                } for rec in recommendations]
                supabase.table("budget_recommendations").insert(records).execute()
            except Exception as save_err:
                logger.warning(f"Could not persist recommendations to Supabase: {save_err}")

        return {
            "mode": "live",
            "org_id": org_id,
            "period": request.period or "Q4 2026",
            "scenario_type": scenario_type,
            "total_budget": request.total_budget,
            "locked_categories": request.locked_categories or {},
            "recommendations": recommendations,
        }
    except Exception as e:
        logger.exception(f"optimize_budget failed: {e}")
        recommendations = _demo_optimize(request.total_budget, scenario_type, constraints_raw)
        return {
            "mode": "demo_fallback",
            "error": str(e),
            "org_id": org_id,
            "period": request.period or "Q4 2026",
            "scenario_type": scenario_type,
            "total_budget": request.total_budget,
            "locked_categories": request.locked_categories or {},
            "recommendations": recommendations,
        }


@router.get("/recommendations", summary="Fetch saved budget recommendations")
def get_recommendations(
    period: Optional[str] = None,
    scenario_type: Optional[str] = None,
    user: dict = Depends(require_authenticated),
):
    org_id = user.get("org_id") or "org-abc-tech"
    supabase = get_service_client()
    recs = []

    # 1. Try Supabase if configured
    if supabase:
        try:
            query = supabase.table("budget_recommendations").select("*").eq("org_id", org_id)
            if period:
                query = query.eq("period", period)
            if scenario_type:
                query = query.eq("scenario_type", scenario_type)
            res = query.order("created_at", desc=True).limit(50).execute()
            if res.data:
                recs = res.data
        except Exception as e:
            logger.debug(f"Supabase recommendations fetch skipped: {e}")

    # 2. Try SQLite local database
    if not recs:
        try:
            recs = db.get_recommendations(org_id, period=period, scenario_type=scenario_type)
        except Exception as e:
            logger.warning(f"SQLite recommendations fetch error: {e}")

    # 3. Fallback to fresh optimizer run on canonical budget (1,700,000)
    if not recs:
        recs = run_optimization(
            org_id=org_id,
            total_budget=1_700_000.0,
            period=period or "Q4 2026",
            scenario_type=scenario_type or "balanced",
            supabase_client=supabase,
        )

    # Each optimization creates a new recommendation row. Keep only the
    # newest row per category so dashboard totals never count history twice.
    latest_by_category = {}
    for rec in recs:
        category_key = (
            rec.get("category_id")
            or rec.get("category_name")
            or rec.get("category")
            or rec.get("name")
        )
        if category_key is not None and category_key not in latest_by_category:
            latest_by_category[category_key] = rec
    recs = list(latest_by_category.values())

    # 4. Enrich recommendations with live category data and historical ROI
    try:
        categories = db.get_categories(org_id)
        cat_map = {str(c["name"]).strip().lower(): c for c in categories}
        cat_id_map = {c["id"]: c for c in categories if c.get("id")}
        spend_records = db.get_historical_spend(org_id)
        from app.optimizer import compute_historical_roi
        metrics = compute_historical_roi(spend_records, categories)

        for r in recs:
            cname = r.get("category_name") or r.get("category") or r.get("name")
            r["category"] = cname
            r["category_name"] = cname

            # Always sync live current_budget from budget_categories table
            cat_obj = cat_map.get(str(cname).strip().lower()) or cat_id_map.get(r.get("category_id"))
            if cat_obj:
                r["current_budget"] = float(cat_obj["current_budget"])
                r["min_spend"] = float(cat_obj.get("min_spend", 0))
                r["max_spend"] = float(cat_obj.get("max_spend", 0))
                if "is_locked" not in r:
                    r["is_locked"] = bool(cat_obj.get("is_locked", False))

            if cname in metrics:
                r["historical_roi"] = metrics[cname]["historical_roi"]
                r["historical_spend"] = metrics[cname]["historical_spend"]
                r["historical_return"] = metrics[cname]["historical_return"]

            curr = float(r.get("current_budget", 0))
            rec_b = float(r.get("recommended_budget", 0))
            r["change_amount"] = round(rec_b - curr, 2)
            r["change_percent"] = round(((rec_b - curr) / curr) * 100, 1) if curr > 0 else 0.0
    except Exception as enrich_err:
        logger.warning(f"Could not enrich recommendations with historical ROI: {enrich_err}")

    return recs



@router.post("/priorities", summary="Update business priority weights")
def set_priorities(
    request: PrioritiesRequest,
    user: dict = Depends(require_admin),
):
    """
    Set business-priority weights that guide the optimization objective.
    Weights must sum to approximately 100.
    """
    org_id = user.get("org_id") or "demo-org"
    total_weight = sum(p.weight for p in request.priorities)
    if not (99.0 <= total_weight <= 101.0):
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"Weights must sum to approximately 100. Current sum: {total_weight:.2f}",
                "current_sum": round(total_weight, 2),
            },
        )

    supabase = get_service_client()
    if not supabase:
        saved = db.set_priorities([p.model_dump() for p in request.priorities], org_id=org_id, period=request.period or "Q4 2026")
        return {
            "mode": "live",
            "org_id": org_id,
            "period": request.period,
            "priorities": saved,
        }

    records = []
    for p in request.priorities:
        records.append({
            "org_id": org_id,
            "period": request.period,
            "priority_name": p.priority_name,
            "weight": p.weight,
            "description": p.description or "",
        })

    try:
        res = supabase.table("business_priorities").upsert(
            records, on_conflict="org_id,period,priority_name"
        ).execute()
        return {"mode": "live", "org_id": org_id, "period": request.period, "priorities": res.data}
    except Exception as e:
        logger.warning(f"Could not persist priorities to Supabase, falling back to local DB: {e}")
        saved = db.set_priorities([p.model_dump() for p in request.priorities], org_id=org_id, period=request.period or "Q4 2026")
        return {
            "mode": "live",
            "org_id": org_id,
            "period": request.period,
            "priorities": saved,
        }


class CategoryInput(BaseModel):
    id: Optional[int] = None
    name: str
    current_budget: float = 0.0
    min_spend: float = 0.0
    max_spend: float = 0.0
    is_locked: Optional[bool] = False
    description: Optional[str] = ""


class CategoriesPayload(BaseModel):
    categories: List[CategoryInput]


class ApplyAllocationsPayload(BaseModel):
    allocations: Optional[dict] = None
    recommendations: Optional[list] = None


@router.get("/categories", summary="List budget categories")
def get_categories(user: dict = Depends(get_current_user)):
    org_id = user.get("org_id") or "demo-org"
    supabase = get_service_client()
    try:
        if not supabase:
            return db.get_categories(org_id)
        res = supabase.table("budget_categories").select("*").eq("org_id", org_id).order("name").execute()
        return res.data if res.data else db.get_categories(org_id)
    except Exception:
        return db.get_categories(org_id)


@router.post("/categories", summary="Save or update budget categories")
def save_categories(
    payload: CategoriesPayload,
    user: dict = Depends(get_current_user),
):
    org_id = user.get("org_id") or "org-abc-tech"
    cats_data = [c.model_dump() for c in payload.categories]
    updated = db.save_categories(cats_data, org_id=org_id)
    return {"status": "success", "categories": updated}


@router.post("/apply", summary="Apply approved budget recommendations as active current budgets")
def apply_budget(
    payload: ApplyAllocationsPayload,
    user: dict = Depends(get_current_user),
):
    org_id = user.get("org_id") or "org-abc-tech"
    alloc_map = {}
    if payload.allocations:
        alloc_map.update(payload.allocations)
    if payload.recommendations:
        for r in payload.recommendations:
            cname = r.get("category_name") or r.get("category") or r.get("name")
            rec_b = r.get("recommended_budget")
            if cname and rec_b is not None:
                alloc_map[cname] = float(rec_b)

    updated = db.apply_budget_allocations(alloc_map, org_id=org_id)
    return {
        "status": "success",
        "message": f"Successfully applied budget allocations across {len(alloc_map)} categories",
        "categories": updated,
    }


@router.get("/priorities", summary="List business priorities")
def get_priorities(period: Optional[str] = "Q4 2026", user: dict = Depends(get_current_user)):
    org_id = user.get("org_id") or "demo-org"
    supabase = get_service_client()
    try:
        if not supabase:
            return db.get_priorities(org_id, period=period or "Q4 2026")
        res = (
            supabase.table("business_priorities")
            .select("*")
            .eq("org_id", org_id)
            .eq("period", period)
            .order("weight", desc=True)
            .execute()
        )
        return res.data if res.data else db.get_priorities(org_id, period=period or "Q4 2026")
    except Exception:
        return db.get_priorities(org_id, period=period or "Q4 2026")


@router.post(
    "/simulate",
    response_model=SimulateResponse,
    summary="Simulate proposed budget reallocation impact on risk and objective",
)
def simulate_budget_reallocation(
    request: SimulateRequest,
    user: dict = Depends(get_current_user),
):
    """
    Pure function evaluation of proposed reallocation against optimizer constraints
    and risk scorer without database writes.
    """
    org_id = request.org_id or user.get("org_id") or "demo-org"
    supabase = get_service_client()
    return simulate_reallocation(
        org_id=org_id,
        proposed_change=request.proposed_change,
        scenario_type=request.scenario or "balanced",
        supabase_client=supabase,
    )


@router.get("/historical-spend", summary="Fetch historical 24 months spending data")
def get_historical_spend(
    category_id: Optional[int] = None,
    period: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    org_id = user.get("org_id") or "org-abc-tech"
    return db.get_historical_spend(org_id=org_id, category_id=category_id, period=period)
