import logging
import time
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.config import get_settings
from app.supabase_client import get_service_client
import app.ml_inference as ml_inference
from app.db import init_db

from app.routes import budget, risk, ml, auth, data, analysis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Financial Intelligence Suite v1.1.0...")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    try:
        init_db()
        logger.info("✓ Persistent database initialized (SQLite: finsight.db)")
    except Exception as e:
        logger.error(f"✗ Failed to initialize database: {e}")

    try:
        supabase = get_service_client()
        if supabase:
            logger.info("✓ Supabase service client initialized")
            ml_inference.load_model(supabase)
            logger.info("✓ ML inference module loaded")
        else:
            logger.info("✓ Operating with local persistent database engine")
    except Exception as e:
        logger.warning(f"⚠ Startup dependency issue: {e}")

    logger.info("✓ Budget optimization engine ready (scipy SLSQP)")
    logger.info("✓ Risk scoring engine ready (5-indicator composite)")
    logger.info("✓ API routes registered: auth, budget, risk, ml")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    yield
    logger.info("Shutting down FinSight Suite backend...")


app = FastAPI(
    title="FinSight Suite API",
    version="1.1.0",
    description="""
# Financial Intelligence Suite API

Budget optimization, real-time risk scoring, and ML-powered forecasting backend.

## Core Engines
- **Budget Optimizer**: SLSQP constrained optimization (scipy.optimize.minimize)
- **Risk Scorer**: 5-indicator weighted composite with automatic alert generation
- **ML Inference**: XGBoost spend forecasting with versioned artifact management

## Authentication
All `/budget/*`, `/risk/*`, `/ml/*` endpoints require a valid Supabase JWT in the Authorization header:
```
Authorization: Bearer <access_token>
```
    """,
    lifespan=lifespan,
    contact={
        "name": "FinSight Suite Engineering",
        "url": "https://github.com/finsight-suite",
    },
    license_info={
        "name": "MIT License",
    },
    tags_metadata=[
        {
            "name": "Health",
            "description": "Service health and status endpoints",
        },
        {
            "name": "Budget",
            "description": "Budget optimization, recommendations, and priority management",
        },
        {
            "name": "Risk",
            "description": "Risk dashboard, alerts, and indicator ingestion",
        },
        {
            "name": "ML",
            "description": "ML model registry, inference, and version activation",
        },
    ],
)

settings = get_settings()

# ── CORS ──────────────────────────────────────────────────────────────────────
cors_origins = [
    origin.strip()
    for origin in settings.CORS_ORIGINS.split(",")
    if origin.strip()
]
# Always include common local dev origins for hackathon/demo purposes
dev_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]
for o in dev_origins:
    if o not in cors_origins:
        cors_origins.append(o)

logger.info(f"CORS origins ({len(cors_origins)}): {', '.join(cors_origins[:5])}{'...' if len(cors_origins) > 5 else ''}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
    max_age=3600,
)


# ── Request ID + timing middleware ───────────────────────────────────────────
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as e:
        logger.exception(f"Unhandled exception in {request.method} {request.url.path}: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "code": "internal_server_error",
                "message": "An unexpected error occurred. Our team has been notified.",
                "path": request.url.path,
            },
        )
    process_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Response-Time"] = f"{process_ms:.2f}ms"
    # Slow request warning log
    if process_ms > 1500:
        logger.warning(f"⚠ Slow request: {request.method} {request.url.path} took {process_ms:.0f}ms")
    return response


# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(budget.router)
app.include_router(risk.router)
app.include_router(ml.router)
app.include_router(data.router)
app.include_router(analysis.router)


# ── Health & status ──────────────────────────────────────────────────────────
@app.get("/", tags=["Health"], summary="Health check")
def health_check():
    """
    Basic liveness probe. Returns service identity and status.
    """
    return {
        "status": "ok",
        "service": "finsight-suite-api",
        "version": "1.1.0",
        "engines": {
            "budget_optimizer": "SLSQP (scipy)",
            "risk_scorer": "weighted-composite-v1",
            "ml_backend": "xgb+sklearn",
        },
    }


@app.get("/status", tags=["Health"], summary="Detailed service status")
def detailed_status():
    """
    More detailed status including dependency connectivity checks where available.
    """
    sb = get_service_client()
    supabase_ok = False
    try:
        if sb:
            # Lightweight connectivity check
            sb.table("budget_categories").select("count", count="exact").limit(1).execute()
            supabase_ok = True
    except Exception:
        supabase_ok = False

    return {
        "status": "ok" if supabase_ok else "degraded",
        "version": "1.1.0",
        "dependencies": {
            "supabase": "connected" if supabase_ok else "disconnected (demo mode)",
            "redis": "not_checked",
            "celery_workers": "not_checked",
            "ml_model_loaded": ml_inference.is_model_loaded(),
        },
        "mode": "full" if supabase_ok else "demo_fallback",
    }


# ── Global error handler overrides ───────────────────────────────────────────
@app.exception_handler(422)
async def validation_exception_handler(request: Request, exc):
    # Keep default pydantic validation format but make it a touch nicer
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "code": "validation_failed",
            "message": "Request validation failed. See errors for details.",
            "errors": exc.errors(),
        },
    )
