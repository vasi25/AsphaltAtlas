-- RPC function to insert route geometry from GeoJSON
-- Needed because PostgREST cannot directly handle PostGIS geometry types
CREATE OR REPLACE FUNCTION public.insert_route_geometry(
    p_route_id UUID,
    p_geojson  TEXT
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.route_geometry (route_id, geom)
    VALUES (p_route_id, ST_GeomFromGeoJSON(p_geojson))
    ON CONFLICT (route_id) DO UPDATE
        SET geom = ST_GeomFromGeoJSON(p_geojson);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.insert_route_geometry TO authenticated;

-- Seed countries (European focus + common others)
INSERT INTO countries (name, code) VALUES
    ('Albania', 'AL'), ('Andorra', 'AD'), ('Austria', 'AT'), ('Belarus', 'BY'),
    ('Belgium', 'BE'), ('Bosnia and Herzegovina', 'BA'), ('Bulgaria', 'BG'),
    ('Croatia', 'HR'), ('Cyprus', 'CY'), ('Czech Republic', 'CZ'),
    ('Denmark', 'DK'), ('Estonia', 'EE'), ('Finland', 'FI'), ('France', 'FR'),
    ('Germany', 'DE'), ('Greece', 'GR'), ('Hungary', 'HU'), ('Iceland', 'IS'),
    ('Ireland', 'IE'), ('Italy', 'IT'), ('Kosovo', 'XK'), ('Latvia', 'LV'),
    ('Liechtenstein', 'LI'), ('Lithuania', 'LT'), ('Luxembourg', 'LU'),
    ('Malta', 'MT'), ('Moldova', 'MD'), ('Monaco', 'MC'), ('Montenegro', 'ME'),
    ('Netherlands', 'NL'), ('North Macedonia', 'MK'), ('Norway', 'NO'),
    ('Poland', 'PL'), ('Portugal', 'PT'), ('Romania', 'RO'), ('Serbia', 'RS'),
    ('Slovakia', 'SK'), ('Slovenia', 'SI'), ('Spain', 'ES'), ('Sweden', 'SE'),
    ('Switzerland', 'CH'), ('Turkey', 'TR'), ('Ukraine', 'UA'),
    ('United Kingdom', 'GB'), ('Australia', 'AU'), ('Canada', 'CA'),
    ('Japan', 'JP'), ('Morocco', 'MA'), ('New Zealand', 'NZ'),
    ('South Africa', 'ZA'), ('United States', 'US')
ON CONFLICT (code) DO NOTHING;
