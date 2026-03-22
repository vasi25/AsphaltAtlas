from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client
from typing import Optional

from ..dependencies import get_supabase, get_current_user

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("/nearby")
def get_nearby_routes(
    lat: float = Query(..., description="Latitude of center point"),
    lng: float = Query(..., description="Longitude of center point"),
    radius_km: float = Query(default=50, le=500),
    supabase: Client = Depends(get_supabase),
):
    """
    Find routes whose start point is within radius_km of the given coordinates.
    Uses PostGIS ST_DWithin for efficient spatial querying.
    """
    result = supabase.rpc("routes_near_point", {
        "lat": lat,
        "lng": lng,
        "radius_m": radius_km * 1000,
    }).execute()

    return result.data


@router.get("/search")
def search_routes(
    q: Optional[str] = Query(default=None, description="Full-text search term"),
    country_id: Optional[int] = None,
    region_id: Optional[int] = None,
    category_id: Optional[int] = None,
    difficulty: Optional[str] = None,
    surface: Optional[str] = None,
    min_rating: Optional[float] = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
    supabase: Client = Depends(get_supabase),
):
    """
    Filter and search routes. All parameters are optional and combinable.
    Standard filtering is done here; full-text search uses Postgres ilike.
    """
    query = supabase.table("routes").select(
        "*, profiles(username, avatar_url), countries(name), regions(name), photos(url, is_cover)"
    ).eq("is_published", True)

    if q:
        query = query.ilike("title", f"%{q}%")
    if country_id:
        query = query.eq("country_id", country_id)
    if region_id:
        query = query.eq("region_id", region_id)
    if difficulty:
        query = query.eq("difficulty", difficulty)
    if surface:
        query = query.eq("surface", surface)
    if min_rating:
        query = query.gte("avg_rating", min_rating)

    result = (
        query
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    if category_id:
        # Filter in Python for routes that have the requested category
        route_ids = supabase.table("route_categories") \
            .select("route_id") \
            .eq("category_id", category_id) \
            .execute()
        ids = {r["route_id"] for r in route_ids.data}
        return [r for r in result.data if r["id"] in ids]

    return result.data
