import os
import json
import joblib
import pandas as pd
import numpy as np

def test_ml_pipeline_artifacts():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml_training"))
    data_path = os.path.join(base_dir, "data", "processed_features.csv")
    model_path = os.path.join(base_dir, "models", "spend_forecast_model.pkl")
    scaler_path = os.path.join(base_dir, "models", "scaler.pkl")
    meta_path = os.path.join(base_dir, "models", "model_metadata.json")

    assert os.path.isfile(data_path), "processed_features.csv should exist"
    assert os.path.isfile(model_path), "spend_forecast_model.pkl should exist"
    assert os.path.isfile(scaler_path), "scaler.pkl should exist"
    assert os.path.isfile(meta_path), "model_metadata.json should exist"

    # Check processed features
    df = pd.read_csv(data_path)
    assert len(df) > 0
    assert "amount" in df.columns
    assert "rolling_3m_avg" in df.columns

    # Check model loading and inference
    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    with open(meta_path, "r") as f:
        meta = json.load(f)

    features = meta["features"]
    sample_row = df[features].iloc[:5]
    scaled_samples = scaler.transform(sample_row)
    preds = model.predict(scaled_samples)

    assert len(preds) == 5
    assert all(np.isfinite(preds))
    assert all(p > 0 for p in preds)
