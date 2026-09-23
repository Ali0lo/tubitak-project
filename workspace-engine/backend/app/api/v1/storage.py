"""Storage API for generating AWS SigV4 presigned image and attachment upload URLs."""

import hashlib
import hmac
import urllib.parse
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import settings

router = APIRouter(prefix="/storage", tags=["storage"])


class PresignedUploadRequest(BaseModel):
    filename: str
    content_type: str = Field(default="application/octet-stream")
    file_size_bytes: Optional[int] = None
    expires_in: Optional[int] = Field(default=3600, ge=60, le=604800)


class PresignedUploadResponse(BaseModel):
    upload_url: str
    file_url: str
    key: str
    method: str = "PUT"
    expires_in: int = 3600


def _sign(key: bytes, msg: str) -> bytes:
    """Compute HMAC-SHA256 signature."""
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _get_signature_key(key: str, date_stamp: str, region_name: str, service_name: str) -> bytes:
    """Derive AWS SigV4 signing key."""
    k_date = _sign(("AWS4" + key).encode("utf-8"), date_stamp)
    k_region = _sign(k_date, region_name)
    k_service = _sign(k_region, service_name)
    k_signing = _sign(k_service, "aws4_request")
    return k_signing


def generate_s3_presigned_put_url(
    endpoint: str,
    bucket: str,
    key: str,
    access_key: str,
    secret_key: str,
    region: str = "us-east-1",
    expires_in: int = 3600,
) -> str:
    """Generate authentic AWS SigV4 presigned PUT URL for direct-to-S3 / MinIO browser uploads."""
    parsed_endpoint = urllib.parse.urlparse(endpoint)
    host = parsed_endpoint.netloc

    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")

    # Canonical URI (path style: /bucket/key)
    safe_key = urllib.parse.quote(key, safe="/-_.~")
    canonical_uri = f"/{bucket}/{safe_key}"

    credential_scope = f"{date_stamp}/{region}/s3/aws4_request"
    credential = f"{access_key}/{credential_scope}"

    # Canonical query parameters (must be sorted alphabetically by key)
    query_params = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": credential,
        "X-Amz-Date": amz_date,
        "X-Amz-Expires": str(expires_in),
        "X-Amz-SignedHeaders": "host",
    }

    # URL encode query string in sorted order
    canonical_querystring = urllib.parse.urlencode(
        sorted(query_params.items()), quote_via=urllib.parse.quote
    )

    # Canonical headers
    canonical_headers = f"host:{host}\n"
    signed_headers = "host"
    payload_hash = "UNSIGNED-PAYLOAD"

    # Canonical request
    canonical_request = (
        f"PUT\n"
        f"{canonical_uri}\n"
        f"{canonical_querystring}\n"
        f"{canonical_headers}\n"
        f"{signed_headers}\n"
        f"{payload_hash}"
    )

    # String to sign
    algorithm = "AWS4-HMAC-SHA256"
    string_to_sign = (
        f"{algorithm}\n"
        f"{amz_date}\n"
        f"{credential_scope}\n"
        f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    )

    # Calculate signature
    signing_key = _get_signature_key(secret_key, date_stamp, region, "s3")
    signature = hmac.new(
        signing_key, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    # Final presigned URL
    full_query = f"{canonical_querystring}&X-Amz-Signature={signature}"
    clean_endpoint = endpoint.rstrip("/")
    return f"{clean_endpoint}{canonical_uri}?{full_query}"


@router.post("/presigned-upload", response_model=PresignedUploadResponse)
async def generate_presigned_upload(data: PresignedUploadRequest):
    """Generate a presigned upload URL for direct-to-S3/MinIO browser uploads using AWS SigV4."""
    file_extension = data.filename.split(".")[-1] if "." in data.filename else "bin"
    clean_ext = "".join(c for c in file_extension if c.isalnum())
    key = f"uploads/{uuid.uuid4()}.{clean_ext or 'bin'}"

    expires_in = data.expires_in or 3600
    upload_url = generate_s3_presigned_put_url(
        endpoint=settings.S3_ENDPOINT,
        bucket=settings.S3_BUCKET,
        key=key,
        access_key=settings.S3_ACCESS_KEY,
        secret_key=settings.S3_SECRET_KEY,
        region=settings.S3_REGION,
        expires_in=expires_in,
    )

    clean_endpoint = settings.S3_ENDPOINT.rstrip("/")
    file_url = f"{clean_endpoint}/{settings.S3_BUCKET}/{key}"

    return PresignedUploadResponse(
        upload_url=upload_url,
        file_url=file_url,
        key=key,
        method="PUT",
        expires_in=expires_in,
    )
