"""Domain-level exceptions for the notification-service."""


class NotificationServiceError(Exception):
    """Base class for all notification-service domain errors."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class InvalidTokenError(NotificationServiceError):
    """Raised when an access token is missing, invalid, or expired."""

    def __init__(self, message: str = "Invalid or expired token") -> None:
        super().__init__(message, status_code=401)


class InvalidInternalApiKeyError(NotificationServiceError):
    """Raised when a service-to-service call presents a missing/wrong API key."""

    def __init__(self) -> None:
        super().__init__("Invalid or missing internal API key", status_code=401)


class NotFoundError(NotificationServiceError):
    """Raised when a requested resource does not exist."""

    def __init__(self, resource: str = "Resource") -> None:
        super().__init__(f"{resource} not found", status_code=404)


class ForbiddenError(NotificationServiceError):
    """Raised when a user attempts to access a notification they don't own."""

    def __init__(self, message: str = "You do not have access to this resource") -> None:
        super().__init__(message, status_code=403)


class EmailDispatchError(NotificationServiceError):
    """Raised when sending an email via SMTP fails."""

    def __init__(self, message: str = "Failed to send email") -> None:
        super().__init__(message, status_code=502)
