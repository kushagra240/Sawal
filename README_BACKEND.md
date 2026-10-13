# Sawal backend

Teammate A owns the backend-only implementation in `core/`, `api/`, `benchmark/`, and `tests/`. The web app is intentionally untouched.

Sawal generates candidate plans, rehearses them in cloned in-memory worlds, groups equivalent effects, computes expected regret, and either acts or asks a clarification question. All tool effects are still simulated in the seeded mock world; no real email, booking, calendar event, or payment is performed.

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn api.main:app --reload --port 8000
```

Swagger: `http://localhost:8000/docs`

The existing API routes are unchanged. `POST /v1/sessions` now also accepts an optional `llm_mode` field: `live`, `record`, `replay`, or `auto`.

## Hosted Gemma 4 through Gemini API

Google's current Gemma-on-Gemini-API documentation lists both of these hosted Gemma 4 IDs:

- `gemma-4-26b-a4b-it`
- `gemma-4-31b-it`

The default provider is the native Gemini API `generateContent` endpoint. Google's Gemma-specific guide explicitly documents system instructions and function calling for Gemma 4. That guide does **not** document Gemma 4 structured-output/JSON mode, so Sawal requests JSON in plain text, strips code fences/noise, parses the first JSON object/array it can recover, then validates every generated tool call against Sawal's existing tool schemas before accepting it.

Google also documents the OpenAI-compatibility base URL as `https://generativelanguage.googleapis.com/v1beta/openai/`. The optional `openai_compatible` provider attempts `response_format={"type":"json_object"}` and, when the endpoint rejects that parameter with a 400/404/422, retries once without it and remembers that capability result for the process.

### PowerShell hosted run

```powershell
$env:LLM_PROVIDER="gemini"
$env:GEMINI_API_KEY="<YOUR_AI_STUDIO_KEY>"
$env:GEMMA_MODEL_ID="gemma-4-26b-a4b-it"
$env:LLM_MODE="live"
$env:LLM_MAX_RPM="10"
$env:LLM_TIMEOUT_SECONDS="60"

.\.venv\Scripts\python.exe -m uvicorn api.main:app --reload --port 8000
```

Never commit `.env` or the API key. `.gitignore` explicitly excludes `.env` and `.env.*` while keeping `.env.example` trackable.

## LLM modes and provenance

- `live`: call the hosted model.
- `record`: call the hosted model and save validated proposals under `benchmark/replay_cache/`.
- `replay`: read replay cache only; a miss becomes an explicit fallback unless strict mode is on.
- `auto`: try live, then replay, then deterministic fallback.

Every session includes additive provenance:

```json
{
  "proposer": {
    "kind": "llm | replay | deterministic_fallback",
    "model": "gemma-4-26b-a4b-it",
    "valid_plans": 5,
    "latency_ms": 1234,
    "fallback_reason": "present only when applicable"
  }
}
```

Fallbacks also add a `PROPOSER_FALLBACK` trace event. `SAWAL_STRICT=1` turns fallback into an error, which is required for judge-facing live benchmark runs.

## Rate limiting and retry behavior

`LLM_MAX_RPM` defaults to 10. A process-wide sliding-window limiter queues callers. 429 and 5xx responses are retried with exponential backoff up to `LLM_MAX_RETRIES`. The default timeout is 60 seconds.

Google's public rate-limit documentation says active RPM/TPM/RPD limits are project- and tier-specific and must be viewed in AI Studio. Therefore the repository does not claim a project-specific rate limit until it is observed in the user's AI Studio project.

The proposal path uses one logical model call per user request. Sawal currently phrases clarification questions with deterministic templates, so there is no second question-phrasing model call. Transport retries and the one-time OpenAI `response_format` compatibility retry can add physical calls only on errors.

## Replay cache

Cache key:

```text
sha256(provider, model, prompt)
```

Recorded files live under:

```text
benchmark/replay_cache/
```

They contain prompt hashes, validated interpretations, raw model text, provider metadata, and timestamps. They never contain an API key.

## Fork-friendly response fields

Each interpretation includes `group_id` and `reversibility`.

Each session also includes:

```json
{
  "groups": [
    {
      "id": "grp-...",
      "size": 3,
      "effects": []
    }
  ]
}
```

Each effect includes:

- `reversibility: "reversible"` when weight `< 0.7`
- `reversibility: "irreversible"` when weight `>= 0.7`

Interpretations with no effects are marked `reversibility: "readonly"`.

All pre-existing response fields remain present.

## Honest benchmark

`benchmark/tasks.json` contains hidden intended slots/effects used only by the simulated user/evaluator. The proposer never receives hidden intent.

The runner generates proposals exactly once per task, then reuses those proposals for:

- `always_act`
- `always_ask`
- optional `ask_if_model_unsure` when a live hosted proposer was actually available
- Sawal across the tau sweep

Metrics are computed from executed final effects, not task-count formulas:

- `wrong_action_rate`
- `questions_per_task`
- `unnecessary_question_rate`
- `missed_ask_rate`
- `irreversible_error_rate`

A wrong action means the produced final mutation effects do not match hidden intended effects. An irreversible error is a wrong action that actually produced an effect with reversibility `irreversible`.

### Call budget

There are 24 benchmark tasks, so a clean hosted `record` run should use about 24 proposal calls, plus only exceptional retry calls. At the default `LLM_MAX_RPM=10`, a sliding-window limiter needs a minimum of about 120 seconds to dispatch 24 calls after the initial burst; model latency makes the real wall-clock duration longer. A conservative sequential estimate is roughly 2-3 minutes before retries.

### Live evidence run

After confirming the project-specific limit in AI Studio:

```powershell
$env:LLM_PROVIDER="gemini"
$env:GEMINI_API_KEY="<YOUR_AI_STUDIO_KEY>"
$env:GEMMA_MODEL_ID="gemma-4-26b-a4b-it"
$env:LLM_MODE="record"
$env:SAWAL_LLM_MODE="record"
$env:SAWAL_STRICT="1"
$env:LLM_MAX_RPM="<YOUR_VERIFIED_RPM>"

.\.venv\Scripts\python.exe -m benchmark.probe_hosted
.\.venv\Scripts\python.exe -m benchmark.runner
```

The first command probes five demo requests and prints latency, valid plan count, and distinct plan count. The second writes measured results to `benchmark/results/latest_summary.json` and replay evidence to `benchmark/replay_cache/`.

Do not label a run as live evidence if any task used deterministic fallback.

## Verification

Network-free unit tests:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Offline benchmark (falls back explicitly when no hosted credential is present):

```powershell
.\.venv\Scripts\python.exe -m benchmark.runner
```

The HTTP tests mock the LLM transport; the test suite never requires network access.
