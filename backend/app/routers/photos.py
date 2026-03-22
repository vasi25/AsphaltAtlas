from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from supabase import Client
from PIL import Image
import io
import uuid

from ..dependencies import get_supabase, get_current_user

router = APIRouter(prefix="/photos", tags=["photos"])

BUCKET = "route-photos"
MAX_SIZE_MB = 8
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = 2048  # resize if larger than this


def resize_image(data: bytes, content_type: str) -> bytes:
    """Resize image to MAX_DIMENSION on the longest side and re-encode."""
    img = Image.open(io.BytesIO(data))
    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

    fmt_map = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
    fmt = fmt_map.get(content_type, "JPEG")

    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=85, optimize=True)
    return buf.getvalue()


@router.post("/{route_id}", status_code=status.HTTP_201_CREATED)
async def upload_photo(
    route_id: str,
    file: UploadFile = File(...),
    caption: str = Form(default=""),
    is_cover: bool = Form(default=False),
    order_index: int = Form(default=0),
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG and WebP images are allowed")

    data = await file.read()

    if len(data) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_SIZE_MB}MB limit")

    # Resize if needed
    data = resize_image(data, file.content_type)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename else "jpg"
    storage_path = f"{current_user.id}/{route_id}/{uuid.uuid4()}.{ext}"

    # Upload to Supabase Storage
    supabase.storage.from_(BUCKET).upload(
        path=storage_path,
        file=data,
        file_options={"content-type": file.content_type},
    )

    public_url = supabase.storage.from_(BUCKET).get_public_url(storage_path)

    # Insert record in photos table
    result = supabase.table("photos").insert({
        "route_id": route_id,
        "user_id": current_user.id,
        "storage_path": storage_path,
        "url": public_url,
        "caption": caption or None,
        "is_cover": is_cover,
        "order_index": order_index,
    }).execute()

    return result.data[0]


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    photo_id: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    photo = supabase.table("photos").select("*").eq("id", photo_id).single().execute()

    if not photo.data:
        raise HTTPException(status_code=404, detail="Photo not found")

    if photo.data["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    supabase.storage.from_(BUCKET).remove([photo.data["storage_path"]])
    supabase.table("photos").delete().eq("id", photo_id).execute()
