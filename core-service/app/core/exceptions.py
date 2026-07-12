"""Domain-level exceptions for the core-service.

Translated into HTTP responses by the handlers registered in
app.middleware.exception_handler.
"""


class CoreServiceError(Exception):
    """Base class for all core-service domain errors."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class InvalidTokenError(CoreServiceError):
    """Raised when an access token is missing, invalid, or expired."""

    def __init__(self, message: str = "Invalid or expired token") -> None:
        super().__init__(message, status_code=401)


class NotFoundError(CoreServiceError):
    """Raised when a requested resource does not exist."""

    def __init__(self, resource: str = "Resource") -> None:
        super().__init__(f"{resource} not found", status_code=404)


class ForbiddenError(CoreServiceError):
    """Raised when a user attempts to access a resource they don't own."""

    def __init__(self, message: str = "You do not have access to this resource") -> None:
        super().__init__(message, status_code=403)


class ValidationError(CoreServiceError):
    """Raised for business-rule validation failures (e.g. bad date ranges)."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)
