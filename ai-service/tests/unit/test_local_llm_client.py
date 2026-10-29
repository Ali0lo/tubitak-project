"""Unit tests for local LLM (Ollama & vLLM) integration, routing, and graceful degradation."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from openai import APIConnectionError, BadRequestError

from app.clients.openai_client import OpenAIClient
from app.core.config import Settings
from app.core.exceptions import OpenAIRequestError


def test_provider_resolution_auto_without_local_url():
    """When LLM_PROVIDER=auto and no local URL is set, should default to OpenAI cloud."""
    with patch("app.clients.openai_client.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "auto"
        mock_settings.LOCAL_LLM_URL = None
        mock_settings.OPENAI_API_KEY = "sk-mock-key"
        mock_settings.OPENAI_MODEL = "gpt-4o"
        mock_settings.FALLBACK_TO_OPENAI = False

        client = OpenAIClient()
        assert client.is_local is False
        assert client.provider == "openai"
        assert client.model == "gpt-4o"
        assert client.base_url is None


def test_provider_resolution_auto_with_local_url():
    """When LLM_PROVIDER=auto and LOCAL_LLM_URL is provided, should route to local engine."""
    with patch("app.clients.openai_client.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "auto"
        mock_settings.LOCAL_LLM_URL = "http://localhost:11434/v1"
        mock_settings.LOCAL_LLM_MODEL = "llama3.1"
        mock_settings.LOCAL_LLM_API_KEY = "ollama"
        mock_settings.OPENAI_API_KEY = ""
        mock_settings.FALLBACK_TO_OPENAI = False

        client = OpenAIClient()
        assert client.is_local is True
        assert client.provider == "local"
        assert client.model == "llama3.1"
        assert client.base_url == "http://localhost:11434/v1"


def test_provider_resolution_explicit_ollama():
    """When LLM_PROVIDER=ollama, should route to ollama endpoint."""
    with patch("app.clients.openai_client.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "ollama"
        mock_settings.LOCAL_LLM_URL = "http://host.docker.internal:11434"
        mock_settings.LOCAL_LLM_MODEL = "qwen2.5"
        mock_settings.LOCAL_LLM_API_KEY = "ollama"
        mock_settings.OPENAI_API_KEY = ""
        mock_settings.FALLBACK_TO_OPENAI = False

        client = OpenAIClient()
        assert client.is_local is True
        assert client.provider == "ollama"
        assert client.model == "qwen2.5"
        assert client.base_url == "http://host.docker.internal:11434/v1"


def test_provider_resolution_explicit_vllm():
    """When LLM_PROVIDER=vllm, should route to vllm endpoint."""
    with patch("app.clients.openai_client.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "vllm"
        mock_settings.LOCAL_LLM_URL = "http://localhost:8000/v1"
        mock_settings.LOCAL_LLM_MODEL = "mistral-7b-instruct"
        mock_settings.LOCAL_LLM_API_KEY = "EMPTY"
        mock_settings.OPENAI_API_KEY = ""
        mock_settings.FALLBACK_TO_OPENAI = False

        client = OpenAIClient()
        assert client.is_local is True
        assert client.provider == "vllm"
        assert client.model == "mistral-7b-instruct"
        assert client.base_url == "http://localhost:8000/v1"


def test_provider_resolution_forced_openai():
    """When LLM_PROVIDER=openai, should use OpenAI even if LOCAL_LLM_URL is set."""
    with patch("app.clients.openai_client.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "openai"
        mock_settings.LOCAL_LLM_URL = "http://localhost:11434/v1"
        mock_settings.OPENAI_API_KEY = "sk-real-key"
        mock_settings.OPENAI_MODEL = "gpt-4o-mini"
        mock_settings.FALLBACK_TO_OPENAI = False

        client = OpenAIClient()
        assert client.is_local is False
        assert client.provider == "openai"
        assert client.model == "gpt-4o-mini"


def test_local_llm_url_normalization_in_settings():
    """Settings validator should normalize URLs missing /v1 and strip trailing slashes."""
    s1 = Settings(
        DATABASE_URL="sqlite+aiosqlite://",
        JWT_SECRET_KEY="x",
        LOCAL_LLM_URL="http://localhost:11434",
    )
    assert s1.LOCAL_LLM_URL == "http://localhost:11434/v1"

    s2 = Settings(
        DATABASE_URL="sqlite+aiosqlite://",
        JWT_SECRET_KEY="x",
        LOCAL_LLM_URL="http://localhost:11434/",
    )
    assert s2.LOCAL_LLM_URL == "http://localhost:11434/v1"

    s3 = Settings(
        DATABASE_URL="sqlite+aiosqlite://",
        JWT_SECRET_KEY="x",
        LOCAL_LLM_URL="http://host:8000/v1/",
    )
    assert s3.LOCAL_LLM_URL == "http://host:8000/v1"

    s4 = Settings(
        DATABASE_URL="sqlite+aiosqlite://", JWT_SECRET_KEY="x", LOCAL_LLM_URL=""
    )
    assert s4.LOCAL_LLM_URL is None


@pytest.mark.asyncio
async def test_native_tool_calling_success():
    """When the local model natively returns tool calls, they should be parsed accurately."""
    client = OpenAIClient(
        provider="ollama",
        base_url="http://localhost:11434/v1",
        model="llama3.1",
        fallback_to_openai=False,
    )

    mock_tool_call = MagicMock()
    mock_tool_call.id = "call_abc123"
    mock_tool_call.function.name = "create_task"
    mock_tool_call.function.arguments = (
        '{"title": "Schedule team sync", "priority": "high"}'
    )

    mock_choice = MagicMock()
    mock_choice.message.content = None
    mock_choice.message.tool_calls = [mock_tool_call]
    mock_choice.finish_reason = "tool_calls"

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    client._client.chat.completions.create = AsyncMock(return_value=mock_response)

    tools = [
        {
            "type": "function",
            "function": {"name": "create_task", "description": "Create a task"},
        }
    ]
    result = await client.complete(
        messages=[{"role": "user", "content": "Schedule sync"}], tools=tools
    )

    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].name == "create_task"
    assert result.tool_calls[0].arguments == {
        "title": "Schedule team sync",
        "priority": "high",
    }
    assert result.finish_reason == "tool_calls"


@pytest.mark.asyncio
async def test_graceful_tool_degradation_when_tools_unsupported():
    """If a local model rejects tools parameter, should degrade to prompt-guided JSON tool calling."""
    client = OpenAIClient(
        provider="ollama",
        base_url="http://localhost:11434/v1",
        model="tinyllama",
        fallback_to_openai=False,
    )

    # First call with tools parameter fails with BadRequestError
    error_response = MagicMock()
    error_response.status_code = 400
    bad_request_err = BadRequestError(
        message="model tinyllama does not support tools",
        response=error_response,
        body={"error": "model tinyllama does not support tools"},
    )

    # Fallback call without tools succeeds, returning JSON formatted tool call
    mock_choice = MagicMock()
    mock_choice.message.content = (
        "Here is your task request:\n```json\n"
        '{"name": "create_task", "arguments": {"title": "Call doctor tomorrow"}}\n'
        "```"
    )
    mock_choice.message.tool_calls = None
    mock_choice.finish_reason = "stop"

    mock_fallback_response = MagicMock()
    mock_fallback_response.choices = [mock_choice]

    client._client.chat.completions.create = AsyncMock(
        side_effect=[bad_request_err, mock_fallback_response]
    )

    tools = [
        {
            "type": "function",
            "function": {
                "name": "create_task",
                "description": "Create a task",
                "parameters": {
                    "type": "object",
                    "properties": {"title": {"type": "string"}},
                    "required": ["title"],
                },
            },
        }
    ]

    result = await client.complete(
        messages=[{"role": "user", "content": "Call doctor"}], tools=tools
    )

    assert client._client.chat.completions.create.call_count == 2
    # Verify fallback call did NOT include tools kwarg
    fallback_kwargs = client._client.chat.completions.create.call_args_list[1].kwargs
    assert "tools" not in fallback_kwargs
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].name == "create_task"
    assert result.tool_calls[0].arguments == {"title": "Call doctor tomorrow"}


@pytest.mark.asyncio
async def test_graceful_tool_degradation_conversational_response():
    """When degraded fallback model produces plain text conversation instead of tool call."""
    client = OpenAIClient(
        provider="ollama",
        base_url="http://localhost:11434/v1",
        model="tinyllama",
        fallback_to_openai=False,
    )

    bad_request_err = BadRequestError(
        message="unexpected parameter: tools",
        response=MagicMock(),
        body={},
    )

    mock_choice = MagicMock()
    mock_choice.message.content = "Hello! I can help you manage tasks and meetings."
    mock_choice.message.tool_calls = None
    mock_choice.finish_reason = "stop"

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    client._client.chat.completions.create = AsyncMock(
        side_effect=[bad_request_err, mock_response]
    )

    tools = [
        {
            "type": "function",
            "function": {"name": "create_task", "description": "Create a task"},
        }
    ]
    result = await client.complete(
        messages=[{"role": "user", "content": "Hello"}], tools=tools
    )

    assert len(result.tool_calls) == 0
    assert result.content == "Hello! I can help you manage tasks and meetings."


@pytest.mark.asyncio
async def test_fault_tolerant_cloud_fallback_on_local_connection_failure():
    """If local LLM is unreachable (connection error), automatically fall back to OpenAI cloud."""
    with patch("app.clients.openai_client.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "local"
        mock_settings.LOCAL_LLM_URL = "http://localhost:11434/v1"
        mock_settings.LOCAL_LLM_MODEL = "llama3.1"
        mock_settings.LOCAL_LLM_API_KEY = "ollama"
        mock_settings.OPENAI_API_KEY = "sk-valid-openai-key"
        mock_settings.OPENAI_MODEL = "gpt-4o"
        mock_settings.FALLBACK_TO_OPENAI = True

        client = OpenAIClient()
        assert client._fallback_client is not None

        # Local client raises APIConnectionError
        connection_err = APIConnectionError(request=MagicMock())
        client._client.chat.completions.create = AsyncMock(side_effect=connection_err)

        # Fallback client succeeds
        fallback_choice = MagicMock()
        fallback_choice.message.content = "Cloud fallback response"
        fallback_choice.message.tool_calls = None
        fallback_choice.finish_reason = "stop"

        fallback_response = MagicMock()
        fallback_response.choices = [fallback_choice]

        client._fallback_client.chat.completions.create = AsyncMock(
            return_value=fallback_response
        )

        result = await client.complete(messages=[{"role": "user", "content": "Hi"}])
        assert result.content == "Cloud fallback response"
        assert client._fallback_client.chat.completions.create.call_count == 1


@pytest.mark.asyncio
async def test_unreachable_without_fallback_raises_openai_request_error():
    """If local LLM is unreachable and no fallback is enabled, raise OpenAIRequestError."""
    with patch("app.clients.openai_client.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "local"
        mock_settings.LOCAL_LLM_URL = "http://localhost:11434/v1"
        mock_settings.LOCAL_LLM_MODEL = "llama3.1"
        mock_settings.LOCAL_LLM_API_KEY = "ollama"
        mock_settings.OPENAI_API_KEY = ""
        mock_settings.FALLBACK_TO_OPENAI = False

        client = OpenAIClient()
        assert client._fallback_client is None

        client._client.chat.completions.create = AsyncMock(
            side_effect=APIConnectionError(request=MagicMock())
        )

        with pytest.raises(OpenAIRequestError):
            await client.complete(messages=[{"role": "user", "content": "Hi"}])
