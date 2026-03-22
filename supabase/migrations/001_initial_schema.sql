-- ============================================================
-- AsphaltAtlas — Initial Schema
-- ============================================================

-- Enable PostGIS for geographic data (route paths, points)
CREATE EXTENSION IF NOT EXISTS postgis;


-- ============================================================
-- PROFILES
-- Extends Supabase auth.users with public profile info
-- ============================================================
CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username    TEXT UNIQUE NOT NULL,
    full_name   TEXT,
    avatar_url  TEXT,
    bio         TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- COUNTRIES
-- ============================================================
CREATE TABLE countries (
    id      SERIAL PRIMARY KEY,
    name    TEXT UNIQUE NOT NULL,
    code    CHAR(2) UNIQUE NOT NULL  -- ISO 3166-1 alpha-2 (e.g. 'HR', 'IT', 'DE')
);


-- ============================================================
-- REGIONS
-- Subdivisions within a country (e.g. Dalmatia, Tuscany)
-- ============================================================
CREATE TABLE regions (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    country_id  INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    UNIQUE (name, country_id)
);


-- ============================================================
-- CATEGORIES
-- Type of road/trail (offroad, mountain, coastal, forest, etc.)
-- ============================================================
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        TEXT UNIQUE NOT NULL,
    description TEXT,
    icon        TEXT  -- icon identifier used on the frontend
);


-- ============================================================
-- ROUTES
-- Main post — a road/trail shared by a user
-- ============================================================
CREATE TABLE routes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    description      TEXT,
    country_id       INTEGER REFERENCES countries(id),
    region_id        INTEGER REFERENCES regions(id),
    distance_km      NUMERIC(8, 2),   -- total length in km
    duration_minutes INTEGER,          -- estimated drive time
    difficulty       TEXT CHECK (difficulty IN ('easy', 'moderate', 'hard', 'extreme')),
    surface          TEXT CHECK (surface IN ('paved', 'gravel', 'dirt', 'mixed')),
    tips             TEXT,             -- driver recommendations
    is_published     BOOLEAN NOT NULL DEFAULT TRUE,
    avg_rating       NUMERIC(3, 2) NOT NULL DEFAULT 0,  -- cached, updated by trigger
    review_count     INTEGER NOT NULL DEFAULT 0,         -- cached, updated by trigger
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- ROUTE GEOMETRY
-- The actual path drawn on the map (PostGIS LineString)
-- One geometry record per route
-- ============================================================
CREATE TABLE route_geometry (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id     UUID NOT NULL UNIQUE REFERENCES routes(id) ON DELETE CASCADE,
    geom         GEOMETRY(LINESTRING, 4326) NOT NULL,  -- WGS84, the drawn path
    start_point  GEOMETRY(POINT, 4326),                -- first point of the line
    end_point    GEOMETRY(POINT, 4326)                 -- last point of the line
);


-- ============================================================
-- PHOTOS
-- Photos attached to a route, stored in Supabase Storage
-- ============================================================
CREATE TABLE photos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id      UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    storage_path  TEXT NOT NULL,       -- path inside Supabase Storage bucket
    url           TEXT NOT NULL,       -- public URL
    caption       TEXT,
    is_cover      BOOLEAN NOT NULL DEFAULT FALSE,  -- one cover photo per route
    order_index   INTEGER NOT NULL DEFAULT 0,      -- display order
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- REVIEWS
-- Rating + optional comment left by a user on a route
-- One review per user per route
-- ============================================================
CREATE TABLE reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id    UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (route_id, user_id)  -- one review per user per route
);


-- ============================================================
-- FAVOURITES
-- Routes bookmarked by a user
-- ============================================================
CREATE TABLE favourites (
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    route_id    UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, route_id)
);


-- ============================================================
-- ROUTE CATEGORIES
-- Many-to-many: a route can belong to multiple categories
-- ============================================================
CREATE TABLE route_categories (
    route_id     UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (route_id, category_id)
);


-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_routes_user_id     ON routes(user_id);
CREATE INDEX idx_routes_country_id  ON routes(country_id);
CREATE INDEX idx_routes_region_id   ON routes(region_id);
CREATE INDEX idx_routes_created_at  ON routes(created_at DESC);
CREATE INDEX idx_routes_avg_rating  ON routes(avg_rating DESC);

-- Spatial index for geo queries (find routes near a location, map viewport, etc.)
CREATE INDEX idx_route_geom         ON route_geometry USING GIST(geom);
CREATE INDEX idx_route_start_point  ON route_geometry USING GIST(start_point);

