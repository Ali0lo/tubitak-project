"""Unit tests for AI service /health, /api/v1/ai/config, and OpenAPI documentation."""

from unittest.mock import patch

from starlette.testclient import TestClient

from app.main import create_app


def test_health_endpoint_defaults():
    """Verify /health reflects default settings."""
    app = create_app()
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "ai-service"
    assert "llm_provider" in data
    assert "llm_model" in data
    assert "is_local" in data


def test_ai_config_endpoint_with_local_llm():
    """Verify /api/v1/ai/config reflects active local LLM configuration."""
    with patch("app.clients.openai_client.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "ollama"
        mock_settings.LOCAL_LLM_URL = "http://host.docker.internal:11434/v1"
        mock_settings.LOCAL_LLM_MODEL = "qwen2.5:7b"
        mock_settings.LOCAL_LLM_API_KEY = "ollama"
        mock_settings.OPENAI_API_KEY = ""
        mock_settings.FALLBACK_TO_OPENAI = False

        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/ai/config")
        assert response.status_code == 200
        data = response.json()
        assert data["provider"] == "ollama"
        assert data["model"] == "qwen2.5:7b"
        assert data["is_local"] is True
        assert data["base_url"] == "http://host.docker.internal:11434/v1"
        assert data["tool_calling_supported"] is True
        assert data["fallback_enabled"] is False


def test_openapi_documentation_contains_local_llm_guidelines():
    """Verify Swagger OpenAPI docs reflect local LLM features and configuration."""
    app = create_app()
    client = TestClient(app)
    response = client.get("/openapi.json")
    assert response.status_code == 200
    openapi = response.json()
    desc = openapi["info"]["description"]
    assert "Ollama & vLLM" in desc
    assert "LOCAL_LLM_URL" in desc
    assert "LLM_PROVIDER" in desc
    assert "/api/v1/ai/config" in openapi["paths"]
