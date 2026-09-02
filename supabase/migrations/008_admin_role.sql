-- ============================================================
-- ADMIN ROLE
-- Adds a role column to profiles (rather than a boolean flag,
-- so we can introduce more roles later without a schema change).
-- ============================================================

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin'));

-- Promote the initial admin account
UPDATE profiles SET role = 'admin' WHERE username = 'vasi_eos';


-- Helper to check the current user's role from within RLS policies.
-- SECURITY DEFINER so it can read profiles without recursing through
-- the profiles table's own RLS policies.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;


-- ============================================================
-- RLS — admin override
-- Existing owner-only policies are left as-is; these are additive
-- policies (RLS policies are OR'd together) that grant admins the
-- same access across every route and everything attached to it.
-- ============================================================

-- routes
CREATE POLICY "Admins can view all routes"
    ON routes FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update any route"
    ON routes FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete any route"
    ON routes FOR DELETE USING (public.is_admin());

-- route_geometry
CREATE POLICY "Admins can insert any route geometry"
    ON route_geometry FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update any route geometry"
    ON route_geometry FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete any route geometry"
    ON route_geometry FOR DELETE USING (public.is_admin());

-- photos
CREATE POLICY "Admins can update any photo"
    ON photos FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete any photo"
    ON photos FOR DELETE USING (public.is_admin());

-- route_categories
CREATE POLICY "Admins can insert any route category"
    ON route_categories FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete any route category"
    ON route_categories FOR DELETE USING (public.is_admin());

-- reviews
CREATE POLICY "Admins can update any review"
    ON reviews FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete any review"
    ON reviews FOR DELETE USING (public.is_admin());

-- questions / question_answers (moderation)
CREATE POLICY "Admins can delete any question"
    ON questions FOR DELETE USING (public.is_admin());
CREATE POLICY "Admins can delete any answer"
    ON question_answers FOR DELETE USING (public.is_admin());
