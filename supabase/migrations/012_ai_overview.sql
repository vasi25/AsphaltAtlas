-- Persist the last AI Overview verdict on the route itself, so admins see
-- the previous result on page refresh instead of needing to re-run it
-- (each run costs real API tokens).
ALTER TABLE routes
    ADD COLUMN IF NOT EXISTS ai_overview JSONB,
    ADD COLUMN IF NOT EXISTS ai_overview_checked_at TIMESTAMPTZ;
