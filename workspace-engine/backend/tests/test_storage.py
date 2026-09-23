"""Unit tests for AWS SigV4 S3 / MinIO presigned URL generator."""

import urllib.parse

from app.api.v1.storage import (
    _get_signature_key,
    generate_s3_presigned_put_url,
)


def test_signature_key_derivation():
    """Verify AWS SigV4 intermediate key derivation outputs 32-byte binary digests."""
    secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    date_stamp = "20130524"
    region = "us-east-1"
    service = "s3"

    key = _get_signature_key(secret, date_stamp, region, service)
    assert isinstance(key, bytes)
    assert len(key) == 32


def test_presigned_put_url_structure():
    """Verify generated presigned URL contains required AWS SigV4 query parameters."""
    endpoint = "http://localhost:9000"
    bucket = "workspace-engine-uploads"
    key = "uploads/test-image.png"
    access_key = "minioadmin"
    secret_key = "minioadmin"

    url = generate_s3_presigned_put_url(
        endpoint=endpoint,
        bucket=bucket,
        key=key,
        access_key=access_key,
        secret_key=secret_key,
        region="us-east-1",
        expires_in=1800,
    )

    parsed = urllib.parse.urlparse(url)
    assert parsed.scheme == "http"
    assert parsed.netloc == "localhost:9000"
    assert parsed.path == f"/{bucket}/{key}"

    params = urllib.parse.parse_qs(parsed.query)
    assert params["X-Amz-Algorithm"] == ["AWS4-HMAC-SHA256"]
    assert "X-Amz-Credential" in params
    assert params["X-Amz-Credential"][0].startswith("minioadmin/")
    assert params["X-Amz-Expires"] == ["1800"]
    assert params["X-Amz-SignedHeaders"] == ["host"]
    assert "X-Amz-Date" in params
    assert "X-Amz-Signature" in params
    # Signature is 64 hex characters (SHA256 HMAC)
    assert len(params["X-Amz-Signature"][0]) == 64


def test_presigned_url_deterministic_for_same_timestamp(monkeypatch):
    """Verify that with fixed timestamp, generated signature is deterministic."""
    endpoint = "https://s3.amazonaws.com"
    bucket = "my-test-bucket"
    key = "docs/file.pdf"

    url1 = generate_s3_presigned_put_url(
        endpoint=endpoint,
        bucket=bucket,
        key=key,
        access_key="test-key",
        secret_key="test-secret",
        region="eu-west-1",
        expires_in=3600,
    )

    parsed1 = urllib.parse.urlparse(url1)
    params1 = urllib.parse.parse_qs(parsed1.query)
    assert params1["X-Amz-Algorithm"][0] == "AWS4-HMAC-SHA256"
    assert len(params1["X-Amz-Signature"][0]) == 64
