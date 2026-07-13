"""Catch-all reverse-proxy routes.

A single dynamic route captures every request under /api/v1/... and
forwards it to whichever downstream service owns that prefix,
according to app.config.routes_table.
"""
from fastapi import APIRouter, Request, Response

from app.config.routes_table import is_public_path, resolve_target
from app.exceptions import UnauthenticatedError, UnknownRouteError

router = APIRouter()

_PROXY_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]


@router.api_route("/api/v1/{full_path:path}", methods=_PROXY_METHODS)
async def proxy_dispatch(full_path: str, request: Request) -> Response:
    downstream_path = f"/api/v1/{full_path}"

    target_base_url = resolve_target(downstream_path)
    if target_base_url is None:
        raise UnknownRouteError()

    if not is_public_path(downstream_path):
        if "authorization" not in {k.lower() for k in request.headers.keys()}:
            raise UnauthenticatedError()

    proxy_service = request.app.state.proxy_service
    return await proxy_service.forward(request, target_base_url, downstream_path)
