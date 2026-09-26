import pytest
from app.optimizer import simulate_reallocation, run_optimization

def test_simulate_reallocation_valid():
    proposed = {
        "from_category": "Marketing & Advertising",
        "to_category": "Reserve Cushion",
        "amount": 25000.0,
    }
    result = simulate_reallocation(org_id="org-default", proposed_change=proposed)
    assert result["feasible"] is True
    assert result["violation_reason"] is None
    assert result["projected_score"] < result["current_score"]
    assert result["score_delta"] < 0
    assert result["projected_allocation"]["Marketing & Advertising"] == 175000.0
    assert result["projected_allocation"]["Reserve Cushion"] == 25000.0

def test_simulate_reallocation_negative_or_zero():
    proposed = {
        "from_category": "Marketing & Advertising",
        "to_category": "Reserve Cushion",
        "amount": 0.0,
    }
    result = simulate_reallocation(org_id="org-default", proposed_change=proposed)
    assert result["feasible"] is False
    assert "greater than zero" in result["violation_reason"]

def test_simulate_reallocation_nonexistent_category():
    proposed = {
        "from_category": "Space Exploration Department",
        "to_category": "Reserve Cushion",
        "amount": 10000.0,
    }
    result = simulate_reallocation(org_id="org-default", proposed_change=proposed)
    assert result["feasible"] is False
    assert "not found" in result["violation_reason"]

def test_simulate_reallocation_locked_category():
    proposed = {
        "from_category": "Operations & Infrastructure",  # locked by default
        "to_category": "Marketing & Advertising",
        "amount": 10000.0,
    }
    result = simulate_reallocation(org_id="org-default", proposed_change=proposed)
    assert result["feasible"] is False
    assert "locked" in result["violation_reason"].lower()

def test_simulate_reallocation_min_spend_breach():
    proposed = {
        "from_category": "Marketing & Advertising",  # current 200k, min 100k
        "to_category": "Reserve Cushion",
        "amount": 150000.0,  # leaves 50k, which is < 100k min
    }
    result = simulate_reallocation(org_id="org-default", proposed_change=proposed)
    assert result["feasible"] is False
    assert "minimum spend threshold" in result["violation_reason"]

def test_simulate_reallocation_max_spend_breach():
    class DummyQuery:
        def __init__(self, data):
            self.data = data
        def select(self, *args, **kwargs):
            return self
        def eq(self, *args, **kwargs):
            return self
        def order(self, *args, **kwargs):
            return self
        def limit(self, *args, **kwargs):
            return self
        def execute(self):
            return self

    class MockClient:
        def table(self, name):
            if name == "budget_categories":
                return DummyQuery([
                    {"id": 1, "name": "Marketing & Advertising", "current_budget": 500000.0, "min_spend": 100000.0, "max_spend": 800000.0, "is_locked": False},
                    {"id": 2, "name": "HR & Administration", "current_budget": 200000.0, "min_spend": 50000.0, "max_spend": 250000.0, "is_locked": False},
                ])
            return DummyQuery([])

    proposed = {
        "from_category": "Marketing & Advertising",
        "to_category": "HR & Administration",
        "amount": 80000.0,  # HR becomes 280k > 250k ceiling, Marketing remains 420k > 100k min
    }
    result = simulate_reallocation(org_id="org-default", proposed_change=proposed, supabase_client=MockClient())
    assert result["feasible"] is False
    assert "maximum spend ceiling" in result["violation_reason"]

def test_run_optimization_scenarios():
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
            if name == "budget_categories":
                return DummyQuery([
                    {"id": 1, "name": "Marketing", "current_budget": 200000, "min_spend": 100000, "max_spend": 500000, "is_locked": False},
                    {"id": 2, "name": "R&D", "current_budget": 300000, "min_spend": 200000, "max_spend": 600000, "is_locked": False},
                    {"id": 3, "name": "Operations", "current_budget": 500000, "min_spend": 300000, "max_spend": 800000, "is_locked": True},
                ])
            elif name == "business_priorities":
                return DummyQuery([
                    {"priority_name": "Marketing", "weight": 40},
                    {"priority_name": "R&D", "weight": 40},
                    {"priority_name": "Operations", "weight": 20},
                ])
            return DummyQuery([])

    mock_client = MockSupabase()
    recs = run_optimization("org-default", 1000000.0, "Q4 2026", "balanced", mock_client)
    assert len(recs) == 3
    total_rec = sum(r["recommended_budget"] for r in recs)
    assert abs(total_rec - 1000000.0) < 1.0
    # Operations is locked at 500,000
    ops_rec = next(r for r in recs if r["category_name"] == "Operations")
    assert abs(ops_rec["recommended_budget"] - 500000.0) < 1.0

def test_run_optimization_with_exact_constraint():
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
            if name == "budget_categories":
                return DummyQuery([
                    {"id": 1, "name": "Marketing", "current_budget": 200000, "min_spend": 100000, "max_spend": 500000, "is_locked": False},
                    {"id": 2, "name": "R&D", "current_budget": 300000, "min_spend": 200000, "max_spend": 600000, "is_locked": False},
                    {"id": 3, "name": "Operations", "current_budget": 500000, "min_spend": 300000, "max_spend": 800000, "is_locked": False},
                ])
            elif name == "business_priorities":
                return DummyQuery([])
            return DummyQuery([])

    mock_client = MockSupabase()
    constraints = [{"category": "Marketing", "exact": 250000.0}]
    recs = run_optimization("org-default", 1000000.0, "Q4 2026", "balanced", mock_client, constraints=constraints)
    marketing_rec = next(r for r in recs if r["category_name"] == "Marketing")
    assert abs(marketing_rec["recommended_budget"] - 250000.0) < 1.0
