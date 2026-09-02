-- ============================================================
-- MODERATION — pending review queue + user reports
-- ============================================================

-- Route moderation status. New routes from standard users start out
-- 'pending' (hidden from Explore until an admin approves them, via the
-- existing "Published routes are viewable by everyone" is_published
-- policy); admin-authored routes are auto-approved on insert (handled
-- client-side). 'rejected' routes stay hidden but keep the record
-- instead of silently deleting user content.
ALTER TABLE routes
    ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (moderation_status IN ('pending', 'approved', 'rejected'));

-- Backfill: every route that already existed was already publicly
-- visible, so treat it as approved rather than dropping it into the
-- new pending queue.
UPDATE routes SET moderation_status = 'approved' WHERE is_published = true;


-- ============================================================
-- REPORTS
-- A user flagging another user's route for admin review.
-- ============================================================
CREATE TABLE reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id    UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_route_id ON reports(route_id);
CREATE INDEX idx_reports_status   ON reports(status);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- A user can report any route as long as it isn't their own
CREATE POLICY "Users can report routes they don't own"
    ON reports FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND auth.uid() <> (SELECT user_id FROM routes WHERE id = route_id)
    );

-- Reporters can see their own reports (lets the UI show "already reported")
CREATE POLICY "Users can view their own reports"
    ON reports FOR SELECT USING (auth.uid() = user_id);

-- Admins moderate reports
CREATE POLICY "Admins can view all reports"
    ON reports FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update any report"
    ON reports FOR UPDATE USING (public.is_admin());
