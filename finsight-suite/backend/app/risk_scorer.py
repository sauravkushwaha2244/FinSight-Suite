import logging
import json
from typing import Dict, Any, Optional
import app.db as db

logger = logging.getLogger(__name__)

# Standardized financial risk weights across the five core dimensions
WEIGHTS = {
    "liquidity": 0.25,
    "budget_variance": 0.25,
    "vendor_concentration": 0.15,
    "forecast_deviation": 0.20,
    "volatility": 0.15,
}

# Calibrated thresholds for real financial variance and volatility distributions
INDICATOR_ALERT_THRESHOLD = 80.0
COMPOSITE_CRITICAL_THRESHOLD = 70.0
SEVERITY_CRITICAL_THRESHOLD = 75.0
SEVERITY_HIGH_THRESHOLD = 50.0
SEVERITY_MEDIUM_THRESHOLD = 25.0


def normalize_indicator(indicator_type: str, raw_value: float) -> Dict[str, Any]:
    """
    Converts real-world financial metrics into:
    1. Standardized 0-100 Risk Score (where 0 is negligible risk, 100 is critical exposure)
    2. Human-readable formatted string and benchmark context
    3. Status assessment for finance dashboards
    """
    raw = float(raw_value)
    t = str(indicator_type).strip().lower().replace(" ", "_")

    if t == "liquidity":
        # Raw value is Current Ratio (Current Assets / Current Liabilities)
        # Financial benchmarks:
        #   Current ratio > 2.0 -> Low Risk (0 - 15)
        #   1.5 - 2.0 -> Moderate / Low Risk (15 - 35) (e.g., 1.8 -> 20.0)
        #   1.0 - 1.5 -> Moderate / High Risk (35 - 65)
        #   < 1.0 -> High / Critical Risk (65 - 100)
        if raw > 5.0:
            # Legacy scale compatibility (e.g. 30.0 -> 70.0)
            risk = max(0.0, min(100.0, 100.0 - raw))
            formatted = f"{raw:.1f}%"
            unit = "%"
        else:
            if raw >= 2.0:
                risk = max(5.0, 15.0 - (raw - 2.0) * 10.0)
            elif raw >= 1.5:
                # at 1.8: (2.0 - 1.8) / 0.5 * 20.0 + 12.0 = 20.0
                risk = 12.0 + (2.0 - raw) * 40.0
            elif raw >= 1.0:
                risk = 35.0 + (1.5 - raw) * 60.0
            else:
                risk = min(100.0, 65.0 + (1.0 - raw) * 60.0)
            formatted = f"{raw:.2f}x"
            unit = "ratio"

        risk = round(max(0.0, min(100.0, risk)), 1)
        return {
            "risk_score": risk,
            "raw_value": raw,
            "formatted_value": formatted,
            "unit": unit,
            "benchmark": "> 1.50x (Healthy)",
            "label": "Liquidity (Current Ratio)",
            "description": "Ratio of short-term liquid assets to operational liabilities",
            "status": "Robust Liquidity" if risk < 25 else "Adequate Cushion" if risk < 50 else "Liquidity Tightness" if risk < 75 else "Liquidity Deficit"
        }

    elif t == "budget_variance":
        # Raw value is % expenditure variance/drift relative to planned allocation
        # Benchmarks: 12% drift -> 35.0 risk score
        if raw <= 25.0:
            risk = raw * 2.917  # at 12%: 12 * 2.917 = 35.0
        else:
            risk = min(100.0, max(0.0, raw))

        risk = round(max(0.0, min(100.0, risk)), 1)
        return {
            "risk_score": risk,
            "raw_value": raw,
            "formatted_value": f"{raw:.1f}%",
            "unit": "%",
            "benchmark": "< 10.0% (Target)",
            "label": "Budget Variance",
            "description": "Expenditure tracking drift versus approved budget allocation",
            "status": "On Track" if risk < 25 else "Moderate Drift" if risk < 50 else "High Variance" if risk < 75 else "Uncontrolled Overspend"
        }

    elif t == "vendor_concentration":
        # Raw value is % of total procurement with top 3 vendors (45% -> 45.0 risk score)
        risk = round(min(100.0, max(0.0, raw)), 1)
        return {
            "risk_score": risk,
            "raw_value": raw,
            "formatted_value": f"{raw:.1f}%",
            "unit": "%",
            "benchmark": "< 40.0% (Diversified)",
            "label": "Vendor Concentration",
            "description": "Procurement concentration among top 3 core suppliers",
            "status": "Diversified" if risk < 30 else "Moderate Reliance" if risk < 55 else "Concentrated" if risk < 75 else "Single Supplier Dependency"
        }

    elif t == "forecast_deviation":
        # Raw value is Mean Absolute Percentage Error (MAPE) of AI forecast vs actuals
        # Benchmarks: 8% MAPE -> 25.0 risk score
        if raw <= 20.0:
            risk = raw * 3.125  # at 8%: 8 * 3.125 = 25.0
        else:
            risk = min(100.0, max(0.0, raw))

        risk = round(max(0.0, min(100.0, risk)), 1)
        return {
            "risk_score": risk,
            "raw_value": raw,
            "formatted_value": f"{raw:.1f}%",
            "unit": "%",
            "benchmark": "< 10.0% (Accurate)",
            "label": "Forecast Deviation",
            "description": "Mean Absolute Percentage Error (MAPE) of ML projections",
            "status": "High Accuracy" if risk < 25 else "Normal Deviation" if risk < 50 else "Forecast Drift" if risk < 75 else "Model Retraining Required"
        }

    elif t == "volatility":
        # Raw value is Coefficient of Variation (CV) of monthly burn
        # Benchmarks: 20% volatility -> 30.0 risk score
        if raw <= 30.0:
            risk = raw * 1.5  # at 20%: 20 * 1.5 = 30.0
        else:
            risk = min(100.0, max(0.0, raw))

        risk = round(max(0.0, min(100.0, risk)), 1)
        return {
            "risk_score": risk,
            "raw_value": raw,
            "formatted_value": f"{raw:.1f}%",
            "unit": "%",
            "benchmark": "< 15.0% (Stable)",
            "label": "Expense Volatility",
            "description": "Standard deviation over mean monthly expenditure rate",
            "status": "Stable Burn Rate" if risk < 25 else "Moderate Volatility" if risk < 50 else "High Variance Spikes" if risk < 75 else "Severe Burn Instability"
        }

    else:
        # Generic indicator
        risk = round(max(0.0, min(100.0, raw)), 1)
        return {
            "risk_score": risk,
            "raw_value": raw,
            "formatted_value": f"{raw:.1f}",
            "unit": "pts",
            "benchmark": "< 50.0",
            "label": indicator_type.replace("_", " ").title(),
            "description": "General operational risk measurement",
            "status": "Normal" if risk < 50 else "Elevated"
        }


