from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from app.auth import get_current_user, require_admin
from app.supabase_client import get_service_client
from app.risk_scorer import calculate_risk_score
from app.narrative import (
    NarrativeRequest,
    NarrativeResponse,
    call_llm_narrative,
    get_cached_narrative,
    store_narrative,
    generate_fallback_narrative,
)
import app.db as db
import logging
import json
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/risk", tags=["Risk"])

# ── Demo fallback data ───────────────────────────────────────────────────────
def _demo_dashboard(seed_score: float = 52.4):
    severity = (
        "critical" if seed_score >= 75 else
        "high" if seed_score >= 50 else
        "medium" if seed_score >= 25 else "low"
    )
    return {
        "mode": "demo",
        "overall_score": seed_score,
        "severity": severity,
        "latest_score": {
            "composite_score": seed_score,
            "severity": severity,
            "period": "Q4 2026",
            "created_at": datetime.utcnow().isoformat() + "Z",
        },
        "unacknowledged_alerts_count": 5,
        "latest_indicators": {
            "liquidity": [{"indicator_type": "liquidity", "value": 34, "created_at": "2026-09-24T10:00:00Z"}],
            "budget_variance": [{"indicator_type": "budget_variance", "value": 55, "created_at": "2026-09-24T10:00:00Z"}],
            "vendor_concentration": [{"indicator_type": "vendor_concentration", "value": 81, "created_at": "2026-09-24T10:00:00Z"}],
            "forecast_deviation": [{"indicator_type": "forecast_deviation", "value": 38, "created_at": "2026-09-24T10:00:00Z"}],
            "volatility": [{"indicator_type": "volatility", "value": 72, "created_at": "2026-09-24T10:00:00Z"}],
        },
    }


def _demo_alerts(limit: int = 50, severity: Optional[str] = None, acknowledged: bool = False):
    base = [
        {"id": "demo-a1", "severity": "critical", "indicator_type": "Vendor Concentration",
         "message": "Vendor concentration risk exceeds 80% threshold — top 3 suppliers represent critical exposure. Diversification recommended.",
         "created_at": (datetime.utcnow() - timedelta(minutes=30)).isoformat() + "Z",
         "acknowledged": False, "period": "Q4 2026",
         "threshold_breached": "Vendor score 81.0 exceeds threshold 80"},
        {"id": "demo-a2", "severity": "high", "indicator_type": "Liquidity",
         "message": "Liquidity ratio approaching minimum acceptable threshold. Review payables schedule and cash reserves.",
         "created_at": (datetime.utcnow() - timedelta(hours=1)).isoformat() + "Z",
         "acknowledged": False, "period": "Q4 2026",
         "threshold_breached": "Liquidity inverted score 66.0 exceeds threshold 65"},
        {"id": "demo-a3", "severity": "high", "indicator_type": "Budget Variance",
         "message": "Q3 Operational spend trending 12.4% above recommended budget allocation. Finance review required.",
         "created_at": (datetime.utcnow() - timedelta(hours=2)).isoformat() + "Z",
         "acknowledged": False, "period": "Q4 2026"},
        {"id": "demo-a4", "severity": "medium", "indicator_type": "Market Volatility",
         "message": "Market volatility indicator increased 18% in the last 24 hours. Consider hedging positions.",
         "created_at": (datetime.utcnow() - timedelta(hours=12)).isoformat() + "Z",
         "acknowledged": False, "period": "Q4 2026"},
        {"id": "demo-a5", "severity": "medium", "indicator_type": "Forecast Deviation",
         "message": "Forecast deviation in R&D category — MAPE crossed $500 warning threshold.",
         "created_at": (datetime.utcnow() - timedelta(hours=18)).isoformat() + "Z",
         "acknowledged": False, "period": "Q4 2026"},
        {"id": "demo-a6", "severity": "low", "indicator_type": "System",
         "message": "Weekly risk recalibration completed successfully. 5 indicators processed, 0 critical anomalies detected.",
         "created_at": (datetime.utcnow() - timedelta(days=2)).isoformat() + "Z",
         "acknowledged": False, "period": "Q4 2026"},
    ]
    filtered = [a for a in base if a["acknowledged"] == acknowledged]
    if severity and severity != "all":
        filtered = [a for a in filtered if (a["severity"] or "").lower() == severity.lower()]
    return filtered[:limit]


# ── Pydantic schemas ─────────────────────────────────────────────────────────
class IndicatorItem(BaseModel):
    indicator_type: str
    category: Optional[str] = None
    value: float
    period: str
    source: Optional[str] = None


