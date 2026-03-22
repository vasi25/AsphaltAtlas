-- RPC to return route geometry as GeoJSON text
CREATE OR REPLACE FUNCTION public.get_route_geojson(p_route_id UUID)
RETURNS TEXT AS $$
    SELECT ST_AsGeoJSON(geom)
    FROM public.route_geometry
    WHERE route_id = p_route_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_route_geojson TO anon, authenticated;
