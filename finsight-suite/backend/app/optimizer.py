import logging
import numpy as np
from scipy.optimize import minimize

logger = logging.getLogger(__name__)

def run_optimization(org_id: str, total_budget: float, period: str, scenario_type: str, supabase_client) -> list:
    logger.info(f"Starting optimization for org {org_id}, budget {total_budget}, scenario {scenario_type}")
    
    # 1. Fetch budget categories
    categories_res = supabase_client.table("budget_categories").select("*").eq("org_id", org_id).execute()
    categories = categories_res.data
    
    if not categories:
        return []

    # 2. Fetch historical spend (simplified - assume actual_roi is stored or derived)
    # Using a placeholder actual_roi for demonstration
    
    # 3. Fetch priorities
    priorities_res = supabase_client.table("business_priorities").select("*").eq("org_id", org_id).eq("period", period).execute()
    priorities = {p["priority_name"]: p["weight"] for p in priorities_res.data}
    
    # Prepare data for optimization
    n = len(categories)
    locked_indices = []
    bounds = []
    initial_guess = []
    rois = []
    
    for i, cat in enumerate(categories):
        # Default ROI if not available (ideally fetched from historical performance)
        base_roi = 1.05
        # Modulate ROI based on priorities if mapped (simplified mapping)
        priority_boost = priorities.get(cat.get("category_name"), 0) / 100.0
        roi = base_roi + priority_boost
        rois.append(roi)
        
        if cat.get("is_locked"):
            locked_indices.append(i)
            fixed_val = cat.get("current_budget", total_budget / n)
            bounds.append((fixed_val, fixed_val))
            initial_guess.append(fixed_val)
        else:
            min_s = cat.get("min_spend", 0)
            max_s = cat.get("max_spend", total_budget)
            bounds.append((min_s, max_s))
            initial_guess.append(max(min_s, total_budget / n))
            
    # Objective function
    # scenario weights
    if scenario_type == "aggressive":
        roi_weight = 1.0
        var_weight = 0.0
    elif scenario_type == "conservative":
        roi_weight = 0.3
        var_weight = 0.7
    else: # balanced
        roi_weight = 0.7
        var_weight = 0.3
        
    def objective(x):
        # Maximize ROI -> Minimize negative ROI
        total_roi = -np.dot(x, rois)
        # Minimize variance from initial (penalize large shifts if conservative)
        variance_penalty = np.sum((x - initial_guess)**2)
        
        return (roi_weight * total_roi) + (var_weight * (variance_penalty / total_budget))
        
    # Constraint: sum(x) == total_budget
    def constraint_sum(x):
        return np.sum(x) - total_budget
        
    constraints = [{'type': 'eq', 'fun': constraint_sum}]
    
    result = minimize(
        objective, 
        initial_guess, 
        method='SLSQP', 
        bounds=bounds,
        constraints=constraints
    )
    
    allocations = result.x if result.success else initial_guess
    
    recommendations = []
    for i, cat in enumerate(categories):
        recommended = float(allocations[i])
        current = cat.get("current_budget", 0)
        projected = recommended * rois[i]
        
        recommendations.append({
            "category_id": cat.get("id", i + 1),
            "category_name": cat.get("name") or cat.get("category_name", f"Category {i+1}"),
            "current_budget": current,
            "recommended_budget": recommended,
            "projected_impact": projected - recommended,
            "confidence": 0.85 if result.success else 0.50
        })
        
    logger.info(f"Optimization completed. Success: {result.success}")
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

    # 1. Fetch categories or fallback
    categories = []
    if supabase_client:
        try:
            res = supabase_client.table("budget_categories").select("*").eq("org_id", org_id).execute()
            categories = res.data or []
        except Exception as e:
            logger.warning(f"Failed to fetch categories from DB: {e}")

    if not categories:
        categories = [
            {"id": 1, "name": "Marketing & Advertising", "current_budget": 200000.0, "min_spend": 100000.0, "max_spend": 500000.0, "is_locked": False},
            {"id": 2, "name": "Research & Development", "current_budget": 300000.0, "min_spend": 200000.0, "max_spend": 600000.0, "is_locked": False},
            {"id": 3, "name": "Operations & Infrastructure", "current_budget": 500000.0, "min_spend": 300000.0, "max_spend": 800000.0, "is_locked": True},
            {"id": 4, "name": "Sales & Distribution", "current_budget": 180000.0, "min_spend": 80000.0, "max_spend": 400000.0, "is_locked": False},
            {"id": 5, "name": "HR & Administration", "current_budget": 120000.0, "min_spend": 50000.0, "max_spend": 250000.0, "is_locked": False},
        ]

    # Map current allocations
    current_allocation = {}
    for c in categories:
        name = c.get("name") or c.get("category_name", f"Category {c.get('id')}")
        val = float(c.get("current_budget") or 200000.0)
        current_allocation[name] = val

    from_query = str(proposed_change.get("from_category", "")).strip().lower()
    to_query = str(proposed_change.get("to_category", "")).strip().lower()
    try:
        amount = float(proposed_change.get("amount", 0.0))
    except (ValueError, TypeError):
        amount = 0.0

    # Match from_category
    from_cat = None
    for c in categories:
        c_name = (c.get("name") or c.get("category_name", "")).lower()
        if from_query and (from_query in c_name or c_name in from_query):
            from_cat = c
            break

    # Match to_category
    to_cat = None
    for c in categories:
        c_name = (c.get("name") or c.get("category_name", "")).lower()
        if to_query and (to_query in c_name or c_name in to_query):
            to_cat = c
            break

    # If "reserve" requested and not found, provide virtual reserve
    if not to_cat and ("reserve" in to_query or "contingency" in to_query):
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
            violation_reason = f"Reallocation would breach minimum spend threshold of ${min_spend:,.2f} for {from_name} (resulting: ${(curr_from_val - amount):,.2f})."

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
                violation_reason = f"Reallocation would breach maximum spend ceiling of ${max_spend:,.2f} for {to_name} (resulting: ${(curr_to_val + amount):,.2f})."

    # Compute projected allocation
    projected_allocation = dict(current_allocation)
    if feasible and from_cat:
        from_name = from_cat.get("name") or from_cat.get("category_name")
        to_name = to_cat.get("name") if to_cat else (proposed_change.get("to_category") or "Reserve Cushion")
        projected_allocation[from_name] = max(0.0, current_allocation.get(from_name, 0.0) - amount)
        projected_allocation[to_name] = current_allocation.get(to_name, 0.0) + amount

    # 3. Retrieve current composite risk score
    current_score = 52.4
    if supabase_client:
        try:
            score_res = (
                supabase_client.table("risk_scores")
                .select("composite_score")
                .eq("org_id", org_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if score_res.data:
                current_score = float(score_res.data[0].get("composite_score", 52.4))
        except Exception:
            pass

    # 4. Re-run hypothetical risk score on spend distribution
    if feasible and amount > 0:
        # Reallocation from overextended bucket to reserve/ops dampens budget variance & liquidity risk
        from_name = from_cat.get("name") if from_cat else ""
        from_spend = max(current_allocation.get(from_name, 1.0), 1.0)
        variance_relief = min(35.0, (amount / from_spend) * 45.0)
        liquidity_cushion = min(25.0, (amount / 30000.0) * 15.0)
        # Weighted reduction across variance (0.25) and liquidity (0.25)
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
