import pytest
from app.risk_scorer import calculate_risk_score, WEIGHTS

def test_calculate_risk_score_no_indicators():
    class DummyQuery:
        def __init__(self, data):
            self.data = data
        def select(self, *args, **kwargs):
            return self
        def eq(self, *args, **kwargs):
            return self
        def execute(self):
            return self

    class MockSupabase:
        def table(self, name):
            return DummyQuery([])

    res = calculate_risk_score("org-test", "Q4 2026", MockSupabase())
    assert res["composite_score"] == 0
    assert res["severity"] == "low"
    assert res["alerts_generated"] == 0

def test_calculate_risk_score_with_indicators():
    saved_scores = []
    saved_alerts = []

    class DummyTable:
        def __init__(self, name):
            self.name = name
        def select(self, *args, **kwargs):
            return self
        def eq(self, *args, **kwargs):
            return self
        def execute(self):
            if self.name == "risk_indicators":
                return type("Res", (), {"data": [
                    {"indicator_type": "liquidity", "value": 30.0, "created_at": "2026-09-24T00:00:00Z", "id": 1},
                    {"indicator_type": "budget_variance", "value": 85.0, "created_at": "2026-09-24T00:00:00Z", "id": 2},
                    {"indicator_type": "vendor_concentration", "value": 90.0, "created_at": "2026-09-24T00:00:00Z", "id": 3},
                    {"indicator_type": "forecast_deviation", "value": 40.0, "created_at": "2026-09-24T00:00:00Z", "id": 4},
                    {"indicator_type": "volatility", "value": 75.0, "created_at": "2026-09-24T00:00:00Z", "id": 5},
                ]})()
            return type("Res", (), {"data": []})()
        def insert(self, record):
            if self.name == "risk_scores":
                saved_scores.append(record)
            elif self.name == "risk_alerts":
                saved_alerts.extend(record if isinstance(record, list) else [record])
            return self

    class MockSupabase:
        def table(self, name):
            return DummyTable(name)

    res = calculate_risk_score("org-test", "Q4 2026", MockSupabase())
    # liquidity value 30 -> normalized: max(0, 100 - 30) = 70.0
    # budget_variance value 85 -> 85.0 (exceeds 80 -> alert)
    # vendor_concentration value 90 -> 90.0 (exceeds 80 -> alert)
    # forecast_deviation value 40 -> 40.0
    # volatility value 75 -> 75.0
    # composite = 70*0.25 + 85*0.25 + 90*0.15 + 40*0.20 + 75*0.15
    # = 17.5 + 21.25 + 13.5 + 8.0 + 11.25 = 71.5
    assert res["composite_score"] == pytest.approx(71.5, 0.1)
    assert res["breakdown_json"]["liquidity"] == 70.0
    assert res["breakdown_json"]["budget_variance"] == 85.0
    assert res["breakdown_json"]["vendor_concentration"] == 90.0
    # composite 71.5 is > 70.0 -> composite alert generated + 2 indicator alerts
    assert res["alerts_generated"] >= 3
    assert len(saved_alerts) >= 3
