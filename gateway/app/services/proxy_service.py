"""Reverse-proxy logic for forwarding requests to downstream services."""
from typing import Mapping

import httpx
from fastapi import Request, Response

from app.exceptions import GatewayTimeoutError, ServiceUnavailableError

# Hop-by-hop / connection-specific headers that must never be forwarded
# as-is between the client, the gateway, and the upstream service.
_EXCLUDED_REQUEST_HEADERS = {"host", "content-length", "connection"}
_EXCLUDED_RESPONSE_HEADERS = {
    "content-encoding",
    "transfer-encoding",
    "connection",
    "content-length",
}


class ProxyService:
    """Forwards an incoming FastAPI Request to a downstream service."""

    def __init__(self, client: httpx.AsyncClient, timeout_seconds: float) -> None:
        self.client = client
        self.timeout_seconds = timeout_seconds

    async def forward(
        self, request: Request, base_url: str, downstream_path: str
    ) -> Response:
        url = f"{base_url.rstrip('/')}{downstream_path}"
        headers = self._filter_request_headers(request.headers)
        body = await request.body()

        try:
            upstream_response = await self.client.request(
                method=request.method,
                url=url,
                headers=headers,
                params=request.query_params,
                content=body,
                timeout=self.timeout_seconds,
            )
        except httpx.TimeoutException as exc:
            raise GatewayTimeoutError(base_url) from exc
        except httpx.HTTPError as exc:
            raise ServiceUnavailableError(base_url) from exc

        return Response(
            content=upstream_response.content,
            status_code=upstream_response.status_code,
            headers=self._filter_response_headers(upstream_response.headers),
            media_type=upstream_response.headers.get("content-type"),
        )

    @staticmethod
    def _filter_request_headers(headers: Mapping[str, str]) -> dict:
        return {
            key: value
            for key, value in headers.items()
            if key.lower() not in _EXCLUDED_REQUEST_HEADERS
        }

    @staticmethod
    def _filter_response_headers(headers: Mapping[str, str]) -> dict:
        return {
            key: value
            for key, value in headers.items()
            if key.lower() not in _EXCLUDED_RESPONSE_HEADERS
        }
