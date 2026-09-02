-- Rejecting a pending route now deletes it outright instead of marking it
-- 'rejected' — there's no value in keeping a hidden, never-published route
-- around. Tighten the status values to match (no rows currently use
-- 'rejected', confirmed before writing this migration).
ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_moderation_status_check;
ALTER TABLE routes ADD CONSTRAINT routes_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved'));
