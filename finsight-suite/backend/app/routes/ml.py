import os
import json
import csv
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, FileResponse
from typing import List, Optional
from pydantic import BaseModel, Field
from app.auth import get_current_user, require_admin
from app.supabase_client import get_service_client
import app.ml_inference as ml_inference
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ml", tags=["ML"])

DEMO_MODELS = [
    {
        "id": "demo-m1",
        "version": "v2.4.1",
        "algorithm": "XGBoost",
        "trained_at": (datetime.utcnow() - timedelta(days=6)).isoformat() + "Z",
        "mae": 450.2, "rmse": 620.5, "r2": 0.942,
        "training_samples": 12840, "training_duration": "14m 32s", "features": 47,
        "is_active": True,
        "metrics_json": {"mae": 450.2, "rmse": 620.5, "r2": 0.942, "mape": 4.12},
    },
    {
        "id": "demo-m2",
        "version": "v2.3.0",
        "algorithm": "XGBoost",
        "trained_at": (datetime.utcnow() - timedelta(days=33)).isoformat() + "Z",
        "mae": 512.8, "rmse": 715.3, "r2": 0.921,
        "training_samples": 11620, "training_duration": "12m 08s", "features": 42,
        "is_active": False,
        "metrics_json": {"mae": 512.8, "rmse": 715.3, "r2": 0.921, "mape": 4.87},
    },
    {
        "id": "demo-m3",
        "version": "v2.1.0",
        "algorithm": "Gradient Boosting",
        "trained_at": (datetime.utcnow() - timedelta(days=81)).isoformat() + "Z",
        "mae": 602.1, "rmse": 835.7, "r2": 0.894,
        "training_samples": 9840, "training_duration": "9m 54s", "features": 38,
        "is_active": False,
        "metrics_json": {"mae": 602.1, "rmse": 835.7, "r2": 0.894, "mape": 5.93},
    },
    {
        "id": "demo-m4",
        "version": "v1.9.2",
        "algorithm": "Random Forest",
        "trained_at": (datetime.utcnow() - timedelta(days=119)).isoformat() + "Z",
        "mae": 785.4, "rmse": 1020.6, "r2": 0.841,
        "training_samples": 8420, "training_duration": "7m 18s", "features": 32,
        "is_active": False,
        "metrics_json": {"mae": 785.4, "rmse": 1020.6, "r2": 0.841, "mape": 7.21},
    },
]


def _local_model_registry():
    """Expose the locally trained artifact when Supabase registry is unavailable."""
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml_training"))
    metadata_path = os.path.join(base_dir, "models", "model_metadata.json")
    data_path = os.path.join(base_dir, "data", "financial_data.csv")

    if not os.path.isfile(metadata_path) or not os.path.isfile(data_path):
        return DEMO_MODELS

    try:
        with open(metadata_path, "r", encoding="utf-8") as file:
            metadata = json.load(file)
        with open(data_path, "r", encoding="utf-8", newline="") as file:
            training_samples = max(sum(1 for _ in csv.DictReader(file)), 0)
        metrics = metadata.get("metrics") or {}
        return [{
            "id": "local-spend-forecaster",
            "version": metadata.get("version", "local"),
            "algorithm": metadata.get("algorithm", "XGBoost"),
            "trained_at": metadata.get("trained_at"),
            "training_at": metadata.get("trained_at"),
            "mae": metrics.get("mae", 0),
            "rmse": metrics.get("rmse", 0),
            "r2": metrics.get("r2", 0),
            "training_samples": training_samples,
            "training_duration": "Local training",
            "features": len(metadata.get("features") or []),
            "is_active": True,
            "metrics_json": metrics,
            "training_data": "ml_training/data/financial_data.csv",
        }]
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
        logger.warning("Local model registry unavailable: %s", exc)
        return DEMO_MODELS


def _demo_predictions(org_id: str, horizon: int = 12):
    """Generate deterministic forecast series for demo purposes."""
    import math
    predictions = []
    base = 500_000
    for i in range(horizon):
        trend = 8_000 * i
        seasonal = 25_000 * math.sin(i * 0.52)
        predicted = round(base + trend + seasonal, -3)
        lower = round(predicted * 0.92, -3)
        upper = round(predicted * 1.08, -3)
        predictions.append({
            "id": f"pred-{org_id}-{i}",
            "org_id": org_id,
            "period": f"M{i+1}",
            "predicted_value": predicted,
            "lower_bound": lower,
            "upper_bound": upper,
            "confidence": 0.94,
            "model_version": "v2.4.1",
            "created_at": (datetime.utcnow() - timedelta(hours=horizon - i)).isoformat() + "Z",
        })
    return predictions