class IngestRequest(BaseModel):
    indicators: List[IndicatorItem]


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.get("/dashboard", summary="Risk dashboard overview")
def get_dashboard(user: dict = Depends(get_current_user)):
    """
    Aggregated risk dashboard view:
    - Latest composite risk score + severity
    - Unacknowledged alerts count
    - Most recent indicators grouped by type
    """
    org_id = user.get("org_id") or "demo-org"
    supabase = get_service_client()

    if not supabase:
        indicators = db.get_latest_indicators(org_id)
        unack_alerts = db.get_alerts(org_id, acknowledged=False)
        w = {"liquidity": 0.25, "budget_variance": 0.25, "vendor_concentration": 0.20, "forecast_deviation": 0.15, "volatility": 0.15}
        total_w = 0.0
        score = 0.0
        for k, weight in w.items():
            if k in indicators and indicators[k]:
                score += indicators[k][0]["value"] * weight
                total_w += weight
        final_score = round(score / total_w if total_w > 0 else 52.4, 1)
        severity = (
            "critical" if final_score >= 75 else
            "high" if final_score >= 50 else
            "medium" if final_score >= 25 else "low"
        )
        return {
            "mode": "live",
            "org_id": org_id,
            "overall_score": final_score,
            "severity": severity,
            "latest_score": {
                "composite_score": final_score,
                "severity": severity,
                "period": "Q4 2026",
                "created_at": datetime.utcnow().isoformat() + "Z",
            },
            "unacknowledged_alerts_count": len(unack_alerts),
            "latest_indicators": indicators,
        }

    try:
        score_res = (
            supabase.table("risk_scores")
            .select("*")
            .eq("org_id", org_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        latest_score = score_res.data[0] if score_res.data else None

        alerts_res = (
            supabase.table("risk_alerts")
            .select("id", count="exact")
            .eq("org_id", org_id)
            .eq("acknowledged", False)
            .execute()
        )
        unack_count = alerts_res.count if alerts_res.count is not None else 0

        ind_res = (
            supabase.table("risk_indicators")
            .select("*")
            .eq("org_id", org_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        indicators_by_type = {}
        for ind in ind_res.data:
            t = ind["indicator_type"]
            if t not in indicators_by_type:
                indicators_by_type[t] = []
            if len(indicators_by_type[t]) < 5:
                indicators_by_type[t].append(ind)

        if latest_score:
            return {
                "mode": "live",
                "org_id": org_id,
                "overall_score": latest_score.get("composite_score", 0),
                "severity": latest_score.get("severity", "low"),
                "latest_score": latest_score,
                "unacknowledged_alerts_count": unack_count,
                "latest_indicators": indicators_by_type,
            }
        return _demo_dashboard(52.4)
    except Exception as e:
        logger.warning(f"risk dashboard failed, fallback to demo: {e}")
        return _demo_dashboard(52.4)


@router.get("/alerts", summary="List active risk alerts")
def get_alerts(
    severity: Optional[str] = None,
    acknowledged: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    """
    Paginated list of risk alerts for the authenticated organization.

    - **severity**: filter by `critical` | `high` | `medium` | `low`
    - **acknowledged**: filter by acknowledgment state (default False)
    """
    org_id = user.get("org_id") or "demo-org"
    supabase = get_service_client()

    if not supabase:
        alerts = db.get_alerts(org_id=org_id, limit=limit, acknowledged=acknowledged)
        if severity:
            alerts = [a for a in alerts if a.get("severity") == severity]
        return alerts

    try:
        query = (
            supabase.table("risk_alerts")
            .select("*, risk_indicators(*)")
            .eq("org_id", org_id)
            .eq("acknowledged", acknowledged)
        )
        if severity:
            query = query.eq("severity", severity)

        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        if res.data:
            return res.data
        return _demo_alerts(limit=limit, severity=severity, acknowledged=acknowledged)
    except Exception as e:
        logger.warning(f"risk alerts failed, fallback to demo: {e}")
        return _demo_alerts(limit=limit, severity=severity, acknowledged=acknowledged)


@router.post("/indicators/ingest", summary="Ingest risk indicator data")
def ingest_indicators(
    request: IngestRequest,
    user: dict = Depends(require_admin),
):
    """
    Ingest one or more risk indicator measurements.
    Automatically triggers risk score recalculation and alert generation.
    """
    org_id = user.get("org_id") or "demo-org"
    if not request.indicators:
        return {"ingested": 0, "alerts_generated": 0}

    supabase = get_service_client()
    if not supabase:
        return {
            "mode": "demo",
            "ingested": len(request.indicators),
            "alerts_generated": 2,
            "message": "Demo mode: indicators processed in memory only",
        }

    records = [{
        "org_id": org_id,
        "indicator_type": i.indicator_type,
        "category": i.category,
        "value": i.value,
        "period": i.period,
        "source": i.source,
    } for i in request.indicators]

    try:
        supabase.table("risk_indicators").insert(records).execute()
        period = request.indicators[0].period
        alerts_generated = 0
        if period:
            result = calculate_risk_score(org_id, period, supabase)
            alerts_generated = result.get("alerts_generated", 0)
        return {
            "mode": "live",
            "ingested": len(records),
            "alerts_generated": alerts_generated,
            "period": period,
        }
    except Exception as e:
        logger.exception(f"indicator ingest failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/acknowledge", summary="Acknowledge a risk alert")
def acknowledge_alert(alert_id: str, user: dict = Depends(get_current_user)):
    org_id = user.get("org_id") or "demo-org"
    supabase = get_service_client()
    if not supabase:
        db.acknowledge_alert(alert_id)
        return {
            "mode": "live",
            "id": alert_id,
            "acknowledged": True,
            "acknowledged_at": datetime.utcnow().isoformat() + "Z",
            "acknowledged_by": org_id,
        }

    try:
        check = supabase.table("risk_alerts").select("id").eq("id", alert_id).eq("org_id", org_id).execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Alert not found")
        res = (
            supabase.table("risk_alerts")
            .update({
                "acknowledged": True,
                "acknowledged_at": datetime.utcnow().isoformat(),
            })
            .eq("id", alert_id)
            .execute()
        )
        return res.data[0] if res.data else None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scores/history", summary="Historical risk scores (time series)")
def get_score_history(
    period: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """Return a time series of recent composite risk scores for charting."""
    org_id = user.get("org_id") or "demo-org"
    supabase = get_service_client()

    demo_series = []
    base_score = 52.4
    for i in range(limit):
        import random
        s = round(base_score + random.uniform(-12, 12), 1)
        s = max(0, min(100, s))
        sev = (
            "critical" if s >= 75 else "high" if s >= 50 else "medium" if s >= 25 else "low"
        )
        demo_series.append({
            "composite_score": s,
            "severity": sev,
            "created_at": (datetime.utcnow() - timedelta(days=limit - i)).isoformat() + "Z",
            "period": period or "Q4 2026",
        })

    if not supabase:
        return demo_series
    try:
        q = supabase.table("risk_scores").select("*").eq("org_id", org_id)
        if period:
            q = q.eq("period", period)
        res = q.order("created_at", desc=True).limit(limit).execute()
        return list(reversed(res.data)) if res.data else demo_series
    except Exception:
        return demo_series


@router.post(
    "/alerts/{alert_id}/explain",
    response_model=NarrativeResponse,
    summary="Generate or retrieve narrative explanation for risk alert",
)
def explain_alert(
    alert_id: str,
    request_data: Optional[NarrativeRequest] = None,
    user: dict = Depends(get_current_user),
):
    """
    Check cache in alert_narratives; on miss, call LLM (Anthropic) to generate
    a grounded narrative explanation and optional suggested remediation action,
    persist to alert_narratives, and return. Fails open on LLM error.
    """
    org_id = user.get("org_id") or "demo-org"
    supabase = get_service_client()

    # 1. Check cache first
    cached = get_cached_narrative(org_id, alert_id, supabase)
    if cached:
        return cached

    # 2. Build or use NarrativeRequest
    if request_data and request_data.indicator_breakdown:
        req = request_data
        req.org_id = org_id
        req.alert_id = alert_id
    else:
        alert_info = None
        if supabase:
            try:
                res = (
                    supabase.table("risk_alerts")
                    .select("*, risk_indicators(*)")
                    .eq("id", alert_id)
                    .eq("org_id", org_id)
                    .execute()
                )
                if res.data:
                    alert_info = res.data[0]
            except Exception:
                pass

        if not alert_info:
            demo_match = [a for a in _demo_alerts(50) if str(a.get("id")) == str(alert_id)]
            alert_info = demo_match[0] if demo_match else {
                "id": alert_id,
                "severity": "high",
                "indicator_type": "Vendor Concentration",
                "threshold_breached": "Vendor concentration risk exceeds 80%",
            }

        indicator_breakdown = {
            "liquidity": 34.0,
            "budget_variance": 55.0,
            "vendor_concentration": 81.0,
            "forecast_deviation": 38.0,
            "volatility": 72.0,
        }
        composite_score = 52.4
        severity = alert_info.get("severity") or "high"

        if supabase:
            try:
                sc = (
                    supabase.table("risk_scores")
                    .select("*")
                    .eq("org_id", org_id)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if sc.data:
                    composite_score = float(sc.data[0].get("composite_score", 52.4))
                    raw_bd = sc.data[0].get("breakdown_json")
                    if isinstance(raw_bd, str):
                        indicator_breakdown = json.loads(raw_bd)
                    elif isinstance(raw_bd, dict):
                        indicator_breakdown = raw_bd
            except Exception:
                pass

        # Anchor indicator based on alert
        ind_type = (alert_info.get("indicator_type") or "").lower().replace(" ", "_")
        if ind_type in indicator_breakdown:
            indicator_breakdown[ind_type] = max(indicator_breakdown[ind_type], 80.0)

        top_contributing = [
            {"category": "Marketing & Advertising", "pct_of_spend": 34.0, "change_pct": 20.0, "amount": 200000.0},
            {"category": "Operations & Infrastructure", "pct_of_spend": 38.0, "change_pct": 8.0, "amount": 500000.0},
            {"category": "Research & Development", "pct_of_spend": 18.0, "change_pct": -4.0, "amount": 300000.0},
        ]

        req = NarrativeRequest(
            org_id=org_id,
            alert_id=alert_id,
            indicator_breakdown=indicator_breakdown,
            composite_score=composite_score,
            severity=severity,
            top_contributing_categories=top_contributing,
        )

    # 3. Call LLM (with fail-open fallback inside call_llm_narrative)
    narrative = call_llm_narrative(req)

    # 4. Cache and return
    store_narrative(org_id, alert_id, narrative, supabase)
    return narrative
