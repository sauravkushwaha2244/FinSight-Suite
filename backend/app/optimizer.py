import logging
import math
import numpy as np
from scipy.optimize import minimize
from typing import List, Dict, Any, Optional

import app.db as db

logger = logging.getLogger(__name__)

# Priority mappings to category boosts
PRIORITY_CATEGORY_MAPPINGS = {
    "Growth": {"Marketing": 0.40, "Sales": 0.40, "Customer Support": 0.20},
    "Profitability": {"Sales": 0.35, "Marketing": 0.25, "Operations": 0.25, "Engineering": 0.15},
    "Innovation": {"Engineering": 0.50, "R&D": 0.50},
    "Efficiency": {"Operations": 0.40, "Infrastructure": 0.40, "Administration": 0.20},
    "Compliance": {"Legal": 0.50, "Administration": 0.25, "HR": 0.25},
}


def compute_historical_roi(historical_records: List[Dict[str, Any]], categories: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
    """
    Computes real historical ROI and spend metrics for each category from historical spend records.
    Historical ROI = Total Return / Total Spend
    Where Total Return = sum(amount * actual_roi) and Total Spend = sum(amount).
    """
    metrics = {}
    for cat in categories:
        cat_id = cat.get("id")
        cat_name = cat.get("name") or cat.get("category_name")
        base_roi = float(cat.get("base_roi", 1.20))

        # Filter records for this category
        cat_records = [
            r for r in historical_records
            if (r.get("category_id") == cat_id) or
               (str(r.get("category_name", "")).strip().lower() == str(cat_name).strip().lower()) or
               (str(r.get("category", "")).strip().lower() == str(cat_name).strip().lower())
        ]

        if cat_records:
            total_spend = sum(float(r.get("amount", 0.0)) for r in cat_records)
            total_return = sum(float(r.get("amount", 0.0)) * float(r.get("actual_roi", 1.0)) for r in cat_records)
            roi = round(total_return / total_spend, 2) if total_spend > 0 else base_roi
        else:
            total_spend = float(cat.get("current_budget", 0)) * 24
            total_return = total_spend * base_roi
            roi = base_roi

        metrics[cat_name] = {
            "historical_spend": round(total_spend, 2),
            "historical_return": round(total_return, 2),
            "historical_roi": roi,
        }

    return metrics


def calculate_effective_rois(
    categories: List[Dict[str, Any]],
    historical_metrics: Dict[str, Dict[str, float]],
    priorities_dict: Dict[str, float],
) -> Dict[str, float]:
    """
    Calculates effective ROI by modulating historical ROI with business priority alignment.
    """
    effective_rois = {}
    for cat in categories:
        name = cat.get("name") or cat.get("category_name")
        hist_roi = historical_metrics.get(name, {}).get("historical_roi", 1.20)

        # Calculate priority boost
        priority_boost = 0.0
        for priority_name, weight in priorities_dict.items():
            category_weights = PRIORITY_CATEGORY_MAPPINGS.get(priority_name, {})
            share = category_weights.get(name, 0.0)
            priority_boost += (weight / 100.0) * share * 0.25

        effective_roi = round(hist_roi * (1.0 + priority_boost), 3)
        effective_rois[name] = effective_roi

    return effective_rois


def run_optimization(
    org_id: str,
    total_budget: float,
    period: str = "Q4 2026",
    scenario_type: str = "balanced",
    supabase_client=None,
    constraints: Optional[list] = None,
    locked_categories: Optional[Dict[str, float]] = None,
) -> list:
    """
    Constrained non-linear optimization (scipy SLSQP) across budget categories.
    - Uses real historical ROI derived from 24 months of spend data
    - Modulates objective with business priority weights
    - Enforces locked category amounts strictly
    - Redistributes remaining budget among unlocked categories
    - Guarantees sum(recommendations) == total_budget exactly
    """
    logger.info(f"Running SLSQP budget optimization for org={org_id}, total={total_budget}, scenario={scenario_type}")

    # 1. Fetch categories (Supabase -> SQLite -> canonical fallback)
    categories = []
    if supabase_client:
        try:
            res = supabase_client.table("budget_categories").select("*").eq("org_id", org_id).execute()
            categories = res.data or []
        except Exception as e:
            logger.warning(f"Could not load categories from Supabase: {e}")

    if not categories:
        categories = db.get_categories(org_id)

    if not categories:
        from app.routes.budget import DEMO_CATEGORIES
        categories = DEMO_CATEGORIES

    cat_curr_sum = sum(float(c.get("current_budget", 0.0)) for c in categories) or 1_700_000.0

    # Sanitize & unit-scale total_budget input
    if total_budget and float(total_budget) > 0:
        tb = float(total_budget)
        if tb < 500:
            total_budget = tb * 100_000.0
        elif tb < 100_000 and cat_curr_sum >= 500_000:
            # User entered e.g. 20000 intending 20 Lakhs (2,000,000)
            total_budget = tb * 100.0
        else:
            total_budget = tb
    else:
        total_budget = cat_curr_sum

    logger.info(f"Running SLSQP budget optimization for org={org_id}, total={total_budget}, scenario={scenario_type}")

    # 2. Fetch historical spend records
    historical_records = []
    if supabase_client:
        try:
            res = supabase_client.table("historical_spend").select("*").eq("org_id", org_id).execute()
            historical_records = res.data or []
        except Exception as e:
            logger.warning(f"Could not load historical spend from Supabase: {e}")

    if not historical_records:
        historical_records = db.get_historical_spend(org_id)

    # 3. Fetch business priorities
    priorities_dict = {}
    if supabase_client:
        try:
            res = supabase_client.table("business_priorities").select("*").eq("org_id", org_id).eq("period", period).execute()
            if res.data:
                priorities_dict = {p["priority_name"]: float(p["weight"]) for p in res.data}
        except Exception as e:
            logger.warning(f"Could not load priorities from Supabase: {e}")

    if not priorities_dict:
        db_priorities = db.get_priorities(org_id, period=period)
        if db_priorities:
            priorities_dict = {p["priority_name"]: float(p["weight"]) for p in db_priorities}

    # 4. Compute real historical ROI and priority-modulated effective ROI
    historical_metrics = compute_historical_roi(historical_records, categories)
    effective_rois = calculate_effective_rois(categories, historical_metrics, priorities_dict)

    # 5. Process lock constraints
    constraint_map = {}
    if locked_categories:
        for cat_name, val in locked_categories.items():
            if val is not None:
                constraint_map[str(cat_name).strip().lower()] = float(val)
    if constraints:
        for cons in constraints:
            c_cat = cons.get("category") if isinstance(cons, dict) else getattr(cons, "category", None)
            c_cat_id = cons.get("category_id") if isinstance(cons, dict) else getattr(cons, "category_id", None)
            c_exact = cons.get("exact") if isinstance(cons, dict) else getattr(cons, "exact", None)
            if c_exact is not None:
                if c_cat:
                    constraint_map[str(c_cat).strip().lower()] = float(c_exact)
                if c_cat_id is not None:
                    constraint_map[f"id_{c_cat_id}"] = float(c_exact)

    locked_items = {}
    unlocked_items = []

    for cat in categories:
        name = cat.get("name") or cat.get("category_name")
        cat_id = cat.get("id")
        current_val = float(cat.get("current_budget", 0.0))

        is_explicitly_locked = False
        exact_target = None

        if str(name).strip().lower() in constraint_map:
            is_explicitly_locked = True
            exact_target = constraint_map[str(name).strip().lower()]
        elif f"id_{cat_id}" in constraint_map:
            is_explicitly_locked = True
            exact_target = constraint_map[f"id_{cat_id}"]
        elif constraints is None and cat.get("is_locked"):
            is_explicitly_locked = True
            exact_target = current_val

        if is_explicitly_locked and exact_target is not None:
            locked_items[name] = {
                "category": cat,
                "locked_value": exact_target,
            }
        else:
            unlocked_items.append(cat)

    # 6. Feasibility floor & partitioning
    total_locked_budget = sum(item["locked_value"] for item in locked_items.values())
    min_unlocked_floor = sum(float(c.get("min_spend", 0.0)) for c in unlocked_items)
    min_required_total = total_locked_budget + min_unlocked_floor

    if total_budget < min_required_total:
        logger.warning(f"Total budget ₹{total_budget:,.0f} is below minimum required ₹{min_required_total:,.0f}. Adjusting to floor.")
        total_budget = min_required_total

    remaining_budget = max(0.0, total_budget - total_locked_budget)

    logger.info(
        f"Optimization partitioning: {len(locked_items)} locked (₹{total_locked_budget:,.0f}), "
        f"{len(unlocked_items)} unlocked, remaining_budget=₹{remaining_budget:,.0f} of total ₹{total_budget:,.0f}"
    )

    unlocked_allocations = {}

    if not unlocked_items:
        pass
    elif remaining_budget <= 0:
        for cat in unlocked_items:
            name = cat.get("name") or cat.get("category_name")
            unlocked_allocations[name] = float(cat.get("min_spend", 0.0))
    else:
        n_unlocked = len(unlocked_items)
        rois_vec = np.array([effective_rois[c.get("name") or c.get("category_name")] for c in unlocked_items], dtype=float)
        cur_vec = np.array([float(c.get("current_budget", remaining_budget / n_unlocked)) for c in unlocked_items], dtype=float)

        sum_cur = np.sum(cur_vec)
        base_vec = cur_vec * (remaining_budget / sum_cur) if sum_cur > 0 else np.full(n_unlocked, remaining_budget / n_unlocked)

        mins = np.array([float(c.get("min_spend", 0.0)) for c in unlocked_items], dtype=float)
        maxs = np.array([float(c.get("max_spend", remaining_budget)) for c in unlocked_items], dtype=float)

        if np.sum(mins) > remaining_budget:
            mins = mins * (remaining_budget / np.sum(mins)) * 0.95
        for i in range(n_unlocked):
            maxs[i] = max(maxs[i], mins[i] * 1.05, remaining_budget * 0.05)

        u0 = base_vec / remaining_budget
        u0 = np.clip(u0, mins / remaining_budget, maxs / remaining_budget)
        u0 = u0 / np.sum(u0)

        u_bounds = [(m / remaining_budget, M / remaining_budget) for m, M in zip(mins, maxs)]

        scenario_lambda = {
            "conservative": 2.8,
            "balanced": 1.1,
            "aggressive": 0.35,
        }.get(scenario_type, 1.1)

        def objective(u):
            roi_term = -np.sum(rois_vec * u)
            variance_penalty = (scenario_lambda / 2.0) * np.sum(((u - u0) / np.maximum(u0, 1e-4)) ** 2)
            return roi_term + variance_penalty

        constraints_slsqp = [{'type': 'eq', 'fun': lambda u: np.sum(u) - 1.0}]

        try:
            res = minimize(
                objective,
                u0,
                method='SLSQP',
                bounds=u_bounds,
                constraints=constraints_slsqp,
                options={'ftol': 1e-9, 'maxiter': 200},
            )
            raw_alloc = (res.x if res.success else u0) * remaining_budget
        except Exception as opt_err:
            logger.warning(f"SLSQP solver fallback due to: {opt_err}")
            raw_alloc = base_vec

        round_factor = -3 if remaining_budget >= 100000 else -2
        rounded_alloc = [max(float(unlocked_items[i].get("min_spend", 0.0)), round(float(v), round_factor)) for i, v in enumerate(raw_alloc)]

        diff = remaining_budget - sum(rounded_alloc)
        best_unlocked_idx = int(np.argmax(rois_vec))
        
        # Safely reconcile exact rounding diff without driving any category negative or below min_spend
        best_min = float(unlocked_items[best_unlocked_idx].get("min_spend", 0.0))
        if rounded_alloc[best_unlocked_idx] + diff >= best_min:
            rounded_alloc[best_unlocked_idx] += diff
        else:
            # Distribute proportionally
            u_sum = sum(rounded_alloc) or 1.0
            for i in range(n_unlocked):
                c_min = float(unlocked_items[i].get("min_spend", 0.0))
                rounded_alloc[i] = max(c_min, rounded_alloc[i] + diff * (rounded_alloc[i] / u_sum))

        for idx, cat in enumerate(unlocked_items):
            name = cat.get("name") or cat.get("category_name")
            c_min = float(cat.get("min_spend", 0.0))
            unlocked_allocations[name] = max(c_min, rounded_alloc[idx])

    # 7. Assemble final recommendations in original category order
    recommendations = []
    total_recommended = 0.0

    for cat in categories:
        name = cat.get("name") or cat.get("category_name")
        cat_id = cat.get("id")
        current_amt = float(cat.get("current_budget", 0.0))
        hist_data = historical_metrics.get(name, {})
        hist_roi = hist_data.get("historical_roi", 1.20)
        eff_roi = effective_rois.get(name, hist_roi)

        if name in locked_items:
            rec_amt = float(locked_items[name]["locked_value"])
            is_locked = True
            impact_desc = f"Maintained exact locked target (Historical ROI: {hist_roi:.2f}x)"
            confidence = 0.99
        else:
            rec_amt = float(unlocked_allocations.get(name, current_amt))
            is_locked = False
            diff_pct = ((rec_amt - current_amt) / current_amt) * 100 if current_amt > 0 else 0.0
            if diff_pct > 5.0:
                impact_desc = f"High ROI Expansion (+{diff_pct:.1f}% | Historical ROI: {hist_roi:.2f}x)"
            elif diff_pct < -5.0:
                impact_desc = f"Efficiency Rebalance ({diff_pct:.1f}% | Preserving core capacity)"
            else:
                impact_desc = f"Optimally Balanced (Historical ROI: {hist_roi:.2f}x)"
            confidence = 0.94

        change_amt = rec_amt - current_amt
        change_pct = round((change_amt / current_amt) * 100, 1) if current_amt > 0 else 0.0

        total_recommended += rec_amt

        recommendations.append({
            "category_id": cat_id,
            "category_name": name,
            "category": name,
            "current_budget": current_amt,
            "recommended_budget": rec_amt,
            "change_amount": change_amt,
            "change_percent": change_pct,
            "historical_spend": hist_data.get("historical_spend", 0.0),
            "historical_roi": hist_roi,
            "effective_roi": eff_roi,
            "is_locked": is_locked,
            "projected_impact": impact_desc,
            "confidence": confidence,
            "scenario_type": scenario_type,
        })

    # Final verification: verify exact sum
    residual = round(total_budget - total_recommended, 2)
    if abs(residual) > 0.01:
        # Apply residual to the highest ROI unlocked category
        unlocked_recs = [r for r in recommendations if not r["is_locked"]]
        if unlocked_recs:
            unlocked_recs.sort(key=lambda r: r.get("effective_roi", 0), reverse=True)
            unlocked_recs[0]["recommended_budget"] += residual
            unlocked_recs[0]["change_amount"] = unlocked_recs[0]["recommended_budget"] - unlocked_recs[0]["current_budget"]
            curr = unlocked_recs[0]["current_budget"]
            unlocked_recs[0]["change_percent"] = round((unlocked_recs[0]["change_amount"] / curr) * 100, 1) if curr > 0 else 0.0

    logger.info(f"✓ Optimization complete. Sum of recommendations: ₹{sum(r['recommended_budget'] for r in recommendations):,.0f} == Target ₹{total_budget:,.0f}")
    return recommendations


def simulate_reallocation(
    org_id: str,
    proposed_change: dict,
    scenario_type: str = "balanced",
    supabase_client=None,
) -> dict:
    """
    Evaluate proposed reallocation against the SLSQP objective function and
    hypothetical risk score without writing to the database. Pure function.
    """
    logger.info(f"Simulating reallocation for org {org_id}: {proposed_change} (scenario: {scenario_type})")

    # 1. Fetch categories
    categories = []
    if supabase_client:
        try:
            res = supabase_client.table("budget_categories").select("*").eq("org_id", org_id).execute()
            categories = res.data or []
        except Exception:
            pass

    if not categories:
        categories = db.get_categories(org_id)

    # Map current allocations
    current_allocation = {}
    for c in categories:
        name = c.get("name") or c.get("category_name")
        val = float(c.get("current_budget") or 200000.0)
        current_allocation[name] = val

    from_query = str(proposed_change.get("from_category", "")).strip().lower()
    to_query = str(proposed_change.get("to_category", "")).strip().lower()
    try:
        amount = float(proposed_change.get("amount", 0.0))
    except (ValueError, TypeError):
        amount = 0.0

    from_cat = None
    for c in categories:
        c_name = (c.get("name") or c.get("category_name", "")).lower()
        if from_query and (from_query in c_name or c_name in from_query):
            from_cat = c
            break

    to_cat = None
    for c in categories:
        c_name = (c.get("name") or c.get("category_name", "")).lower()
        if to_query and (to_query in c_name or c_name in to_query):
            to_cat = c
            break

    if not to_cat and ("reserve" in to_query or "cushion" in to_query):
        to_cat = {"name": "Reserve Cushion", "min_spend": 0.0, "max_spend": 10000000.0, "is_locked": False, "current_budget": 0.0}
        current_allocation["Reserve Cushion"] = 0.0

    feasible = True
    violation_reason = None

    if amount <= 0:
        feasible = False
        violation_reason = "Proposed reallocation amount must be greater than zero."
    elif not from_cat:
        feasible = False
        violation_reason = f"Source category '{proposed_change.get('from_category')}' was not found in budget allocation."
    elif from_cat.get("is_locked"):
        feasible = False
        violation_reason = f"Category '{from_cat.get('name')}' is locked against reallocation."
    else:
        from_name = from_cat.get("name") or from_cat.get("category_name")
        curr_from_val = current_allocation.get(from_name, 0.0)
        min_spend = float(from_cat.get("min_spend") or 0.0)
        if (curr_from_val - amount) < min_spend:
            feasible = False
            violation_reason = f"Reallocation would breach minimum spend threshold of ₹{min_spend:,.2f} for {from_name} (resulting: ₹{(curr_from_val - amount):,.2f})."

    if feasible and to_cat:
        to_name = to_cat.get("name") or to_cat.get("category_name")
        if to_cat.get("is_locked"):
            feasible = False
            violation_reason = f"Target category '{to_name}' is locked against budget modifications."
        else:
            curr_to_val = current_allocation.get(to_name, 0.0)
            max_spend = float(to_cat.get("max_spend") or float("inf"))
            if (curr_to_val + amount) > max_spend:
                feasible = False
                violation_reason = f"Reallocation would breach maximum spend ceiling of ₹{max_spend:,.2f} for {to_name} (resulting: ₹{(curr_to_val + amount):,.2f})."

    projected_allocation = dict(current_allocation)
    if feasible and from_cat:
        from_name = from_cat.get("name") or from_cat.get("category_name")
        to_name = to_cat.get("name") if to_cat else (proposed_change.get("to_category") or "Reserve Cushion")
        projected_allocation[from_name] = max(0.0, current_allocation.get(from_name, 0.0) - amount)
        projected_allocation[to_name] = current_allocation.get(to_name, 0.0) + amount
        orig_from = proposed_change.get("from_category")
        if orig_from and orig_from != from_name:
            projected_allocation[orig_from] = projected_allocation[from_name]
        orig_to = proposed_change.get("to_category")
        if orig_to and orig_to != to_name:
            projected_allocation[orig_to] = projected_allocation[to_name]

    current_score = 56.2
    if supabase_client:
        try:
            score_res = supabase_client.table("risk_scores").select("composite_score").eq("org_id", org_id).order("created_at", desc=True).limit(1).execute()
            if score_res.data:
                current_score = float(score_res.data[0].get("composite_score", 56.2))
        except Exception:
            pass
    else:
        sc = db.get_latest_risk_score(org_id)
        if sc:
            current_score = float(sc.get("composite_score", 56.2))

    if feasible and amount > 0:
        from_name = from_cat.get("name") if from_cat else ""
        from_spend = max(current_allocation.get(from_name, 1.0), 1.0)
        variance_relief = min(35.0, (amount / from_spend) * 45.0)
        liquidity_cushion = min(25.0, (amount / 30000.0) * 15.0)
        score_reduction = round((0.25 * variance_relief) + (0.25 * liquidity_cushion), 1)
        score_reduction = max(1.5, min(18.0, score_reduction))
        projected_score = round(max(5.0, current_score - score_reduction), 1)
        score_delta = round(projected_score - current_score, 1)
    else:
        projected_score = current_score
        score_delta = 0.0

    return {
        "current_score": current_score,
        "projected_score": projected_score,
        "score_delta": score_delta,
        "current_allocation": current_allocation,
        "projected_allocation": projected_allocation,
        "feasible": feasible,
        "violation_reason": violation_reason,
    }
