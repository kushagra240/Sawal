# SAWAL Architecture Audit

## Baseline architecture

Before this upgrade, SAWAL had five layers:

1. `core/llm.py` proposed structured interpretations with hosted Gemma, replay cache, or deterministic fallback.
2. `core/engine.py` cloned an in-memory world, ran candidate plans, grouped canonical effects, calculated expected regret, and chose ASK or ACT.
3. `core/tools.py` implemented eight allowlisted simulated tools: contact search, calendar list/create, restaurant search/book, email draft/send, and expense log.
4. `api/main.py` exposed in-memory sessions, mock world state, preferences, and benchmark routes.
5. `web/` displayed interpretations, clarification, effects, world state, and benchmark results.

All apparent side effects were mock-world mutations. There was no OAuth, external provider execution, confirmation state, idempotency, persistent expense storage, ownership isolation, provider capability reporting, or durable audit trail.

## Production boundary added

The interpretation and rehearsal engine remains unchanged. Live execution is deliberately outside it:

```text
request
  -> interpretations
  -> isolated mock rehearsals
  -> grouped effects and regret decision
  -> clarification (when required)
  -> immutable live action preview
  -> explicit confirmation (consequential actions)
  -> provider execution
  -> provider receipt + audit event
```

Key modules:

- `core/providers/base.py`: provider contract and structured errors.
- `core/providers/google.py`: Gmail, People, and Calendar REST integration.
- `core/oauth.py`: authorization-code OAuth with PKCE, expiring one-use state, refresh tokens, and revocation.
- `core/storage.py`: SQLite actions, audits, persistent expenses, and Fernet-encrypted OAuth credentials.
- `core/live.py`: previews, confirmation policy, action state machine, ownership, idempotency, provider dispatch, and truthful failures.

## Action states

- `asked`: clarification required; no external action.
- `ready`: reversible live action is prepared for immediate execution.
- `awaiting_confirmation`: exact consequential plan is frozen and awaiting approval.
- `executing`: provider call is in progress.
- `completed`: provider returned a successful receipt.
- `cancelled`: user cancelled before execution.
- `failed`: provider did not complete the action; no success is claimed.

## Security properties

- OAuth credentials are server-side only and encrypted at rest with `SAWAL_TOKEN_ENCRYPTION_KEY`.
- OAuth state is random, expiring, one-use, and bound to a PKCE verifier.
- Access tokens refresh server-side and are never returned to the browser.
- Session/action ownership is checked before read, answer, confirm, or cancel operations.
- Consequential operations require confirmation of the exact stored plan.
- Idempotency keys prevent repeated confirmations from repeating provider calls.
- Audit records contain status metadata, not OAuth tokens.
- `.env`, SQLite data, private keys, and generated credentials are ignored by Git.

The current local identity is a guest/session boundary rather than a multi-tenant production identity provider. A production deployment should replace guest identity with verified application authentication while retaining the same ownership checks.

## Capability status

| Capability | Implementation | Verification |
|---|---|---|
| Mock tools and benchmarks | Existing deterministic engine | Automated tests |
| Hosted Gemma proposal | Gemini API | Verified locally with real response |
| Gmail search/read | Google REST provider | Automated response tests; real OAuth verification required |
| Gmail draft | Google REST provider | Automated provider tests; real OAuth verification required |
| Gmail send | Preview + explicit confirmation + Google receipt | Automated safety/response tests; real send not performed |
| Google Contacts | People API search and ambiguity grounding | Implemented; real OAuth verification required |
| Google Calendar | list/free-busy/create/update/cancel | Implemented; real OAuth verification required |
| Expenses | Persistent per-user SQLite ledger | Automated tests |
| Restaurant reservations | No legitimate provider configured | Explicitly unavailable; never faked |

Real provider tests are intentionally opt-in. Automated tests never send email or mutate a real calendar.