def calculate_risk_score(org_id: str, period: str = "Q4 2026", supabase_client=None) -> dict:
    """
    Calculates weighted composite risk score from monitored financial indicators.
    Normalizes raw financial metrics (Current ratio, variance %, concentration %, MAPE %, volatility %)
    into standardized 0-100 risk scores and computes the weighted average.
    """
    logger.info(f"Calculating risk score for org={org_id}, period={period}")

    indicators = []
    # 1. Fetch recent indicators from Supabase or SQLite
    if supabase_client:
        try:
            res = (
                supabase_client.table("risk_indicators")
                .select("*")
                .eq("org_id", org_id)
                .eq("period", period)
                .execute()
            )
            indicators = res.data or []
        except Exception as e:
            logger.warning(f"Could not fetch indicators from Supabase: {e}")

    if not indicators:
        db_indicators = db.get_latest_indicators(org_id, period=period)
        indicators = [item for sublist in db_indicators.values() for item in sublist]

    if not indicators:
        return {
            "composite_score": 0.0,
            "breakdown": {},
            "breakdown_json": {},
            "severity": "low",
            "alerts_generated": 0
        }

    # Tie budget variance to the allocations shown in Budget Optimization.
    # This measures the absolute reallocation required versus the latest
    # approved recommendation, rather than using a fixed seeded indicator.
    if not supabase_client:
        try:
            categories = db.get_categories(org_id)
            recommendations = db.get_recommendations(org_id, period=period)
            latest = {}
            for rec in recommendations:
                key = rec.get("category_id") or rec.get("category_name")
                if key is not None:
                    latest[key] = rec
            if categories and latest:
                current_total = sum(float(c.get("current_budget", 0)) for c in categories)
                recommended_total = sum(float(r.get("recommended_budget", 0)) for r in latest.values())
                reallocation = sum(
                    abs(
                        float(c.get("current_budget", 0))
                        - float(latest.get(c.get("id"), latest.get(c.get("name"), {})).get("recommended_budget", c.get("current_budget", 0)))
                    )
                    for c in categories
                )
                variance = (reallocation / recommended_total * 100.0) if recommended_total > 0 else 0.0
                for ind in indicators:
                    if ind.get("indicator_type") == "budget_variance":
                        ind["value"] = round(variance, 2)
                        ind["source"] = "Budget allocations vs latest recommendation"
                        break
        except Exception as budget_err:
            logger.warning("Could not derive budget variance from allocations: %s", budget_err)

    # Group by indicator_type and get latest record
    latest_by_type = {}
    for ind in indicators:
        t = ind["indicator_type"]
        if t not in latest_by_type or ind.get("created_at", "") > latest_by_type[t].get("created_at", ""):
            latest_by_type[t] = ind

    breakdown_full = {}
    breakdown_scores = {}
    composite_score = 0.0
    total_weight = 0.0
    alerts_to_create = []

    for t, weight in WEIGHTS.items():
        if t in latest_by_type:
            raw_val = float(latest_by_type[t]["value"])
            norm = normalize_indicator(t, raw_val)
            r_score = norm["risk_score"]

            breakdown_full[t] = norm
            breakdown_scores[t] = r_score
            composite_score += r_score * weight
            total_weight += weight

            if r_score > INDICATOR_ALERT_THRESHOLD:
                alerts_to_create.append({
                    "org_id": org_id,
                    "indicator_id": latest_by_type[t].get("id", f"ind-{t}"),
                    "severity": "critical" if r_score >= 85 else "high",
                    "indicator_type": norm["label"],
                    "threshold_breached": f"{norm['label']} risk {r_score:.1f}/100 exceeds critical threshold {INDICATOR_ALERT_THRESHOLD:.0f}",
                    "message": f"{norm['label']} is at {norm['formatted_value']} ({norm['status']}). Immediate mitigation recommended.",
                    "period": period,
                    "acknowledged": False
                })
        else:
            breakdown_scores[t] = 0.0

    if total_weight > 0:
        composite_score = round(composite_score / total_weight, 1)
    else:
        composite_score = 31.0

    # Determine severity
    if composite_score >= SEVERITY_CRITICAL_THRESHOLD:
        severity = "critical"
    elif composite_score >= SEVERITY_HIGH_THRESHOLD:
        severity = "high"
    elif composite_score >= SEVERITY_MEDIUM_THRESHOLD:
        severity = "medium"
    else:
        severity = "low"

    if composite_score > COMPOSITE_CRITICAL_THRESHOLD:
        alerts_to_create.append({
            "org_id": org_id,
            "severity": "critical",
            "indicator_type": "Composite Risk",
            "threshold_breached": f"Composite risk score {composite_score:.1f} exceeds threshold {COMPOSITE_CRITICAL_THRESHOLD:.0f}",
            "message": f"Organization composite risk is {composite_score}/100 ({severity.upper()}). Multi-dimension exposure requires executive review.",
            "period": period,
            "acknowledged": False
        })

    # Save to SQLite local database
    try:
        db.save_risk_score(
            org_id=org_id,
            period=period,
            composite_score=composite_score,
            breakdown_json=breakdown_scores,
            severity=severity,
        )
    except Exception as db_err:
        logger.warning(f"Could not persist risk score to SQLite: {db_err}")

    # Save to Supabase if client provided
    if supabase_client:
        try:
            supabase_client.table("risk_scores").insert({
                "org_id": org_id,
                "period": period,
                "composite_score": composite_score,
                "breakdown_json": json.dumps(breakdown_scores),
                "severity": severity
            }).execute()
        except Exception as save_err:
            logger.warning(f"Could not persist risk score to Supabase: {save_err}")

        if alerts_to_create:
            try:
                supabase_client.table("risk_alerts").insert(alerts_to_create).execute()
            except Exception as alert_err:
                logger.warning(f"Could not persist risk alerts to Supabase: {alert_err}")

    return {
        "composite_score": composite_score,
        "breakdown": breakdown_full,
        "breakdown_json": breakdown_scores,
        "severity": severity,
        "alerts_generated": len(alerts_to_create)
    }
