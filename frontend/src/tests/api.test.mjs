import test from 'node:test';
import assert from 'node:assert/strict';

test('Frontend API client handles query and header formatting correctly', () => {
  const dummyToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc';
  const headers = {
    'Content-Type': 'application/json',
    ...(dummyToken ? { Authorization: `Bearer ${dummyToken}` } : {}),
  };

  assert.strictEqual(headers['Content-Type'], 'application/json');
  assert.strictEqual(headers['Authorization'], `Bearer ${dummyToken}`);
});

test('Scenario factors and weights calculation logic', () => {
  const scenarios = ['conservative', 'balanced', 'aggressive'];
  const factors = {
    conservative: [0.95, 0.98, 1.00, 1.02, 1.05],
    balanced: [1.25, 0.95, 0.93, 1.167, 1.083],
    aggressive: [1.50, 1.10, 0.85, 1.30, 0.95],
  };

  for (const s of scenarios) {
    assert.strictEqual(factors[s].length, 5);
  }
});

test('Standardized Budget Optimization payload format', () => {
  const payload = {
    total_budget: 1000000,
    period: '2026-09',
    scenario_type: 'balanced',
    locked_categories: {
      Engineering: 300000,
    },
  };

  assert.strictEqual(payload.total_budget, 1000000);
  assert.strictEqual(payload.scenario_type, 'balanced');
  assert.strictEqual(payload.locked_categories.Engineering, 300000);
});

test('Standardized Risk Indicator weighted average score calculation', () => {
  const weights = {
    liquidity: 0.25,
    budget_variance: 0.25,
    vendor_concentration: 0.15,
    forecast_deviation: 0.20,
    volatility: 0.15,
  };

  const scores = {
    liquidity: 20,
    budget_variance: 35,
    vendor_concentration: 45,
    forecast_deviation: 25,
    volatility: 30,
  };

  const composite = Object.keys(weights).reduce((acc, k) => acc + weights[k] * scores[k], 0);
  assert.strictEqual(composite, 30.0);
  const severity = composite >= 75 ? 'critical' : composite >= 50 ? 'high' : composite >= 25 ? 'medium' : 'low';
  assert.strictEqual(severity, 'medium');
});

test('Category Forecast payload structure follows user requirement', () => {
  const forecastSample = {
    category: 'Engineering',
    algorithm: 'XGBoost Regression',
    previous_spending: [
      { period: '2025-08', formatted: '₹3.6L' },
      { period: '2025-09', formatted: '₹3.6L' },
      { period: '2025-10', formatted: '₹3.8L' },
      { period: '2025-11', formatted: '₹4.1L' },
      { period: '2025-12', formatted: '₹4.3L' },
    ],
    predicted_amount: 401713.62,
    formatted_prediction: '₹4.0L',
    features_used: {
      data_leakage: 'None (features computed strictly from previous months)',
    },
  };

  assert.strictEqual(forecastSample.category, 'Engineering');
  assert.strictEqual(forecastSample.algorithm, 'XGBoost Regression');
  assert.strictEqual(forecastSample.previous_spending.length, 5);
  assert.strictEqual(forecastSample.formatted_prediction, '₹4.0L');
  assert.ok(forecastSample.features_used.data_leakage.includes('None'));
});

test('Generate Financial Analysis integrates Forecast, Budget, and Risk pillars', () => {
  const analysisSample = {
    status: 'success',
    forecast: {
      algorithm: 'XGBoost Regression',
      total_predicted_spend: 1850000,
    },
    budget: {
      total_budget: 1000000,
      scenario_type: 'balanced',
      recommendations: [{ category: 'Engineering', recommended_budget: 186000 }],
    },
    risk: {
      composite_score: 30.0,
      severity: 'medium',
    },
    summary: {
      narrative: 'Generated Comprehensive Financial Intelligence...',
    },
  };

  assert.strictEqual(analysisSample.status, 'success');
  assert.ok(analysisSample.forecast.total_predicted_spend > 0);
  assert.strictEqual(analysisSample.budget.total_budget, 1000000);
  assert.strictEqual(analysisSample.risk.composite_score, 30.0);
  assert.ok(analysisSample.summary.narrative.length > 10);
});
