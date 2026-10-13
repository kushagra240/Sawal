# Sawal — Ask-or-Act Agent

Sawal generates multiple interpretations, rehearses their effects, compares outcomes, asks only when ambiguity matters, and executes an authorized plan. It supports a deterministic mock mode and a provider-backed live mode.

## Run locally

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000

# In a second terminal
npm --prefix web install
npm --prefix web run dev
```

Open http://localhost:3000. API documentation is available at http://localhost:8000/docs.

## Execution modes

- **Mock:** Runs every tool against an isolated in-memory world. This remains the default for tests, benchmarks, and demos.
- **Live:** Uses an authorized Google account for Gmail, Contacts, and Calendar. Consequential plans pause at `awaiting_confirmation`; the exact immutable preview must be approved before execution.

Live Gmail drafts are reversible and may be created after a clear request. Gmail sends, Calendar mutations, and reservation attempts require explicit confirmation. A Gmail `message_id` means Gmail accepted the send request; Sawal never claims delivery or reading without evidence.

Restaurant booking is intentionally unavailable until a legitimate provider is configured. Live mode never simulates a successful reservation.

## Google OAuth setup

Follow [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md). Credentials and tokens stay server-side. Never commit `.env`.

## Tests

```powershell
$env:LLM_MODE="mock"
.\.venv\Scripts\python.exe -m pytest -q
npm --prefix web run lint
npx --prefix web tsc --noEmit
```

See [docs/ARCHITECTURE_AUDIT.md](docs/ARCHITECTURE_AUDIT.md) for the repository audit, security boundaries, and verified/unverified capability matrix.
