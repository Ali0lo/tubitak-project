"""Wrapper around the OpenAI chat completions API with tool calling."""
import json
from dataclasses import dataclass, field
from typing import List, Optional

from openai import APIConnectionError, APIError, APITimeoutError, AsyncOpenAI

from app.core.config import get_settings
from app.core.exceptions import OpenAIRequestError

settings = get_settings()


@dataclass
class ToolCallRequest:
    """A single tool invocation requested by the model."""

    id: str
    name: str
    arguments: dict


@dataclass
class ChatCompletionResult:
    """Normalized result of a chat completion call."""

    content: Optional[str]
    tool_calls: List[ToolCallRequest] = field(default_factory=list)
    finish_reason: str = "stop"


class OpenAIClient:
    """Thin async wrapper around AsyncOpenAI's chat.completions API.

    Kept deliberately narrow so ChatService depends on this interface
    rather than the OpenAI SDK directly, making it easy to substitute
    a fake implementation in tests.
    """

    def __init__(
        self, api_key: Optional[str] = None, model: Optional[str] = None
    ) -> None:
        self._client = AsyncOpenAI(api_key=api_key or settings.OPENAI_API_KEY)
        self.model = model or settings.OPENAI_MODEL

    async def complete(
        self, messages: List[dict], tools: List[dict]
    ) -> ChatCompletionResult:
        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools,
                tool_choice="auto",
                temperature=settings.OPENAI_TEMPERATURE,
                timeout=settings.OPENAI_REQUEST_TIMEOUT_SECONDS,
            )
        except (APIError, APITimeoutError, APIConnectionError) as exc:
            raise OpenAIRequestError() from exc

        choice = response.choices[0]
        message = choice.message

        tool_calls: List[ToolCallRequest] = []
        if message.tool_calls:
            for call in message.tool_calls:
                try:
                    arguments = json.loads(call.function.arguments or "{}")
                except json.JSONDecodeError:
                    arguments = {}
                tool_calls.append(
                    ToolCallRequest(
                        id=call.id,
                        name=call.function.name,
                        arguments=arguments,
                    )
                )

        return ChatCompletionResult(
            content=message.content,
            tool_calls=tool_calls,
            finish_reason=choice.finish_reason or "stop",
        )
