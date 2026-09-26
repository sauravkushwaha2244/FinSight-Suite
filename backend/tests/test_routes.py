import pytest
from fastapi.testclient import TestClient
from main import app
from app.db import init_db

client = TestClient(app)

@pytest.fixture(scope="module")
def auth_header():
    init_db()
    # Log in as default admin
    resp = client.post("/auth/login", json={"email": "admin@finsight.com", "password": "admin123"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_budget_optimize_endpoint(auth_header):
    resp = client.post(
        "/budget/optimize",
        headers=auth_header,
        json={
            "total_budget": 1200000,
            "scenario_type": "balanced",
            "period": "Q4 2026",
            "constraints": [{"category": "Marketing & Advertising", "exact": 220000}]
        }
    )
    assert resp.status_code == 200, f"Optimize failed: {resp.text}"
    data = resp.json()
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0

def test_budget_simulate_endpoint(auth_header):
    resp = client.post(
        "/budget/simulate",
        headers=auth_header,
        json={
            "proposed_change": {
                "from_category": "Marketing & Advertising",
                "to_category": "Reserve Cushion",
                "amount": 20000
            },
            "scenario": "balanced"
        }
    )
    assert resp.status_code == 200, f"Simulate failed: {resp.text}"
    data = resp.json()
    assert data["feasible"] is True
    assert "current_score" in data
    assert "projected_score" in data

def test_budget_priorities_validation(auth_header):
    # Sum != 100 should fail
    resp = client.post(
        "/budget/priorities",
        headers=auth_header,
        json={
            "period": "Q4 2026",
            "priorities": [
                {"priority_name": "Growth", "weight": 50},
                {"priority_name": "Stability", "weight": 20}
            ]
        }
    )
    assert resp.status_code == 400

    # Sum == 100 should succeed
    resp2 = client.post(
        "/budget/priorities",
        headers=auth_header,
        json={
            "period": "Q4 2026",
            "priorities": [
                {"priority_name": "Growth", "weight": 60},
                {"priority_name": "Stability", "weight": 40}
            ]
        }
    )
    assert resp2.status_code == 200

def test_risk_dashboard_endpoint(auth_header):
    resp = client.get("/risk/dashboard", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert "overall_score" in data
    assert "severity" in data

def test_risk_alerts_endpoint(auth_header):
    resp = client.get("/risk/alerts", headers=auth_header)
    assert resp.status_code == 200
    alerts = resp.json()
    assert isinstance(alerts, list)

def test_ml_models_endpoint(auth_header):
    resp = client.get("/ml/models", headers=auth_header)
    assert resp.status_code == 200
    models = resp.json()
    assert isinstance(models, list)
    assert len(models) > 0

def test_ml_predictions_endpoint(auth_header):
    resp = client.get("/ml/predictions/org-default", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert "predictions" in data
