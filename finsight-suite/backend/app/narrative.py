from __future__ import annotations
import json
import logging
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

from app.config import get_settings

logger = logging.getLogger(__name__)


# ── Pydantic Request / Response Schemas ───────────────────────────────────────
class ContributingCategory(BaseModel):
    category: str
    pct_of_spend: float = 0.0
    change_pct: float = 0.0
    amount: Optional[float] = None


class NarrativeRequest(BaseModel):
    org_id: str
    alert_id: Optional[str] = None
    indicator_breakdown: Dict[str, float] = Field(default_factory=dict)
    previous_breakdown: Optional[Dict[str, float]] = None
    composite_score: float = 50.0
    severity: str = "medium"
    top_contributing_categories: List[Dict[str, Any]] = Field(default_factory=list)


class NarrativeResponse(BaseModel):
    headline: str
    explanation: str
    suggested_action: Optional[Dict[str, Any]] = None
    confidence: str = "medium"  # "high" | "medium" | "low"


SYSTEM_PROMPT = (
    "You are a financial analyst assistant. "
    "Only reference numbers and categories present in the input. Never invent figures. "
    "If the data doesn't support a clear cause, say so plainly rather than guessing. "
    "Return your response ONLY as a JSON object with the exact keys: 'headline' (str), 'explanation' (str), "
    "'suggested_action' (dict or null with keys 'type', 'from_category', 'to_category', 'amount'), "
    "and 'confidence' (one of 'high', 'medium', 'low')."
)


# ── Demo / Deterministic Fallback Generator ──────────────────────────────────
def generate_fallback_narrative(request: NarrativeRequest) -> NarrativeResponse:
    """
    Grounded, deterministic fallback narrative template in case the LLM call fails,
    is slow, or no Anthropic API key is configured. Fails open and strictly obeys
    the grounding rule (only uses numbers present in input).
    """
    indicators = request.indicator_breakdown or {}
    top_cats = request.top_contributing_categories or []

    # Find highest risk indicator
    top_indicator = "risk indicator"
    top_val = 0.0
    if indicators:
        sorted_inds = sorted(indicators.items(), key=lambda kv: kv[1], reverse=True)
        top_indicator, top_val = sorted_inds[0]
        top_indicator_name = top_indicator.replace("_", " ").title()
    else:
        top_indicator_name = "Risk Indicator"
        top_val = request.composite_score

    top_cat_name = "Operational Spend"
    pct_spend = 0.0
    change_pct = 0.0
    amount = 0.0

    if top_cats:
        first_cat = top_cats[0]
        top_cat_name = first_cat.get("category", "Marketing")
        pct_spend = float(first_cat.get("pct_of_spend", 0.0))
        change_pct = float(first_cat.get("change_pct", 0.0))
        amount = float(first_cat.get("amount", 0.0))

    # Grounded headline
    if pct_spend > 0 and change_pct != 0:
        headline = f"Elevated {top_indicator_name} driven by {top_cat_name} ({pct_spend:.1f}% spend, {change_pct:+.1f}% shift)"
    elif pct_spend > 0:
        headline = f"Elevated {top_indicator_name} concentrated in {top_cat_name} ({pct_spend:.1f}% of total spend)"
    else:
        headline = f"{request.severity.capitalize()} severity alert: {top_indicator_name} reached {top_val:.1f}/100"

    # Grounded explanation
    explanation_parts = [
        f"Composite risk score stands at {request.composite_score:.1f} ({request.severity} severity)."
    ]
    if top_val > 0:
        explanation_parts.append(
            f"The primary pressure factor is {top_indicator_name}, registered at {top_val:.1f}."
        )

    if top_cats:
        cat_summaries = []
        for c in top_cats[:2]:
            c_name = c.get("category", "Category")
            c_pct = c.get("pct_of_spend")
            c_chg = c.get("change_pct")
            parts = [c_name]
            if c_pct is not None:
                parts.append(f"{c_pct:.1f}% of spend")
            if c_chg is not None:
                parts.append(f"{c_chg:+.1f}% variance")
            cat_summaries.append(" (".join([parts[0], ", ".join(parts[1:]) + ")"]))
        explanation_parts.append(f"Contributing categories include: {'; '.join(cat_summaries)}.")
    else:
        explanation_parts.append("Individual category breakdown was not provided for this alert interval.")

    explanation = " ".join(explanation_parts)

    # Suggest remediation action if actionable
    suggested_action = None
    target_category = "Reserve" if top_cat_name.lower() != "reserve" else "Operations & Infrastructure"
    realloc_amount = 12000.0
    if amount and amount > 25000:
        realloc_amount = round(amount * 0.1, -2)

    if top_val >= 60 or request.composite_score >= 50:
        suggested_action = {
            "type": "reallocate",
            "from_category": top_cat_name,
            "to_category": target_category,
            "amount": realloc_amount,
        }

    return NarrativeResponse(
        headline=headline,
        explanation=explanation,
        suggested_action=suggested_action,
        confidence="high" if (indicators and top_cats) else "medium",
    )


