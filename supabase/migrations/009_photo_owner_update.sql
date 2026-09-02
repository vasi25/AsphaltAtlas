-- The original schema let route owners INSERT and DELETE their photos,
-- but never UPDATE them (needed for the new route-edit page to change
-- cover photo / ordering on an existing route).
CREATE POLICY "Route owners can update their photos"
    ON photos FOR UPDATE USING (auth.uid() = user_id);