CREATE INDEX idx_photos_route_id    ON photos(route_id);
CREATE INDEX idx_reviews_route_id   ON reviews(route_id);
CREATE INDEX idx_reviews_user_id    ON reviews(user_id);
CREATE INDEX idx_favourites_user_id ON favourites(user_id);


-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_routes_updated_at
    BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- Auto-extract start/end points from the linestring when geometry is inserted/updated
CREATE OR REPLACE FUNCTION compute_route_endpoints()
RETURNS TRIGGER AS $$
BEGIN
    NEW.start_point = ST_StartPoint(NEW.geom);
    NEW.end_point   = ST_EndPoint(NEW.geom);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_route_geometry_endpoints
    BEFORE INSERT OR UPDATE ON route_geometry
    FOR EACH ROW EXECUTE FUNCTION compute_route_endpoints();


-- Recalculate avg_rating and review_count on routes whenever a review changes
CREATE OR REPLACE FUNCTION update_route_rating()
RETURNS TRIGGER AS $$
DECLARE
    target_route_id UUID;
BEGIN
    target_route_id = COALESCE(NEW.route_id, OLD.route_id);

    UPDATE routes
    SET
        avg_rating   = COALESCE((SELECT AVG(rating) FROM reviews WHERE route_id = target_route_id), 0),
        review_count = (SELECT COUNT(*) FROM reviews WHERE route_id = target_route_id)
    WHERE id = target_route_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_review_rating
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_route_rating();


-- Auto-create a profile row when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_geometry   ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE favourites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

-- routes
CREATE POLICY "Published routes are viewable by everyone"
    ON routes FOR SELECT USING (is_published = true);
CREATE POLICY "Users can view their own unpublished routes"
    ON routes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can create routes"
    ON routes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own routes"
    ON routes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own routes"
    ON routes FOR DELETE USING (auth.uid() = user_id);

-- route_geometry
CREATE POLICY "Route geometry is viewable by everyone"
    ON route_geometry FOR SELECT USING (true);
CREATE POLICY "Route owners can insert geometry"
    ON route_geometry FOR INSERT WITH CHECK (
        auth.uid() = (SELECT user_id FROM routes WHERE id = route_id)
    );
CREATE POLICY "Route owners can update geometry"
    ON route_geometry FOR UPDATE USING (
        auth.uid() = (SELECT user_id FROM routes WHERE id = route_id)
    );

-- photos
CREATE POLICY "Photos are viewable by everyone"
    ON photos FOR SELECT USING (true);
CREATE POLICY "Route owners can add photos"
    ON photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Route owners can delete their photos"
    ON photos FOR DELETE USING (auth.uid() = user_id);

-- reviews
CREATE POLICY "Reviews are viewable by everyone"
    ON reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create a review"
    ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own review"
    ON reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own review"
    ON reviews FOR DELETE USING (auth.uid() = user_id);

-- favourites
CREATE POLICY "Users can view their own favourites"
    ON favourites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add favourites"
    ON favourites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their favourites"
    ON favourites FOR DELETE USING (auth.uid() = user_id);

-- route_categories
CREATE POLICY "Route categories are viewable by everyone"
    ON route_categories FOR SELECT USING (true);
CREATE POLICY "Route owners can manage their route categories"
    ON route_categories FOR INSERT WITH CHECK (
        auth.uid() = (SELECT user_id FROM routes WHERE id = route_id)
    );
CREATE POLICY "Route owners can remove their route categories"
    ON route_categories FOR DELETE USING (
        auth.uid() = (SELECT user_id FROM routes WHERE id = route_id)
    );

-- lookup tables (read-only for everyone, no public inserts)
CREATE POLICY "Countries are viewable by everyone"   ON countries   FOR SELECT USING (true);
CREATE POLICY "Regions are viewable by everyone"     ON regions     FOR SELECT USING (true);
CREATE POLICY "Categories are viewable by everyone"  ON categories  FOR SELECT USING (true);


-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO categories (name, description, icon) VALUES
    ('Offroad',    'Unpaved trails, dirt roads, and rugged terrain',         'offroad'),
    ('Mountain',   'High-altitude passes and scenic mountain roads',         'mountain'),
    ('Coastal',    'Roads running along the sea or ocean',                   'coastal'),
    ('Forest',     'Routes through forests and woodland areas',              'forest'),
    ('Lakeside',   'Scenic roads alongside lakes and reservoirs',            'lakeside'),
    ('Desert',     'Arid landscapes, dunes, and desert roads',               'desert'),
    ('Countryside','Rural roads through fields and farmland',                'countryside'),
    ('Canyon',     'Roads cutting through canyons and gorges',               'canyon'),
    ('City',       'Urban scenic drives and city routes',                    'city');
