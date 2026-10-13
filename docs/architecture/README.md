# SAWAL Architecture Documentation

This directory contains the architecture specification and diagrams for SAWAL, reflecting the integrated ask-or-act safety layer and live agent execution system.

## Table of Contents
1. [Diagram A — System Architecture](#diagram-a--system-architecture)
2. [Diagram B — Ask-or-Act Decision Flow](#diagram-b--ask-or-act-decision-flow)
3. [Diagram C — Deployment and Trust Boundaries](#diagram-c--deployment-and-trust-boundaries)
4. [Source Files](#source-files)

---

## Diagram A — System Architecture

The system consists of a Next.js / TypeScript web application, a FastAPI REST layer, a deterministic ask-or-act decision core, an LLM interpretation layer (hosted Gemma with replay and fallback), isolated sandbox execution, and a live execution coordinator integrating Google OAuth, Gmail, Calendar, and local persistence.

```mermaid
graph TB
  subgraph Frontend ["Frontend (Next.js / React / TypeScript)"]
    UI["Web UI (Port 3000)"]
    ChatComp["Chat Column & Composer"]
    ConfComp["Action Confirmation Panel"]
    ConnComp["Connected Accounts Panel"]
    BenchComp["Benchmark Explorer & Sweep"]
  end

  subgraph API ["API Layer (FastAPI - Port 8000)"]
    Router["FastAPI Router (/v1 & /)"]
    SessionEp["POST /v1/sessions & /sessions/{id}/answer"]
    ConfirmEp["POST /v1/sessions/{id}/confirm & /cancel"]
    OAuthEp["GET /v1/oauth/google/connect & callback"]
    ConnEp["GET /v1/connections & /providers/capabilities"]
    BenchEp["GET /v1/benchmark/summary & runs"]
  end

  subgraph CoreDecisionEngine ["Ask-or-Act Decision Engine (Deterministic)"]
    Engine["core.engine: create_session & answer_session"]
    Ambiguity["Candidate Interpretation Analysis"]
    DecisionLogic{"Expected Regret <= Tau (0.25)?"}
    QuestionBuilder["Clarification Question & Options Builder"]
  end

  subgraph LLMLayer ["LLM Interpretation Layer"]
    LLMClient["core.llm: propose_with_meta"]
    Validation["Tool Call Schema & Parameter Validation"]
    HostedGemma["Hosted Gemma (Gemini API / Generative Language)"]
    CacheReplay["Offline Replay Cache (benchmark/replay_cache)"]
    DeterministicFallback["Deterministic Mock Fallback Engine"]
  end

  subgraph MockExecution ["Mock / Sandbox Execution Layer"]
    SimWorld["In-Memory Seed World (Contacts, Emails, Calendar, Restaurants)"]
    CloneWorld["Isolated Cloned Sandbox Worlds"]
    MockTools["core.tools: Allowlisted Mock Tools (8 Simulated Handlers)"]
  end

  subgraph LiveService ["Live Execution Coordinator"]
    LiveExec["core.live: LiveExecutionService"]
    PlanPreview["Exact-Plan Preview Generator"]
    IdempotencyEngine["SHA-256 Idempotency Key Engine"]
    StateTracker["Action State Machine (ready | awaiting_confirmation | executing | completed | cancelled | failed)"]
  end

  subgraph AuthAndStorage ["Security, OAuth & Durable Storage"]
    OAuthMgr["core.oauth: GoogleOAuthManager (PKCE S256 + Expiring State)"]
    Store["core.storage: AgentStore (SQLite .data/sawal.db)"]
    Cipher["core.storage: CredentialCipher (Fernet / AES-128-CBC)"]
    AuditLog["Durable Audit Trail (audit_events table)"]
    ExpenseLedger["Persistent Expense Ledger (expenses table)"]
  end

  subgraph ExternalProviders ["External Integrations"]
    GoogleProv["core.providers.google: GoogleProvider"]
    Gmail["Google Gmail API (messages, drafts, compose)"]
    Calendar["Google Calendar API (events, freeBusy)"]
    People["Google People API (contacts search)"]
    RestUnavail["Restaurant Reservations (Explicitly Unavailable)"]
  end

  subgraph Tooling ["Verification & Benchmarking Tooling"]
    Pytest["Automated Test Suite (39 Pytest Unit & Integration Tests)"]
    Probe["benchmark/probe_hosted.py (Hosted Gemma Live Probe)"]
    BenchmarkRunner["benchmark/runner.py (Sweep & Policy Evaluation)"]
  end

  %% Flow lines
  UI --> Router
  Router --> SessionEp
  Router --> ConfirmEp
  Router --> OAuthEp
  Router --> ConnEp
  Router --> BenchEp

  SessionEp --> Engine
  Engine --> LLMClient
  LLMClient -.->|"Live Mode"| HostedGemma
  LLMClient -.->|"Replay Mode"| CacheReplay
  LLMClient -.->|"Missing Key / Fallback"| DeterministicFallback
  HostedGemma --> Validation
  CacheReplay --> Validation
  DeterministicFallback --> Validation
  Validation --> Ambiguity

  Ambiguity --> CloneWorld
  CloneWorld --> MockTools
  MockTools --> DecisionLogic

  DecisionLogic -->|"No (Regret > Tau)"| QuestionBuilder
  QuestionBuilder -->|"Status: asked"| UI
  DecisionLogic -->|"Yes (Regret <= Tau) & Mock Mode"| SimWorld
  DecisionLogic -->|"Yes (Regret <= Tau) & Live Mode"| LiveExec

  LiveExec --> PlanPreview
  PlanPreview --> IdempotencyEngine
  IdempotencyEngine --> StateTracker
  StateTracker --> Store

  ConfirmEp --> LiveExec
  LiveExec -->|"Consequential Action Confirmed"| GoogleProv
  LiveExec -->|"Expense Action"| ExpenseLedger
  LiveExec -->|"Restaurant Request"| RestUnavail

  OAuthEp --> OAuthMgr
  OAuthMgr --> Cipher
  Cipher --> Store

  GoogleProv --> Gmail
  GoogleProv --> Calendar
  GoogleProv --> People

  LiveExec --> AuditLog
  OAuthMgr --> AuditLog

  BenchEp --> BenchmarkRunner
```

---

## Diagram B — Ask-or-Act Decision Flow

Every user instruction passes through interpretation, rehearsal, regret calculation, and exact-plan validation. If uncertainty or reversibility risk is high (`expected_regret > tau`), SAWAL asks a targeted clarifying question instead of acting prematurely. If the action is consequential in live mode, an immutable preview and idempotency key are generated, requiring explicit confirmation before provider execution.

```mermaid
flowchart TD
  Start(["User Instruction (request_text)"]) --> ModeCheck{"tool_mode setting"}

  ModeCheck -->|"live"| GroundContacts["Enrich Contacts via Google Contacts API (if connected)"]
  ModeCheck -->|"mock"| DirectSeed["Use In-Memory Seed World"]

  GroundContacts --> ProposeInterpretations["Generate Candidate Interpretations (core.llm)"]
  DirectSeed --> ProposeInterpretations

  ProposeInterpretations --> LLMProviderBranch{"LLM Provider / Mode Selection"}
  LLMProviderBranch -->|"Live API & GEMINI_API_KEY set"| HostedCall["Call Google Gemini REST API"]
  LLMProviderBranch -->|"Replay Mode / Cache exists"| ReplayHit["Load from Replay Cache"]
  LLMProviderBranch -->|"Missing Key or Request Failure"| FallbackMock["Deterministic Mock Fallback"]

  HostedCall --> ValidateSchema{"Validate Tool Calls & Args (core.tools.validate_call)"}
  ReplayHit --> ValidateSchema
  FallbackMock --> ValidateSchema

  ValidateSchema -->|"Valid Tools"| SandboxRehearsal["Rehearse Each Plan in Cloned World Sandbox"]
  ValidateSchema -->|"Invalid Tool"| RejectTool["Strip Invalid Tool / Fallback"]
  RejectTool --> SandboxRehearsal

  SandboxRehearsal --> GroupEffects["Cluster Interpretations by Canonical Effect Signature"]
  GroupEffects --> RegretCalc["Compute Expected Regret vs Tau (default: 0.25)"]

  RegretCalc --> RegretDecision{"Expected Regret > Tau?"}

  RegretDecision -->|"YES: Ambiguity / High Regret"| BuildQuestion["Construct Disambiguation Question & Options (Status: asked)"]
  BuildQuestion --> PresentUser["Return Question to User in UI"]
  PresentUser --> UserAnswers["User Submits Answer (/v1/sessions/{id}/answer)"]
  UserAnswers --> FilterInterpretations["Filter Candidate Interpretations to Matching Outcome"]
  FilterInterpretations --> SandboxRehearsal

  RegretDecision -->|"NO: Low Regret / Resolved"| ExecutionModeBranch{"tool_mode == 'live'?"}

  ExecutionModeBranch -->|"mock"| ExecuteSandbox["Apply Effects to In-Memory World (Status: completed)"]
  ExecuteSandbox --> ReturnMockReceipt["Return Session Result & World Diff"]

  ExecutionModeBranch -->|"live"| FreezePlan["Freeze Exact Plan & Generate Preview (core.live)"]
  FreezePlan --> ComputeIdempotency["Generate SHA-256 Idempotency Key"]
  ComputeIdempotency --> CheckConsequential{"Plan Contains Consequential Tools? (email.send, calendar.create/update/cancel, restaurants.book)"}

  CheckConsequential -->|"YES: High Risk"| AwaitConfirm["State: awaiting_confirmation"]
  AwaitConfirm --> UserConfirmDecision{"User Action via UI"}
  UserConfirmDecision -->|"POST /sessions/{id}/cancel"| MarkCancelled["State: cancelled (Audit: ACTION_CANCELLED)"]
  UserConfirmDecision -->|"POST /sessions/{id}/confirm"| VerifyConfirmation["Verify Ownership & Idempotency Key"]

  CheckConsequential -->|"NO: Low Risk (draft, list, expense)"| StateReady["State: ready"]
  StateReady --> VerifyConfirmation

  VerifyConfirmation --> CheckActionState{"Action Current State"}
  CheckActionState -->|"Already completed"| ReturnCachedReceipt["Return Cached Execution Result (Idempotent)"]
  CheckActionState -->|"Cancelled or Failed"| RejectExecution["HTTP 409 Conflict (Action already terminal)"]
  CheckActionState -->|"awaiting_confirmation or ready"| BeginExecution["State: executing (Audit: ACTION_EXECUTION_STARTED)"]

  BeginExecution --> ExecuteToolDispatch["Dispatch Tools to Providers"]

  ExecuteToolDispatch --> ToolTypeBranch{"Tool Domain"}
  ToolTypeBranch -->|"Google (Gmail, Calendar, People)"| GoogleCheckToken["Validate Token -> Refresh if Expired -> Call Google REST API"]
  ToolTypeBranch -->|"Expenses (expenses.log/list)"| SQLiteExpense["Record / Query SQLite Expense Ledger"]
  ToolTypeBranch -->|"Restaurants (restaurants.*)"| RestReject["Raise ProviderUnavailable (Truthful: No Booking Made)"]

  GoogleCheckToken --> ProviderOutcome{"Provider Response"}
  SQLiteExpense --> ProviderOutcome
  RestReject --> ProviderOutcome

  ProviderOutcome -->|"Success"| MarkCompleted["State: completed + Provider Receipt (Audit: ACTION_COMPLETED)"]
  ProviderOutcome -->|"Provider Error / Timeout"| MarkFailed["State: failed + Error Details (Audit: ACTION_FAILED)"]

  MarkCompleted --> FinalResponse(["Update Session Status & Return Response to Client"])
  MarkFailed --> FinalResponse
  MarkCancelled --> FinalResponse
  ReturnCachedReceipt --> FinalResponse
  ReturnMockReceipt --> FinalResponse
```

---

## Diagram C — Deployment and Trust Boundaries

The system enforces five strict security and trust boundaries, preventing secret leakage, unauthorized actions, and credential abuse.

```mermaid
graph TB
  subgraph UntrustedZone ["Client / Browser Zone (Untrusted)"]
    direction TB
    Browser["User Browser / Client App"]
    NextUI["Next.js Web Frontend (Port 3000)"]
    Cookie["Client Session Cookie (sawal_user_id)"]
    NoSecrets["No API Keys / No OAuth Tokens Stored Here"]
  end

  subgraph Boundary1 ["Trust Boundary 1: Transport & Frontend-Backend Boundary"]
    direction TB
    Proxy["Next.js API Rewrite Proxy (/api/:path* -> :8000/:path*)"]
    RateLimiter["FastAPI In-Memory Rate Limiter (60 req/min/IP)"]
    CORSMiddleware["FastAPI CORS Policy (Strict Allowed Origins)"]
  end

  subgraph AppBoundary ["Application / API Service Zone (Trusted Execution)"]
    direction TB
    FastAPIApp["FastAPI REST API (:8000)"]
    UserIsolation["User & Session Isolation Guard (_user_id verification)"]
    DecisionCore["Ask-or-Act Decision Core (core.engine)"]
    LiveCoordinator["Live Execution Service (core.live)"]
    ExactPlanFreeze["Exact Plan Frozen Preview & SHA-256 Key"]
  end

  subgraph Boundary2 ["Trust Boundary 2: User Confirmation Boundary"]
    direction TB
    ExplicitApproval["User Explicit Approval (POST /confirm with idempotency_key)"]
    ConsequentialGate["Consequential Action Gate (email.send, calendar mutators)"]
  end

  subgraph ExternalLLMBoundary ["Trust Boundary 3: LLM Provider Egress"]
    direction TB
    OutboundTLS1["Outbound HTTPS / TLS 1.3"]
    Sanitizer["Credential Sanitizer (_sanitize_message: strips API keys & tokens)"]
    GeminiAPI["Google Gemini API (generativelanguage.googleapis.com)"]
  end

  subgraph ExternalOAuthBoundary ["Trust Boundary 4: OAuth & External Provider Egress"]
    direction TB
    PKCEVerifier["OAuth 2.0 PKCE S256 + 10-Minute Expiring State Verifier"]
    TokenManager["Server-Side Token Refresh (tokens never sent to browser)"]
    GoogleAPIs["External Google APIs (Gmail, Calendar, People)"]
  end

  subgraph DurableStorageBoundary ["Trust Boundary 5: Durable Storage & Secrets Boundary"]
    direction TB
    FernetCipher["CredentialCipher (AES-128-CBC + HMAC via Fernet)"]
    EnvPrecedence["Process Env Precedence over .env"]
    SQLiteDB[("SQLite Database (.data/sawal.db)")]
    AuditTrail["Append-Only Audit Log (audit_events table)"]
    EncryptedCreds["provider_connections table (encrypted_credentials)"]
    ActionTable["actions table (user_id + idempotency_key UNIQUE)"]
  end

  %% Connections & Cross-Boundary Flows
  Browser -->|"HTTP / REST Requests"| Proxy
  Proxy --> CORSMiddleware
  CORSMiddleware --> RateLimiter
  RateLimiter --> FastAPIApp

  FastAPIApp --> UserIsolation
  UserIsolation --> DecisionCore
  DecisionCore --> LiveCoordinator

  LiveCoordinator --> ExactPlanFreeze
  ExactPlanFreeze --> ConsequentialGate
  ConsequentialGate -->|"Requires User Approval"| Browser
  Browser -->|"Signs with Idempotency Key"| ExplicitApproval
  ExplicitApproval --> LiveCoordinator

  DecisionCore -->|"Prompt Request"| Sanitizer
  Sanitizer --> OutboundTLS1
  OutboundTLS1 --> GeminiAPI

  LiveCoordinator --> TokenManager
  TokenManager --> GoogleAPIs
  FastAPIApp --> PKCEVerifier
  PKCEVerifier --> GoogleAPIs

  LiveCoordinator --> FernetCipher
  TokenManager --> FernetCipher
  FernetCipher --> EncryptedCreds
  LiveCoordinator --> ActionTable
  LiveCoordinator --> AuditTrail

  EncryptedCreds --- SQLiteDB
  ActionTable --- SQLiteDB
  AuditTrail --- SQLiteDB
```

---

## Source Files

- System Architecture Source: [`system_architecture.mmd`](./system_architecture.mmd)
- Ask-or-Act Decision Flow Source: [`decision_flow.mmd`](./decision_flow.mmd)
- Trust Boundaries Source: [`trust_boundaries.mmd`](./trust_boundaries.mmd)
- Comprehensive Architecture Audit: [`../ARCHITECTURE_AUDIT.md`](../ARCHITECTURE_AUDIT.md)
