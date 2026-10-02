"""Wrapper around OpenAI chat completions API with local LLM (Ollama / vLLM) support and graceful degradation."""

import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import List, Optional

from openai import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AsyncOpenAI,
    BadRequestError,
)

from app.core.config import get_settings
from app.core.exceptions import OpenAIRequestError

logger = logging.getLogger("ai-service.llm_client")
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
    """Async wrapper around OpenAI's chat completions API.

    Supports both cloud OpenAI models and OpenAI-compatible local inference engines
    (such as Ollama and vLLM). When connecting to local models that lack native
    function-calling support, it provides graceful prompt-guided tool degradation.
    Also provides automatic fault-tolerant fallback to OpenAI cloud when configured.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        provider: Optional[str] = None,
        fallback_to_openai: Optional[bool] = None,
    ) -> None:
        configured_provider = (provider or settings.LLM_PROVIDER).lower()
        effective_base_url = base_url or settings.LOCAL_LLM_URL

        # Determine whether to route to local inference engine or cloud OpenAI
        if configured_provider in ("local", "ollama", "vllm"):
            is_local = True
            active_provider = configured_provider
        elif configured_provider == "auto":
            is_local = bool(effective_base_url)
            active_provider = "local" if is_local else "openai"
        elif configured_provider == "openai":
            is_local = False
            active_provider = "openai"
        else:
            is_local = bool(effective_base_url)
            active_provider = configured_provider

        self.provider = active_provider
        self.is_local = is_local

        if self.is_local:
            url = effective_base_url or "http://localhost:11434/v1"
            url = url.rstrip("/")
            if not url.endswith("/v1"):
                url = f"{url}/v1"
            self.base_url: Optional[str] = url
            self.model: str = model or settings.LOCAL_LLM_MODEL or "llama3.1"
            auth_key = api_key or settings.LOCAL_LLM_API_KEY or "ollama"
        else:
            self.base_url = base_url
            self.model = model or settings.OPENAI_MODEL or "gpt-4o"
            auth_key = api_key or settings.OPENAI_API_KEY or "none"

        self._client = AsyncOpenAI(api_key=auth_key, base_url=self.base_url)

        # Optional cloud fallback if local LLM fails
        self.fallback_to_openai = (
            fallback_to_openai
            if fallback_to_openai is not None
            else settings.FALLBACK_TO_OPENAI
        )
        if (
            self.is_local
            and self.fallback_to_openai
            and bool(settings.OPENAI_API_KEY)
        ):
            self._fallback_client: Optional[AsyncOpenAI] = AsyncOpenAI(
                api_key=settings.OPENAI_API_KEY
            )
            self._fallback_model: str = settings.OPENAI_MODEL or "gpt-4o"
        else:
            self._fallback_client = None
            self._fallback_model = ""

    async def complete(
        self, messages: List[dict], tools: Optional[List[dict]] = None
    ) -> ChatCompletionResult:
        """Execute chat completion, with graceful degradation and cloud fallback."""
        try:
            return await self._call_completion(
                client=self._client,
                model=self.model,
                messages=messages,
                tools=tools,
            )
        except (BadRequestError, APIError) as exc:
            # Check for tool-unsupported error on local model
            if tools and self._is_tool_unsupported_error(exc):
                logger.warning(
                    "Model '%s' failed native tool calling (%s). "
                    "Falling back to prompt-guided JSON tool degradation.",
                    self.model,
                    exc,
                )
                try:
                    return await self._complete_with_tool_prompt_fallback(
                        client=self._client,
                        model=self.model,
                        messages=messages,
                        tools=tools,
                    )
                except (APIError, APITimeoutError, APIConnectionError) as fallback_exc:
                    if self._fallback_client:
                        return await self._execute_cloud_fallback(
                            messages, tools, original_exc=fallback_exc
                        )
                    raise OpenAIRequestError() from fallback_exc
            elif self._fallback_client and isinstance(
                exc, (APIConnectionError, APITimeoutError)
            ):
                return await self._execute_cloud_fallback(
                    messages, tools, original_exc=exc
                )
            else:
                raise OpenAIRequestError() from exc
        except (APIConnectionError, APITimeoutError) as exc:
            if self._fallback_client:
                return await self._execute_cloud_fallback(
                    messages, tools, original_exc=exc
                )
            raise OpenAIRequestError() from exc

    async def _call_completion(
        self,
        client: AsyncOpenAI,
        model: str,
        messages: List[dict],
        tools: Optional[List[dict]],
    ) -> ChatCompletionResult:
        kwargs = {
            "model": model,
            "messages": messages,
            "temperature": settings.OPENAI_TEMPERATURE,
            "timeout": settings.OPENAI_REQUEST_TIMEOUT_SECONDS,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        response = await client.chat.completions.create(**kwargs)
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

    def _is_tool_unsupported_error(self, exc: Exception) -> bool:
        """Detect whether the error was triggered because tools are unsupported."""
        msg = str(exc).lower()
        keywords = (
            "tool",
            "function",
            "not supported",
            "unsupported",
            "does not support",
            "unknown parameter",
            "extra forbidden",
            "invalid parameter",
            "400",
            "bad request",
        )
        return any(kw in msg for kw in keywords)

    def _format_tools_prompt(self, tools: List[dict]) -> str:
        """Format OpenAI-schema tool definitions into system prompt instructions."""
        lines = [
            "\n[TOOL USAGE INSTRUCTIONS]",
            "You have access to the following tools to manage tasks, meetings, and reminders:",
        ]
        for t in tools:
            fn = t.get("function", {})
            name = fn.get("name", "")
            desc = fn.get("description", "")
            params = fn.get("parameters", {}).get("properties", {})
            required = fn.get("parameters", {}).get("required", [])
            param_str = ", ".join(
                f"{k}: {v.get('type', 'any')}{' (required)' if k in required else ''}"
                for k, v in params.items()
            )
            lines.append(f"- {name}({param_str}): {desc}")

        lines.append(
            "\nIf you need to call a tool, respond with ONLY a JSON block formatted exactly as:\n"
            "```json\n"
            '{"name": "<tool_name>", "arguments": {<arguments>}}\n'
            "```\n"
            "If no tool call is needed, reply normally in plain conversational text."
        )
        return "\n".join(lines)

    def _extract_tool_call_from_text(
        self, content: Optional[str]
    ) -> Optional[ToolCallRequest]:
        """Extract a structured tool call from freeform or markdown LLM response."""
        if not content:
            return None

        candidate_strs = []

        # 1. Search for markdown code block ```json ... ``` or ``` ... ```
        block_matches = re.findall(
            r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL
        )
        candidate_strs.extend(block_matches)

        # 2. Check if the raw text is itself JSON
        trimmed = content.strip()
        if trimmed.startswith("{") and trimmed.endswith("}"):
            candidate_strs.append(trimmed)

        # 3. Check for any brace substring
        first_brace = content.find("{")
        last_brace = content.rfind("}")
        if first_brace != -1 and last_brace > first_brace:
            candidate_strs.append(content[first_brace : last_brace + 1])

        for cand in candidate_strs:
            try:
                data = json.loads(cand)
                if isinstance(data, dict):
                    tool_name = (
                        data.get("name")
                        or data.get("tool")
                        or data.get("function")
                    )
                    if tool_name and isinstance(tool_name, str):
                        args = data.get("arguments") or data.get("parameters")
                        if args is None:
                            # Use all remaining fields as arguments
                            args = {
                                k: v
                                for k, v in data.items()
                                if k not in ("name", "tool", "function", "type")
                            }
                        elif isinstance(args, str):
                            try:
                                args = json.loads(args)
                            except Exception:
                                args = {}
                        if not isinstance(args, dict):
                            args = {}

                        return ToolCallRequest(
                            id=f"call_{uuid.uuid4().hex[:8]}",
                            name=tool_name,
                            arguments=args,
                        )
            except Exception:
                continue

        return None

    async def _complete_with_tool_prompt_fallback(
        self,
        client: AsyncOpenAI,
        model: str,
        messages: List[dict],
        tools: List[dict],
    ) -> ChatCompletionResult:
        """Fallback for models lacking native tool-calling: prompt injection & extraction."""
        tool_prompt = self._format_tools_prompt(tools)
        augmented_messages = list(messages)
        augmented_messages.append({"role": "system", "content": tool_prompt})

        response = await client.chat.completions.create(
            model=model,
            messages=augmented_messages,
            temperature=settings.OPENAI_TEMPERATURE,
            timeout=settings.OPENAI_REQUEST_TIMEOUT_SECONDS,
        )

        choice = response.choices[0]
        content = choice.message.content or ""
        tool_call = self._extract_tool_call_from_text(content)

        if tool_call:
            return ChatCompletionResult(
                content=None,
                tool_calls=[tool_call],
                finish_reason="tool_calls",
            )

        return ChatCompletionResult(
            content=content,
            tool_calls=[],
            finish_reason=choice.finish_reason or "stop",
        )

    async def _execute_cloud_fallback(
        self,
        messages: List[dict],
        tools: Optional[List[dict]],
        original_exc: Exception,
    ) -> ChatCompletionResult:
        """Route to cloud OpenAI if local LLM is down or encounters an unrecoverable error."""
        if not self._fallback_client:
            raise OpenAIRequestError() from original_exc

        logger.warning(
            "Local LLM call failed (%s). Executing cloud fallback to OpenAI (%s).",
            original_exc,
            self._fallback_model,
        )
        try:
            return await self._call_completion(
                client=self._fallback_client,
                model=self._fallback_model,
                messages=messages,
                tools=tools,
            )
        except (APIError, APITimeoutError, APIConnectionError) as fb_exc:
            raise OpenAIRequestError() from fb_exc
