from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from pydantic import BaseModel
from typing import Optional

from ..dependencies import get_supabase, get_current_user

router = APIRouter(prefix="/users", tags=["users"])


class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    bio: Optional[str] = None


@router.get("/me")
def get_my_profile(
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    result = supabase.table("profiles").select("*").eq("id", current_user.id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data


@router.patch("/me")
def update_my_profile(
    body: ProfileUpdate,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "username" in updates:
        existing = supabase.table("profiles") \
            .select("id") \
            .eq("username", updates["username"]) \
            .neq("id", current_user.id) \
            .execute()
        if existing.data:
            raise HTTPException(status_code=409, detail="Username already taken")

    result = supabase.table("profiles").update(updates).eq("id", current_user.id).execute()
    return result.data[0]


@router.get("/{username}")
def get_profile(
    username: str,
    supabase: Client = Depends(get_supabase),
):
    result = supabase.table("profiles") \
        .select("id, username, full_name, avatar_url, bio, created_at") \
        .eq("username", username) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")

    return result.data


@router.get("/{username}/routes")
def get_user_routes(
    username: str,
    supabase: Client = Depends(get_supabase),
):
    profile = supabase.table("profiles").select("id").eq("username", username).single().execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="User not found")

    result = supabase.table("routes") \
        .select("*, photos(url, is_cover)") \
        .eq("user_id", profile.data["id"]) \
        .eq("is_published", True) \
        .order("created_at", desc=True) \
        .execute()

    return result.data
