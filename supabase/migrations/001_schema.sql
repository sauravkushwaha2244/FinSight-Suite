-- ============================================
-- Financial Intelligence Suite — Schema
-- ============================================

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    fiscal_year_start INT DEFAULT 1 CHECK (fiscal_year_start BETWEEN 1 AND 12),
    currency TEXT DEFAULT 'INR',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Users (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Budget Categories
CREATE TABLE IF NOT EXISTS budget_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    min_spend NUMERIC DEFAULT 0,
    max_spend NUMERIC,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Historical Spend
CREATE TABLE IF NOT EXISTS historical_spend (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period TEXT NOT NULL, -- e.g. '2025-01', '2025-Q1'
    amount NUMERIC NOT NULL DEFAULT 0,
    actual_roi NUMERIC, -- measured ROI / output for this category-period
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Business Priorities
CREATE TABLE IF NOT EXISTS business_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    priority_name TEXT NOT NULL,
    weight NUMERIC NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Budget Recommendations
CREATE TABLE IF NOT EXISTS budget_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
    current_budget NUMERIC NOT NULL DEFAULT 0,
    recommended_budget NUMERIC NOT NULL DEFAULT 0,
    projected_impact NUMERIC,
    confidence NUMERIC,
    scenario_type TEXT DEFAULT 'balanced' CHECK (scenario_type IN ('conservative', 'balanced', 'aggressive')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Risk Indicators
CREATE TABLE IF NOT EXISTS risk_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    indicator_type TEXT NOT NULL, -- liquidity, budget_variance, vendor_concentration, forecast_deviation, volatility
    category TEXT,
    value NUMERIC NOT NULL,
    period TEXT NOT NULL,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Risk Scores
CREATE TABLE IF NOT EXISTS risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    composite_score NUMERIC NOT NULL,
    breakdown_json JSONB NOT NULL DEFAULT '{}',
    severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Risk Alerts
CREATE TABLE IF NOT EXISTS risk_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    indicator_id UUID REFERENCES risk_indicators(id) ON DELETE SET NULL,
    threshold_breached TEXT,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. ML Models
CREATE TABLE IF NOT EXISTS ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL UNIQUE,
    trained_at TIMESTAMPTZ DEFAULT now(),
    metrics_json JSONB DEFAULT '{}',
    storage_path TEXT NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. ML Predictions
CREATE TABLE IF NOT EXISTS ml_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES ml_models(id) ON DELETE CASCADE,
    target TEXT NOT NULL,
    prediction NUMERIC NOT NULL,
    confidence NUMERIC,
    period TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_budget_categories_org ON budget_categories(org_id);
CREATE INDEX idx_historical_spend_org ON historical_spend(org_id, period);
CREATE INDEX idx_historical_spend_cat ON historical_spend(category_id);
CREATE INDEX idx_business_priorities_org ON business_priorities(org_id, period);
CREATE INDEX idx_budget_recommendations_org ON budget_recommendations(org_id, period);
CREATE INDEX idx_risk_indicators_org ON risk_indicators(org_id, period);
CREATE INDEX idx_risk_scores_org ON risk_scores(org_id, period);
CREATE INDEX idx_risk_alerts_org ON risk_alerts(org_id, acknowledged);
CREATE INDEX idx_ml_predictions_org ON ml_predictions(org_id, period);

-- ============================================
-- Row-Level Security
-- ============================================

-- Helper: get current user's org_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT role = 'admin' FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_predictions ENABLE ROW LEVEL SECURITY;

-- Organizations: members can read their own org
CREATE POLICY org_select ON organizations FOR SELECT USING (id = get_user_org_id());

-- Users: members can read their own org's users
CREATE POLICY users_select ON users FOR SELECT USING (org_id = get_user_org_id());

-- Budget Categories: read for all members, write for admin
CREATE POLICY cat_select ON budget_categories FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY cat_insert ON budget_categories FOR INSERT WITH CHECK (org_id = get_user_org_id() AND is_admin());
CREATE POLICY cat_update ON budget_categories FOR UPDATE USING (org_id = get_user_org_id() AND is_admin());
CREATE POLICY cat_delete ON budget_categories FOR DELETE USING (org_id = get_user_org_id() AND is_admin());

-- Historical Spend: read all members, write admin
CREATE POLICY hs_select ON historical_spend FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY hs_insert ON historical_spend FOR INSERT WITH CHECK (org_id = get_user_org_id() AND is_admin());

-- Business Priorities: read all, write admin
CREATE POLICY bp_select ON business_priorities FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY bp_insert ON business_priorities FOR INSERT WITH CHECK (org_id = get_user_org_id() AND is_admin());
CREATE POLICY bp_update ON business_priorities FOR UPDATE USING (org_id = get_user_org_id() AND is_admin());

-- Budget Recommendations: read all members
CREATE POLICY br_select ON budget_recommendations FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY br_insert ON budget_recommendations FOR INSERT WITH CHECK (org_id = get_user_org_id());

-- Risk tables: read all members, ingest for admin
CREATE POLICY ri_select ON risk_indicators FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY ri_insert ON risk_indicators FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY rs_select ON risk_scores FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY rs_insert ON risk_scores FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY ra_select ON risk_alerts FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY ra_insert ON risk_alerts FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY ra_update ON risk_alerts FOR UPDATE USING (org_id = get_user_org_id());

-- ML Models: public read (no org scoping), admin write
CREATE POLICY ml_select ON ml_models FOR SELECT USING (true);
CREATE POLICY ml_insert ON ml_models FOR INSERT WITH CHECK (is_admin());
CREATE POLICY ml_update ON ml_models FOR UPDATE USING (is_admin());

-- ML Predictions: org-scoped read
CREATE POLICY mlp_select ON ml_predictions FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY mlp_insert ON ml_predictions FOR INSERT WITH CHECK (org_id = get_user_org_id());

-- ============================================
-- Realtime (for risk alerts)
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE risk_alerts;
