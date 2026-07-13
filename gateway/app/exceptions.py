"""Domain-level exceptions for the gateway.

Translated into HTTP responses by the handler registered in
app.middleware.error_handler.
"""


class GatewayError(Exception):
    """Base class for all gateway errors."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class UnknownRouteError(GatewayError):
    """Raised when a request path matches no configured downstream service."""

    def __init__(self) -> None:
        super().__init__("No service is registered for this route", status_code=404)


class UnauthenticatedError(GatewayError):
    """Raised when a non-public route is requested without a bearer token."""

    def __init__(self) -> None:
        super().__init__("Authentication required", status_code=401)


class ServiceUnavailableError(GatewayError):
    """Raised when a downstream service cannot be reached."""

    def __init__(self, service_name: str = "downstream service") -> None:
        super().__init__(f"{service_name} is unavailable", status_code=503)


class GatewayTimeoutError(GatewayError):
    """Raised when a downstream service does not respond in time."""

    def __init__(self, service_name: str = "downstream service") -> None:
        super().__init__(f"{service_name} timed out", status_code=504)


class RateLimitExceededError(GatewayError):
    """Raised when a client exceeds the configured request rate."""

    def __init__(self, retry_after_seconds: int) -> None:
        self.retry_after_seconds = retry_after_seconds
        super().__init__("Rate limit exceeded", status_code=429)
