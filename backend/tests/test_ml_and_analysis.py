import pytest
import os
import json
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient

from app.ml_forecaster import forecast_category, forecast_all_categories, train_forecaster
from app.routes.data import SAMPLE_CSV_CONTENT
from main import app

client = TestClient(app)


def test_feature_engineering_has_no_data_leakage():
    """
    Verify that features for predicting month T do NOT contain month T's actual spending.
    """
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml_training"))
    features_csv = os.path.join(base_dir, "data", "processed_features.csv")
    raw_csv = os.path.join(base_dir, "data", "financial_data.csv")

    assert os.path.isfile(features_csv), "processed_features.csv must exist"
    df_feat = pd.read_csv(features_csv)
    df_raw = pd.read_csv(raw_csv)

    # Pick Engineering category
    eng_raw = df_raw[df_raw["category"] == "Engineering"].sort_values(by="period").reset_index(drop=True)
    eng_feat = df_feat[df_feat["category"] == "Engineering"].sort_values(by="period").reset_index(drop=True)

    # For any period T in features, amount_lag_1 must equal amount at T-1, NOT T
    for i in range(1, min(5, len(eng_feat))):
        period_t = eng_feat.iloc[i]["period"]
        raw_idx = eng_raw[eng_raw["period"] == period_t].index[0]
        
        target_amount = eng_feat.iloc[i]["amount"]
        lag1_amount = eng_feat.iloc[i]["amount_lag_1"]
        raw_previous_amount = eng_raw.iloc[raw_idx - 1]["amount"]
        raw_current_amount = eng_raw.iloc[raw_idx]["amount"]

        assert round(lag1_amount, 2) == round(raw_previous_amount, 2), "amount_lag_1 must be T-1 amount"
        assert round(lag1_amount, 2) != round(raw_current_amount, 2) or abs(raw_previous_amount - raw_current_amount) < 1e-4

        # Verify rolling 3m average does NOT equal target or include target
        rolling_3m = eng_feat.iloc[i]["rolling_3m_avg"]
        expected_3m = eng_raw.iloc[max(0, raw_idx-3):raw_idx]["amount"].mean()
        assert abs(rolling_3m - expected_3m) < 1.0, "rolling_3m_avg must average strictly prior months"


def test_category_forecast_returns_previous_spending_and_prediction():
    res = forecast_category("Engineering")
    assert res["category"] == "Engineering"
    assert res["algorithm"] == "XGBoost Regression"
    assert len(res["previous_spending"]) >= 3
    assert res["predicted_amount"] > 0
    assert "formatted_prediction" in res
    assert "₹" in res["formatted_prediction"]
    assert "features_used" in res
    assert res["features_used"]["data_leakage"] == "None (features computed strictly from previous months)"


def test_forecast_all_categories():
    res = forecast_all_categories()
    assert res["algorithm"] == "XGBoost Regression"
    assert res["total_predicted_spend"] > 0
    assert len(res["categories"]) >= 5


def test_data_sample_csv_endpoint():
    res = client.get("/data/sample-csv")
    assert res.status_code == 200
    assert "date,category,amount,roi" in res.text
    assert "Marketing" in res.text
    assert "Engineering" in res.text


def test_csv_upload_and_retrain():
    csv_payload = {
        "csv_text": "date,category,amount,roi\n2026-01,Marketing,200000,1.4\n2026-01,Engineering,350000,1.65\n2026-02,Marketing,200000,1.4\n2026-02,Engineering,350000,1.65",
        "org_id": "org-test-isolated"
    }
    res = client.post("/data/upload-csv", json=csv_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["rows_ingested"] == 4
    assert "Engineering" in data["categories_updated"]


def test_generate_financial_analysis_pipeline():
    payload = {
        "total_budget": 1000000,
        "scenario_type": "balanced",
        "locked_categories": {"Engineering": 300000}
    }
    res = client.post("/analysis/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "forecast" in data
    assert "budget" in data
    assert "risk" in data
    assert "summary" in data

    # Check budget locked category preservation
    recs = data["budget"]["recommendations"]
    eng_rec = next(r for r in recs if r["category"] == "Engineering")
    assert eng_rec["recommended_budget"] == 300000.0
    assert eng_rec["is_locked"] is True

    # Check sum of budget equals total budget
    total_rec = sum(r["recommended_budget"] for r in recs)
    assert abs(total_rec - 1000000.0) < 1.0

    # Check risk score
    assert data["risk"]["composite_score"] > 0
    assert "breakdown" in data["risk"]
    assert "liquidity" in data["risk"]["breakdown"]
