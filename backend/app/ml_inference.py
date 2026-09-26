import joblib
import io
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)

_model = None
_model_version = None

def load_model(supabase_client):
    global _model, _model_version
    settings = get_settings()
    logger.info("Attempting to load active ML model")
    
    try:
        res = supabase_client.table("ml_models").select("*").eq("is_active", True).execute()
        if not res.data:
            logger.warning("No active model found in database.")
            _model = None
            _model_version = None
            return
            
        model_record = res.data[0]
        storage_path = model_record.get("storage_path")
        if not storage_path:
            logger.warning("Active model has no storage_path.")
            return
            
        # Download from storage
        bucket = settings.MODEL_BUCKET
        file_data = supabase_client.storage.from_(bucket).download(storage_path)
        
        # Load with joblib
        f = io.BytesIO(file_data)
        _model = joblib.load(f)
        _model_version = model_record.get("version")
        
        logger.info(f"Model version {_model_version} loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        _model = None
        _model_version = None

def predict(features: dict) -> dict:
    if _model is None:
        return {"error": "No active model loaded"}
        
    try:
        # Transform features to expected format (list of lists or array)
        # Assuming the model expects a 2D array and we have a dict of ordered features
        feature_values = [list(features.values())]
        
        prediction = _model.predict(feature_values)
        
        # If it's a classifier with predict_proba
        confidence = None
        if hasattr(_model, "predict_proba"):
            probs = _model.predict_proba(feature_values)
            confidence = float(max(probs[0]))
            
        return {
            "prediction": prediction.tolist() if hasattr(prediction, "tolist") else float(prediction[0]),
            "confidence": confidence,
            "model_version": _model_version
        }
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise ValueError(f"Failed to generate prediction: {e}")

def get_model_info() -> dict:
    if _model is None:
        return {"status": "inactive", "message": "No model is active"}
    return {
        "status": "active",
        "version": _model_version
    }

def is_model_loaded() -> bool:
    """Return True if a production .pkl model is loaded in memory."""
    return _model is not None
