"""Domain-level exceptions for the ai-service."""


class AIServiceError(Exception):
    """Base class for all ai-service domain errors."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class InvalidTokenError(AIServiceError):
    """Raised when an access token is missing, invalid, or expired."""

    def __init__(self, message: str = "Invalid or expired token") -> None:
        super().__init__(message, status_code=401)


class NotFoundError(AIServiceError):
    """Raised when a requested resource does not exist."""

    def __init__(self, resource: str = "Resource") -> None:
        super().__init__(f"{resource} not found", status_code=404)


class ForbiddenError(AIServiceError):
    """Raised when a user attempts to access a conversation they don't own."""

    def __init__(self, message: str = "You do not have access to this resource") -> None:
        super().__init__(message, status_code=403)


class OpenAIRequestError(AIServiceError):
    """Raised when the OpenAI API call fails or times out."""

    def __init__(self, message: str = "The AI assistant is temporarily unavailable") -> None:
        super().__init__(message, status_code=502)


class ToolExecutionError(AIServiceError):
    """Raised when a tool call fails in a way that should stop the agent loop."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=502)


class AgentLoopLimitError(AIServiceError):
    """Raised when the agent exceeds the configured tool-call iteration limit."""

    def __init__(self) -> None:
        super().__init__(
            "The assistant could not complete this request in a "
            "reasonable number of steps. Please try rephrasing.",
            status_code=502,
        )


class UnknownToolError(AIServiceError):
    """Raised when the model requests a tool that isn't registered."""

    def __init__(self, tool_name: str) -> None:
        super().__init__(f"Unknown tool requested: {tool_name}", status_code=502)
