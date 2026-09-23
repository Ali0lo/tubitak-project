"""Storage API for presigned image and attachment upload URLs."""
import uuid
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/storage", tags=["storage"])


class PresignedUploadRequest(BaseModel):
    filename: str
    content_type: str
    file_size_bytes: Optional[int] = None


class PresignedUploadResponse(BaseModel):
    upload_url: str
    file_url: str
    key: str


@router.post("/presigned-upload", response_model=PresignedUploadResponse)
async def generate_presigned_upload(data: PresignedUploadRequest):
    """Generate a presigned upload URL for direct-to-S3/MinIO browser uploads."""
    file_extension = data.filename.split(".")[-1] if "." in data.filename else "bin"
    key = f"uploads/{uuid.uuid4()}.{file_extension}"

    upload_url = f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET}/{key}"
    file_url = f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET}/{key}"

    return PresignedUploadResponse(
        upload_url=upload_url,
        file_url=file_url,
        key=key,
    )
