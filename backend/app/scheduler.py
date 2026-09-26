import logging
import datetime

logger = logging.getLogger(__name__)

celery_app = None

def get_celery_app():
    global celery_app
    if celery_app is not None:
        return celery_app
    try:
        from celery import Celery
        from celery.schedules import crontab
        from app.config import get_settings

        settings = get_settings()
        celery_app = Celery(
            "finsight_scheduler",
            broker=settings.REDIS_URL,
            backend=settings.REDIS_URL
        )
        celery_app.conf.beat_schedule = {
            'recalculate-risk-scores-nightly': {
                'task': 'app.scheduler.recalculate_risk_scores',
                'schedule': crontab(hour=0, minute=0),
            },
            'refresh-budget-recommendations-nightly': {
                'task': 'app.scheduler.refresh_budget_recommendations',
                'schedule': crontab(hour=0, minute=30),
            },
        }
        return celery_app
    except Exception as e:
        logger.warning(f"Celery/Redis not available: {e}. Scheduled tasks disabled.")
        return None

def recalculate_risk_scores():
    from app.supabase_client import get_service_client
    from app.risk_scorer import calculate_risk_score

    supabase = get_service_client()
    if not supabase:
        return "Supabase not configured"

    period = datetime.datetime.now().strftime("%Y-%m")
    res = supabase.table("risk_indicators").select("org_id").execute()
    orgs = set(r["org_id"] for r in res.data)

    for org_id in orgs:
        calculate_risk_score(org_id, period, supabase)
    return f"Calculated for {len(orgs)} orgs"

def refresh_budget_recommendations():
    from app.supabase_client import get_service_client
    from app.optimizer import run_optimization

    supabase = get_service_client()
    if not supabase:
        return "Supabase not configured"

    period = datetime.datetime.now().strftime("%Y-%m")
    res = supabase.table("budget_categories").select("org_id").execute()
    orgs = set(r["org_id"] for r in res.data)

    for org_id in orgs:
        try:
            total_budget = 100000.0
            run_optimization(org_id, total_budget, period, "balanced", supabase)
        except Exception:
            pass
    return f"Refreshed for {len(orgs)} orgs"
