"""Domain-level exceptions for the auth-service.

These are translated into HTTP responses by the exception handlers
registered in app.middleware.exception_handler.
"""


class AuthServiceError(Exception):
    """Base class for all auth-service domain errors."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class InvalidCredentialsError(AuthServiceError):
    """Raised when email/password do not match an active account,
    or when login is blocked for another credential-related reason
    (e.g. unverified email)."""

    def __init__(self, message: str = "Invalid email or password") -> None:
        super().__init__(message, status_code=401)


class UserAlreadyExistsError(AuthServiceError):
    """Raised when attempting to register an email that is already in use."""

    def __init__(self) -> None:
        super().__init__(
            "A user with this email already exists", status_code=409
        )


class InvalidTokenError(AuthServiceError):
    """Raised when a JWT or stored token is invalid, expired, or revoked."""

    def __init__(self, message: str = "Invalid or expired token") -> None:
        super().__init__(message, status_code=401)


class UserNotFoundError(AuthServiceError):
    """Raised when a referenced user cannot be located."""

    def __init__(self) -> None:
        super().__init__("User not found", status_code=404)