# ── Pydantic schemas ─────────────────────────────────────────────────────────
class ActivateModelRequest(BaseModel):
    model_id: Optional[str] = Field(default=None, description="DB id of the model record")
    version: Optional[str] = Field(default=None, description="Semantic version (v2.4.1)")


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.get("/predictions/{org_id}", summary="Forecast predictions for an organization")
def get_predictions(
    org_id: str,
    horizon: int = Query(12, ge=1, le=24, description="Number of periods to forecast"),
    user: dict = Depends(get_current_user),
):
    user_org = user.get("org_id") or "demo-org"
    if user_org and user_org != "demo-org" and org_id != user_org:
        raise HTTPException(status_code=403, detail="Not authorized to access predictions for this org")

    supabase = get_service_client()
    if not supabase:
        return {
            "mode": "demo",
            "org_id": org_id,
            "model_version": "v2.4.1",
            "horizon": horizon,
            "predictions": _demo_predictions(org_id, horizon=horizon),
        }

    try:
        res = (
            supabase.table("ml_predictions")
            .select("*")
            .eq("org_id", org_id)
            .order("created_at", desc=True)
            .limit(horizon * 5)
            .execute()
        )
        if res.data:
            return {"mode": "live", "org_id": org_id, "predictions": res.data}
        return {
            "mode": "demo_fallback",
            "org_id": org_id,
            "model_version": "v2.4.1",
            "predictions": _demo_predictions(org_id, horizon=horizon),
        }
    except Exception as e:
        logger.warning(f"predictions fetch failed, fallback: {e}")
        return {
            "mode": "demo_fallback",
            "org_id": org_id,
            "predictions": _demo_predictions(org_id, horizon=horizon),
        }


@router.post("/models/activate", summary="Promote a model version to active production")
def activate_model(
    request: ActivateModelRequest,
    user: dict = Depends(require_admin),
):
    """
    Activate a specific model by version or id. Deactivates all other versions.
    """
    identifier = request.model_id or request.version
    if not identifier:
        raise HTTPException(status_code=400, detail="Either model_id or version is required")

    supabase = get_service_client()
    if not supabase:
        # Demo: toggle the in-memory list
        global DEMO_MODELS
        DEMO_MODELS = [
            {**m, "is_active": (request.version and m["version"] == request.version) or
                         (request.model_id and m["id"] == request.model_id)}
            for m in DEMO_MODELS
        ]
        active = next((m for m in DEMO_MODELS if m["is_active"]), None)
        return {"mode": "demo", "activated": identifier, "active_model": active}

    try:
        supabase.table("ml_models").update({"is_active": False}).neq("version", "").execute()
        q = supabase.table("ml_models").update({"is_active": True})
        if request.model_id:
            q = q.eq("id", request.model_id)
        else:
            q = q.eq("version", request.version)
        res = q.execute()

        if not res.data:
            raise HTTPException(status_code=404, detail="Model version not found")

        try:
            ml_inference.load_model(supabase)
        except Exception:
            logger.warning("Model reload skipped after activation")
        return {"mode": "live", "activated": identifier, "active_model": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"activate_model failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models", summary="List model versions in registry")
def list_models(user: dict = Depends(get_current_user)):
    supabase = get_service_client()
    if not supabase:
        return _local_model_registry()

    try:
        res = (
            supabase.table("ml_models")
            .select("*")
            .order("trained_at", desc=True)
            .execute()
        )
        if res.data:
            # Normalize flat metrics fields into frontend-friendly columns
            out = []
            for m in res.data:
                metrics = m.get("metrics_json") or {}
                out.append({
                    **m,
                    "mae": m.get("mae") or metrics.get("mae", 0),
                    "rmse": m.get("rmse") or metrics.get("rmse", 0),
                    "r2": m.get("r2") or metrics.get("r2", 0),
                })
            return out
        return _local_model_registry()
    except Exception as e:
        logger.warning(f"list_models failed, fallback: {e}")
        return _local_model_registry()


@router.get("/models/{model_id}/download", summary="Download a model artifact")
def download_model(model_id: str, user: dict = Depends(get_current_user)):
    """Download a registered model artifact or the local demo artifact."""
    supabase = get_service_client()
    if supabase:
        try:
            record = (
                supabase.table("ml_models")
                .select("id,version,storage_path")
                .eq("id", model_id)
                .limit(1)
                .execute()
            )
            if not record.data or not record.data[0].get("storage_path"):
                raise HTTPException(status_code=404, detail="Model artifact not found")
            model = record.data[0]
            artifact = supabase.storage.from_("ml-models").download(model["storage_path"])
            return Response(
                content=artifact,
                media_type="application/octet-stream",
                headers={"Content-Disposition": f'attachment; filename="{model["version"]}.pkl"'},
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Model download failed: {e}")
            raise HTTPException(status_code=500, detail="Unable to download model artifact")

    artifact_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml_training", "models", "spend_forecast_model.pkl")
    )
    if not os.path.isfile(artifact_path):
        raise HTTPException(status_code=404, detail="Local model artifact is not available")
    return FileResponse(
        artifact_path,
        media_type="application/octet-stream",
        filename=f"{model_id}.pkl",
    )
