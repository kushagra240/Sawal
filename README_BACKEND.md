# Sawal backend P0

This folder contains Teammate A's isolated backend implementation: FastAPI routes, the deterministic in-memory rehearsal engine, allowlisted mock tools, and a 24-task benchmark.

## Run locally

```bash
cd Sawal
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

The offline deterministic mode is the default. Open `http://localhost:8000/docs` for the API. The UI can call `POST /v1/sessions` with `{"request_text":"Send an email to Priya confirming the lab slot"}` and then `POST /v1/sessions/{id}/answer` with the returned question and selected option.

## Use local Gemma through Ollama

Copy `.env.example` to `.env`, set `SAWAL_LLM_MODE=auto`, and start Ollama with `ollama serve`. The backend calls the OpenAI-compatible local endpoint and falls back to deterministic proposals if Ollama is unavailable. `SAWAL_LLM_MODE=live` currently has the same safe fallback behavior in this hack-day P0.

## Verify

```bash
python -m unittest discover -s tests -v
python -m benchmark.runner
```

All actions affect only the seeded mock world. This P0 has guest demo mode and in-memory storage; it does not implement production authentication or persistent storage.


## Live Gemma ask-or-act demo

On Windows PowerShell:

```powershell
$env:SAWAL_LLM_MODE="live"
$env:SAWAL_MODEL="gemma4:e2b"
$env:OPENAI_BASE_URL="http://localhost:11434/v1"
$env:SAWAL_LLM_TIMEOUT="90"

.\.venv\Scripts\python.exe -m uvicorn api.main:app --reload --port 8001
```

For an ambiguous request such as "Send an email to Priya confirming the lab slot.", Sawal rehearses candidate plans first.

If multiple matching contacts exist, it asks which contact the user intended before executing the selected plan.

All write actions in this demo affect only the seeded in-memory mock world. No real email or booking is performed.