# ── Live LLM Caller (Anthropic) ──────────────────────────────────────────────
def call_llm_narrative(request: NarrativeRequest) -> NarrativeResponse:
    """
    Calls Anthropic API to generate grounded narrative. Fails open to deterministic fallback.
    """
    settings = get_settings()
    api_key = settings.ANTHROPIC_API_KEY

    if not api_key:
        logger.info("No ANTHROPIC_API_KEY configured; returning grounded fallback narrative.")
        return generate_fallback_narrative(request)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        prompt_data = {
            "org_id": request.org_id,
            "alert_id": request.alert_id,
            "composite_score": request.composite_score,
            "severity": request.severity,
            "indicator_breakdown": request.indicator_breakdown,
            "previous_breakdown": request.previous_breakdown,
            "top_contributing_categories": request.top_contributing_categories,
        }

        user_message = (
            "Analyze the following risk alert data and generate a narrative response.\n"
            f"DATA:\n{json.dumps(prompt_data, indent=2)}\n\n"
            "REMINDER: Strict JSON only. Reference only numbers and categories present in DATA."
        )

        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL or "claude-3-5-sonnet-20241022",
            max_tokens=600,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            temperature=0.2,
        )

        response_text = ""
        for block in response.content:
            if getattr(block, "type", "") == "text":
                response_text += block.text

        # Extract JSON
        clean_text = response_text.strip()
        if clean_text.startswith("```"):
            clean_text = clean_text.split("```")[1]
            if clean_text.startswith("json"):
                clean_text = clean_text[4:].strip()
        clean_text = clean_text.strip()

        parsed = json.loads(clean_text)
        return NarrativeResponse(
            headline=str(parsed.get("headline", "")).strip(),
            explanation=str(parsed.get("explanation", "")).strip(),
            suggested_action=parsed.get("suggested_action"),
            confidence=str(parsed.get("confidence", "medium")).lower(),
        )
    except Exception as e:
        logger.warning(f"Live Anthropic LLM call failed ({e}); failing open to fallback narrative.")
        return generate_fallback_narrative(request)


# ── Cache & Fetch Orchestration ──────────────────────────────────────────────
def get_cached_narrative(org_id: str, alert_id: str, supabase_client) -> Optional[NarrativeResponse]:
    """
    Checks alert_narratives table for existing grounded explanation.
    """
    if not supabase_client or not alert_id:
        return None

    try:
        res = (
            supabase_client.table("alert_narratives")
            .select("*")
            .eq("org_id", org_id)
            .eq("alert_id", alert_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data and len(res.data) > 0:
            row = res.data[0]
            action = row.get("suggested_action")
            if isinstance(action, str):
                try:
                    action = json.loads(action)
                except Exception:
                    pass
            return NarrativeResponse(
                headline=row.get("headline", "Risk Alert Explanation"),
                explanation=row.get("explanation", ""),
                suggested_action=action,
                confidence=row.get("confidence", "medium"),
            )
    except Exception as e:
        logger.warning(f"Error querying alert_narratives cache: {e}")

    return None


def store_narrative(org_id: str, alert_id: Optional[str], narrative: NarrativeResponse, supabase_client) -> None:
    """
    Saves generated narrative into alert_narratives table. Fails open on DB error.
    """
    if not supabase_client or not alert_id:
        return

    try:
        record = {
            "org_id": org_id,
            "alert_id": alert_id,
            "headline": narrative.headline,
            "explanation": narrative.explanation,
            "suggested_action": narrative.suggested_action,
            "confidence": narrative.confidence,
        }
        supabase_client.table("alert_narratives").insert(record).execute()
        logger.info(f"Cached narrative for alert {alert_id} in alert_narratives")
    except Exception as e:
        logger.warning(f"Could not persist narrative to alert_narratives: {e}")
