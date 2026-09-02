from fastapi import Depends, Header, HTTPException, status
from supabase import create_client, Client
from anthropic import Anthropic
from .config import settings


def get_supabase() -> Client:
    """Admin Supabase client using the service role key (server-side only)."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_claude_client() -> Anthropic:
    return Anthropic(api_key=settings.claude_api_key)


async def get_current_user(authorization: str = Header(...)):
    """
    Validate the JWT from the Authorization header and return the user payload.
    The frontend sends: Authorization: Bearer <supabase_access_token>
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header")

    token = authorization.removeprefix("Bearer ")
    supabase = get_supabase()

    try:
        response = supabase.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
        return response.user
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


async def get_current_admin(current_user=Depends(get_current_user)):
    """Same as get_current_user, but also requires profiles.role == 'admin'."""
    supabase = get_supabase()
    profile = supabase.table("profiles").select("role").eq("id", current_user.id).single().execute()

    if not profile.data or profile.data.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    return current_user
