-- ============================================
-- Financial Intelligence Suite — Migration 002
-- Narrative Explanation & Alert Caching
-- ============================================

CREATE TABLE IF NOT EXISTS alert_narratives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES risk_alerts(id) ON DELETE CASCADE,
    headline TEXT NOT NULL,
    explanation TEXT NOT NULL,
    suggested_action JSONB,
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for cache lookups by (org_id, alert_id)
CREATE INDEX IF NOT EXISTS idx_alert_narratives_org_alert ON alert_narratives(org_id, alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_narratives_created ON alert_narratives(created_at DESC);

-- Row-Level Security
ALTER TABLE alert_narratives ENABLE ROW LEVEL SECURITY;

-- Org members can read narratives belonging to their organization
CREATE POLICY "org members can read their narratives"
    ON alert_narratives FOR SELECT
    USING (org_id = get_user_org_id() OR org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Org members can insert narratives
CREATE POLICY "org members can insert narratives"
    ON alert_narratives FOR INSERT
    WITH CHECK (org_id = get_user_org_id() OR org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
