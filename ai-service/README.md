# Todotak AI Service

The `ai-service` is an autonomous conversational productivity agent that manages tasks, meetings, and reminders through natural language tool calling. It supports both **Cloud OpenAI** (`gpt-4o`, `gpt-4o-mini`) and **Self-Hosted Local Inference Engines** ([Ollama](https://ollama.com/) and [vLLM](https://github.com/vllm-project/vllm)).

---

## Features

- **Dual-Engine LLM Support**: Run with cloud OpenAI or completely private, offline, self-hosted local models.
- **Dynamic Provider Routing**: Configure `LLM_PROVIDER=auto`, `openai`, `local`, `ollama`, or `vllm`.
- **OpenAI-Compatible Standard**: Connects seamlessly to any server exposing the standard `/v1/chat/completions` API.
- **Graceful Tool Calling Degradation**: If a local model does not natively support the OpenAI `tools` parameter, the client automatically degrades to prompt-guided JSON tool calling with robust response extraction.
- **Fault-Tolerant Cloud Fallback**: Automatically falls back to cloud OpenAI if the local inference instance is unreachable or experiences a connection failure (when `FALLBACK_TO_OPENAI=true` and `OPENAI_API_KEY` is provided).
- **Interactive Swagger Documentation**: Inspect active configuration, model name, and engine status directly from Swagger UI (`/docs` or `GET /api/v1/ai/config`).

---

## Configuration Reference

The service reads the following environment variables (set in `.env` or Docker Compose):

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `LLM_PROVIDER` | string | `auto` | Routing mode: `auto`, `openai`, `local`, `ollama`, `vllm`. |
| `LOCAL_LLM_URL` | string | `None` | Base URL for local inference (e.g. `http://host.docker.internal:11434/v1`). |
| `LOCAL_LLM_MODEL` | string | `llama3.1` | Model name on the local inference engine (e.g. `llama3.1`, `qwen2.5`, `mistral`). |
| `LOCAL_LLM_API_KEY` | string | `ollama` | Dummy API key passed in the Authorization header to satisfy SDK validation. |
| `FALLBACK_TO_OPENAI` | bool | `true` | If `true` and local engine is down, fallback to OpenAI if `OPENAI_API_KEY` is present. |
| `OPENAI_API_KEY` | string | `""` | OpenAI API key for cloud inference or fallback. |
| `OPENAI_MODEL` | string | `gpt-4o` | Cloud OpenAI model name. |
| `OPENAI_TEMPERATURE`| float | `0.3` | Sampling temperature for completion requests. |
| `MAX_TOOL_ITERATIONS`| int | `5` | Maximum number of tool iterations per user query turn. |

---

## Running with Local Models (Ollama)

### 1. Install & Launch Ollama on Host Machine

Download and install Ollama from [ollama.com](https://ollama.com/).

Pull and start your preferred model:

```bash
# Recommended models with strong tool-calling performance:
ollama pull llama3.1
# Alternatively:
# ollama pull qwen2.5:7b
# ollama pull mistral
```

Verify that Ollama is serving requests:

```bash
curl http://localhost:11434/v1/models
```

### 2. Configure Todotak for Ollama

#### Scenario A: Running Todotak inside Docker Compose
When Todotak runs inside Docker and Ollama runs on your host machine (macOS or Linux), Docker containers reach your host machine via `host.docker.internal`:

Add the following to your root `.env`:

```env
LLM_PROVIDER=auto
LOCAL_LLM_URL=http://host.docker.internal:11434/v1
LOCAL_LLM_MODEL=llama3.1
LOCAL_LLM_API_KEY=ollama
FALLBACK_TO_OPENAI=true
```

*(Note: `docker-compose.yml` already includes `extra_hosts: ["host.docker.internal:host-gateway"]` to route `host.docker.internal` reliably across Linux and macOS.)*

#### Scenario B: Running `ai-service` directly on Host (Standalone)
If running `ai-service` directly with Python:

```env
LLM_PROVIDER=auto
LOCAL_LLM_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=llama3.1
```

### 3. Verify Active Engine

Start the containers:

```bash
make up
```

Open Swagger UI at [http://localhost:8003/docs](http://localhost:8003/docs):
- Check the `/health` endpoint:
  ```json
  {
    "status": "ok",
    "service": "ai-service",
    "llm_provider": "local",
    "llm_model": "llama3.1",
    "is_local": true,
    "base_url": "http://host.docker.internal:11434/v1"
  }
  ```
- Or call `GET /api/v1/ai/config`:
  ```json
  {
    "provider": "local",
    "model": "llama3.1",
    "is_local": true,
    "base_url": "http://host.docker.internal:11434/v1",
    "tool_calling_supported": true,
    "fallback_enabled": true
  }
  ```

---

## Running with vLLM

vLLM provides high-throughput OpenAI-compatible model serving.

### 1. Launch vLLM Server

```bash
python -m vllm.entrypoints.openai.api_server \
  --model mistralai/Mistral-7B-Instruct-v0.3 \
  --port 8000 \
  --chat-template ./examples/tool_chat_template_mistral.jinja
```

### 2. Configure Todotak for vLLM

In `.env`:

```env
LLM_PROVIDER=vllm
LOCAL_LLM_URL=http://host.docker.internal:8000/v1
LOCAL_LLM_MODEL=mistralai/Mistral-7B-Instruct-v0.3
LOCAL_LLM_API_KEY=EMPTY
```

---

## Tool Calling & Graceful Degradation

1. **Native OpenAI Function Calling**:
   If the local model and engine support OpenAI's `tools` parameter (e.g., Llama 3.1+, Qwen 2.5), tool calls are executed natively.
2. **Prompt-Guided Fallback**:
   If the model throws a 400 error indicating `tools` is unsupported, the `OpenAIClient` intercepts the error, injects tool schemas and formatting instructions into the prompt, and completes without the `tools` parameter. Tool invocations formatted as JSON code blocks are parsed and passed into the Todotak agent execution loop.

---

## Testing

Run unit tests for local LLM routing and degradation:

```bash
pytest ai-service/tests/unit/test_local_llm_client.py ai-service/tests/unit/test_ai_config_api.py -v
```
