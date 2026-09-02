import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from anthropic import Anthropic

from ..dependencies import get_supabase, get_claude_client, get_current_admin

router = APIRouter(prefix="/moderation", tags=["moderation"])

MAX_PHOTOS = 8

VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "flagged": {
            "type": "boolean",
            "description": "True if the route has content an admin should reject or double-check",
        },
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["explicit_content", "profanity", "spam", "misleading_info", "other"],
                    },
                    "detail": {
                        "type": "string",
                        "description": "What was found and where (e.g. 'photo 2' or 'description')",
                    },
                },
                "required": ["category", "detail"],
                "additionalProperties": False,
            },
        },
        "summary": {
            "type": "string",
            "description": "One or two sentence overall verdict for the admin reviewing this route",
        },
    },
    "required": ["flagged", "issues", "summary"],
    "additionalProperties": False,
}


@router.post("/routes/{route_id}/ai-overview")
def ai_overview(
    route_id: str,
    current_admin=Depends(get_current_admin),
    supabase: Client = Depends(get_supabase),
    claude: Anthropic = Depends(get_claude_client),
):
    route = supabase.table("routes") \
        .select("title, description, tips, difficulty, surface, distance_km") \
        .eq("id", route_id) \
        .single() \
        .execute()

    if not route.data:
        raise HTTPException(status_code=404, detail="Route not found")

    photos = supabase.table("photos") \
        .select("url") \
        .eq("route_id", route_id) \
        .order("order_index") \
        .limit(MAX_PHOTOS) \
        .execute()

    r = route.data
    text = (
        "Review this route posting for a community driving-routes platform. "
        "Check the text for profanity, spam, or misleading claims, and check the photos "
        "for explicit or inappropriate content, or content unrelated to a driving route.\n\n"
        f"Title: {r['title']}\n"
        f"Description: {r.get('description') or '(none)'}\n"
        f"Tips: {r.get('tips') or '(none)'}\n"
        f"Difficulty: {r.get('difficulty') or '(none)'}\n"
        f"Surface: {r.get('surface') or '(none)'}\n"
        f"Distance: {r.get('distance_km') or '(none)'} km"
    )

    content = [{"type": "text", "text": text}]
    for photo in photos.data:
        content.append({"type": "image", "source": {"type": "url", "url": photo["url"]}})

    response = claude.messages.create(
        model="claude-opus-5",
        max_tokens=2048,
        output_config={
            "effort": "low",
            "format": {"type": "json_schema", "schema": VERDICT_SCHEMA},
        },
        messages=[{"role": "user", "content": content}],
    )

    if response.stop_reason == "refusal":
        raise HTTPException(status_code=502, detail="AI review declined to process this route")

    verdict = json.loads(response.content[0].text)
    checked_at = datetime.now(timezone.utc).isoformat()

    supabase.table("routes").update({
        "ai_overview": verdict,
        "ai_overview_checked_at": checked_at,
    }).eq("id", route_id).execute()

    return {**verdict, "checked_at": checked_at}
