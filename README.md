# 1. Sawal

**Sawal (सवाल): An assistant that only interrupts you when it matters.**  
*Built with open-weight models (default: Gemma 4)*

- **Product Name:** Sawal
- **Team:** Jugaad Labs
- **Tagline:** An assistant that only interrupts you when it matters.
- **Event:** Hacktoberfest Hack Day Pune x Cloud Computing Club (13 October 2026, One Day, In-Person)
- **Primary Track:** Best Open-Source AI Project
- **Secondary Track:** Best Use of Gemma 4
- **Foundation Model Architecture:** Strictly Open-Weight (Gemma 4 default, Llama, Mistral, Qwen supported)
- **License:** Apache-2.0

---

## Table of Contents
1. [Title, Tagline, Badges-Free Header](#1-sawal)
2. [Overview and Layman Explanation](#2-overview-and-layman-explanation)
3. [The Problem and Evidence](#3-the-problem-and-evidence)
4. [How It Works](#4-how-it-works)
5. [Core Algorithm Specification](#5-core-algorithm-specification)
6. [Architecture and Repository Tree with Owners](#6-architecture-and-repository-tree-with-owners)
7. [Mock World and Tool Schemas](#7-mock-world-and-tool-schemas)
8. [API Reference](#8-api-reference)
9. [Data Model](#9-data-model)
10. [Frontend and Design Handoff](#10-frontend-and-design-handoff)
11. [Authentication and Security](#11-authentication-and-security)
12. [AI and LLM Layer](#12-ai-and-llm-layer)
13. [Benchmark and Evaluation](#13-benchmark-and-evaluation)
14. [Setup and Run](#14-setup-and-run)
15. [Testing and Acceptance Scenarios](#15-testing-and-acceptance-scenarios)
16. [Team Split, Merge Protocol, and 3-Hour Plan](#16-team-split-merge-protocol-and-3-hour-plan)
17. [Deployment and Runbook](#17-deployment-and-runbook)
18. [Hackathon Track Compliance](#18-hackathon-track-compliance)
19. [Related Work](#19-related-work)
20. [Limitations and Ethics](#20-limitations-and-ethics)
21. [Roadmap](#21-roadmap)
22. [License and Contributing](#22-license-and-contributing)

---

## 2. Overview and Layman Explanation

### 2.1 One-Paragraph Technical Overview
**Sawal** (Hindi for *Question*) is an open-source model harness that decides whether an AI assistant should **ask** for clarification or **act** immediately based on the simulated effects of its actions. Designed with an open-source-first philosophy, every inference step—including interpretation generation, question phrasing, answer mapping, and evaluation baselines—is restricted strictly to **open-weight foundation models** (defaulting to hosted Gemma 4 via the Google Gemini API, or any open model via an OpenAI-compatible endpoint such as Ollama, vLLM, or Together); closed-source commercial APIs are barred at startup via a configurable family allowlist. When presented with an underspecified or ambiguous user prompt, Sawal prompts an open-weight model to generate $K=5$ distinct interpretations as structured tool-call plans, executes each plan inside an in-memory sandbox against a cloned mock world state, clusters the interpretations by their canonical state changes, and calculates the expected regret of acting on the majority interpretation. If the interpretations converge on the same real-world effect, or if divergent effects carry low cost (such as creating an email draft or reading a calendar), Sawal executes immediately without interrupting the user. If the diverging plans produce high-stakes, irreversible consequences (such as dispatching an email to the wrong executive or booking an expensive non-refundable dinner), Sawal computes which slot ambiguity accounts for the highest regret, prompts Gemma to frame a single targeted question with pre-computed options, and pauses until clarified. The open-weight LLM provides linguistic reasoning and structured proposals; deterministic Python code governs all policy and execution decisions.

### 2.2 Layman Explanation
Imagine you ask your human assistant, *"Reserve dinner at our usual spot tonight and message Priya."* 
- A reckless assistant guesses: they message the wrong Priya (your manager instead of your classmate) and book a ₹5,000 non-refundable dinner at the wrong restaurant.
- An annoying assistant pesters you with five basic questions: *"Can I check your contact book? Which Priya? What time? What cuisine? Can I look at your calendar?"*
- A great assistant checks their records silently. They see that *"checking the calendar"* has zero risk, so they do it without asking. But when they notice you have two contacts named Priya and sending a real email cannot be unsent, they ask exactly **one** crisp question: *"Did you mean Priya Sharma (Manager) or Priya Kulkarni (Classmate)?"*

Sawal brings that exact human intuition to AI agents mathematically: **act immediately on harmless details, and only interrupt when an action cannot be undone.**

---

## 3. The Problem and Evidence

Current AI agents face a dual failure mode when processing natural human requests:
1. **Silent Misframing and Irreversible Actions:** Standard tool-calling agents tend to choose a single plausible interpretation and execute it immediately without assessing risk. When ambiguity exists (e.g., "Email Priya about tomorrow's sync" when the contact list contains both Priya Sharma, a manager, and Priya Kulkarni, a classmate), agents guess silently. If the guess is wrong, irreversible damage occurs (an unintended email is dispatched, an incorrect database row is deleted, or an unwanted financial expense is logged).
2. **Clarification Fatigue:** Overly cautious agents prompt the user at every decision point ("Should I look at your calendar?", "Which cuisine do you prefer?", "Should I save this draft?"). This destroys agency and user trust, causing users to abandon automated assistants.

Recent academic evaluations document this gap across agent architectures:
- **Clarification Under-Performance:** *ClarifyMT-Bench* (arXiv:2512.21120) demonstrated a systemic "under-clarification bias" in modern LLMs, which prematurely answer or execute rather than resolve underspecified constraints.
- **Silent Search Failures:** *DiscoBench* (arXiv:2606.27669) observed that agents attempting deep actions with underspecified goals frequently drift into invalid reasoning paths, where asking a targeted question upfront produces significantly higher task recovery than repeated autonomous guessing.
- **Abstention Deficits:** *AgentAbstain* (arXiv:2607.10059) tested 17 frontier model agents across 263 tool-use scenarios and revealed a paired abstention accuracy of only 59.5%, proving that tool proficiency does not correlate with knowing when *not* to act.
- **Task-Framing Ambiguity:** *Ambig-DS* (arXiv:2605.09698) identified "silent misframing," where an agent executes a plausible but wrong specification, achieving apparent tool success while violating user intent.

Sawal replaces heuristic prompt instructions ("Ask clarifying questions if unsure") with **effect-based expected regret minimization**.

---

## 4. How It Works

```mermaid
flowchart TD
    User([User Request]) --> API[FastAPI /v1/sessions]
    API --> GemmaInterp[Gemma 4: Propose K=5 Interpretations]
    
    subgraph "Deterministic Core (Teammate A)"
        GemmaInterp --> Validate{Schema Allowlist Validation}
        Validate -- "< 2 Valid" --> LowDiv[Flag Low Diversity & Act on Best Plan]
        Validate -- ">= 2 Valid" --> Sandbox[Clone World State to Sandboxes]
        
        Sandbox --> DryRun[Dry-Run Plans against Cloned State]
        DryRun --> Canon[Extract Canonical Effects]
        Canon --> Grouping[Hash Effect Signatures & Group Plans]
        Grouping --> RegretCalc[Calculate Expected Regret R vs TAU]
        
        RegretCalc --> Branch{R > TAU?}
        
        Branch -- "No (R <= 0.25)" --> ExecLive[Execute Best Group on Live World]
        ExecLive --> DoneAct[Return Status: completed + World Diff]
        
        Branch -- "Yes (R > 0.25)" --> SlotEval[Evaluate Information Gain per Slot]
        SlotEval --> PickSlot[Select Slot with Lowest Posterior Regret]
    end

    subgraph "Disambiguation Phrasing"
        PickSlot --> GemmaPhrase[Gemma 4: Phrase Question & Options]
        GemmaPhrase --> AskUser[Return Status: asked + QuestionCard]
    end

    AskUser --> UserAnswer([User Submits Option / Text])
    UserAnswer --> AnswerAPI[POST /v1/sessions/:id/answer]
    AnswerAPI --> MapSlot[Deterministic Slot Mapping]
    MapSlot --> CheckCap{Questions >= MAX_QUESTIONS?}
    CheckCap -- "Yes (Cap=2 reached)" --> ExecLive
    CheckCap -- "No" --> FilterInterp[Filter Surviving Interpretations & Re-evaluate]
    FilterInterp --> Sandbox
```

---

## 5. Core Algorithm Specification

### 5.1 Interpretation Proposal ($K=5$)
Given user request text $x$ and world context summary $W_{summary}$, Gemma 4 generates a JSON array of $K = 5$ interpretations:
$$\mathcal{I} = \{I_1, I_2, \dots, I_K\}$$
Each interpretation $I_i$ is a tuple:
$$I_i = \langle \text{id}, \text{rationale}, \text{slots}, \text{plan} \rangle$$
- `slots`: A key-value dictionary of resolved ambiguous parameters (e.g., `{"contact_id": "priya-sharma", "urgency": "high"}`).
- `plan`: An ordered sequence of structured tool calls $[t_1, t_2, \dots, t_n]$ where each tool call specifies `tool` (must belong to the allowlist of 8 registered tools) and typed `args`.

**Validation Gate:** Every proposed tool call is checked against its Pydantic JSON schema. If an interpretation contains unknown tools, missing parameters, or invalid types, it is discarded. If $|\mathcal{I}_{valid}| < 2$, Sawal bypasses disambiguation, sets a `low_diversity` warning flag in the execution trace, and executes the highest-ranked valid interpretation directly.

### 5.2 Sandboxed Dry-Run and Canonical Effects
For each valid interpretation $I_i \in \mathcal{I}_{valid}$, Sawal clones the current user world state $W$ into an isolated memory sandbox $W^{(i)} \leftarrow \text{deepcopy}(W)$. The plan is executed sequentially inside $W^{(i)}$.

During execution, mutations generate a set of **canonical effects** $E(I_i) = \{e_1, e_2, \dots, e_m\}$. A canonical effect $e$ is defined as:
$$e = \langle \text{entity\_type}, \text{operation}, \text{key\_fields}, w(e) \rangle$$
Where:
- `entity_type` $\in \{\text{contact}, \text{calendar\_event}, \text{restaurant}, \text{reservation}, \text{email}, \text{expense}\}$
- `operation` $\in \{\text{create}, \text{update}, \text{delete}, \text{send}\}$
- `key_fields`: Normalized identity attributes (e.g., email recipient address, calendar event timestamp and title, reservation restaurant ID and party size). Transient fields like timestamps and auto-generated UUIDs are excluded.
- $w(e)$: Reversibility weight assigned to the operation.

### 5.3 Reversibility Weights
Mutations carry non-negative cost weights reflecting the real-world friction of undoing them:

| Tool Mutation | Default Weight $w(e)$ | Reversibility Rationale |
| :--- | :---: | :--- |
| `email.send` | `1.0` | **Irreversible.** Sent to external mailbox; cannot be retracted. |
| `restaurants.book` | `0.7` | **External commitment.** Reserves third-party capacity; cancellation penalty. |
| `calendar.create_event` | `0.4` | **Moderate internal friction.** Modifies personal/team calendar; easily deleted. |
| `expenses.log` | `0.3` | **Low financial friction.** Creates accounting ledger entry; can be voided. |
| `email.draft` | `0.1` | **Minimal friction.** Sits privately in drafts folder; safe to discard. |
| Read tools (`*.search`, `*.list`) | `0.0` | **Zero friction.** Read-only inspection produces no state mutations. |

Weights are configurable via environment variables (`WEIGHT_EMAIL_SEND`, etc.).

### 5.4 Effect Signatures and Grouping
To group plans by outcome, an effect signature $\sigma(I_i)$ is computed:
$$\sigma(I_i) = \text{SHA-256}\Big(\text{JSON-serialize}\big(\text{sort}\big(E(I_i)\big)\big)\Big)$$
Interpretations sharing identical signatures are partitioned into outcome groups:
$$\mathcal{G} = \{g_1, g_2, \dots, g_M\}, \quad \bigcup_{j=1}^M g_j = \mathcal{I}_{valid}, \quad g_j \cap g_k = \emptyset \; (j \neq k)$$
The mass $m_j$ of group $g_j$ under a uniform prior is:
$$m_j = \frac{|g_j|}{|\mathcal{I}_{valid}|}, \quad \sum_{j=1}^M m_j = 1.0$$

### 5.5 Distance and Expected Regret
The pairwise cost between two outcome groups $g_j$ and $g_k$ is the sum of reversibility weights in their **symmetric difference** of canonical effects:
$$\text{cost}(g_j, g_k) = \sum_{e \in (E(g_j) \mathbin{\Delta} E(g_k))} w(e)$$
Where $A \mathbin{\Delta} B = (A \setminus B) \cup (B \setminus A)$.

The default candidate action is the largest-mass group:
$$g^* = \arg\max_{g_j \in \mathcal{G}} m_j$$
If there is a tie for largest mass, the group whose candidate plan appears earliest in Gemma's output list is selected.

The **Expected Regret** $R$ of acting immediately on $g^*$ is:
$$R = \sum_{j: g_j \neq g^*} m_j \cdot \text{cost}(g^*, g_j)$$

### 5.6 The Ask-or-Act Decision Rule
Using the threshold parameter $\tau$ (default `DECISION_TAU = 0.25`):
- **If $R \le \tau$:** The assistant **acts immediately**. It executes group $g^*$ on the live world state and returns `status: completed` along with the state diff.
- **If $R > \tau$:** The assistant **asks for clarification**. It selects a disambiguating question and returns `status: asked`.

### 5.7 Question Selection via Expected Posterior Regret
When $R > \tau$, Sawal identifies the single question that maximizes information gain across candidate groups.
1. For each slot name $s \in \text{keys}(\text{slots})$ present across interpretations:
   - Identify the set of unique values $V_s = \{v_1, v_2, \dots\}$.
   - For each value $v \in V_s$, define the subset of interpretations $\mathcal{I}_{s=v} = \{I \in \mathcal{I}_{valid} \mid I.\text{slots}[s] == v\}$.
   - Compute the conditional mass $P(s=v) = \frac{|\mathcal{I}_{s=v}|}{|\mathcal{I}_{valid}|}$.
   - Compute the conditional regret $R_{s=v}$ calculated strictly over the filtered subset $\mathcal{I}_{s=v}$.
   - The expected posterior regret after resolving slot $s$ is:
     $$\mathbb{E}[R \mid s] = \sum_{v \in V_s} P(s=v) \cdot R_{s=v}$$
2. Select the optimal slot $s^*$ that yields the lowest expected posterior regret:
   $$s^* = \arg\min_s \mathbb{E}[R \mid s]$$
3. **Safety condition:** If $\min_s \mathbb{E}[R \mid s] \ge R$, no slot successfully discriminates the outcomes. Sawal bypasses asking, logs an `undiscriminating_slots` trace, and acts on $g^*$.
4. **Question Generation:** Gemma 4 is invoked with a strict JSON schema to generate a natural question and structured options:
   ```json
   {
     "question": "Which Priya would you like to email about the quarterly planning sync?",
     "options": [
       {"id": "opt-priya-sharma", "label": "Priya Sharma (Manager at FinCorp)", "value": "priya-sharma"},
       {"id": "opt-priya-kulkarni", "label": "Priya Kulkarni (Classmate at Pune University)", "value": "priya-kulkarni"}
     ]
   }
   ```
5. **Answering & Question Cap:**
   - When the user selects an option via `option_id`, the interpretation pool is filtered to matching interpretations, and the decision loop re-runs.
   - If free-form text is submitted, Gemma maps the text to an option ID, or appends the clarification to the original request and re-runs interpretation.
   - A hard cap `MAX_QUESTIONS = 2` prevents endless loops. Once two questions have been asked, Sawal forces execution on the highest-probability remaining group.

---

## 6. Architecture and Repository Tree with Owners

The monorepo enforces strict file ownership between Teammate A and Teammate B. Frozen contracts remain untouched after initial generation.

```
d:/Sawal/
├── .env.example                     # [FROZEN] Complete environment template
├── .gitignore                       # [FROZEN] Git ignore rules
├── LICENSE                          # [FROZEN] Apache-2.0 License text
├── README.md                        # [FROZEN] Single source of truth foundation
├── docker-compose.yml               # [FROZEN] Local multi-service orchestration
├── contracts/                       # [FROZEN] Machine-readable API contracts
│   └── openapi.yaml                 # OpenAPI 3.1.0 specification
├── core/                            # [TEAMMATE A] Pure Python decision engine
│   ├── __init__.py
│   ├── world.py                     # Mock world state, cloning, and entity models
│   ├── tools.py                     # Tool implementations and Pydantic schemas
│   ├── interpreter.py               # Prompt templates and plan validation
│   ├── engine.py                    # Dry-run executor and canonical effect extractor
│   ├── clustering.py                # Effect hashing, group partitioning, cost metrics
│   ├── policy.py                    # Regret calculation, ask-vs-act policy, slot picker
│   └── simulator.py                 # Simulated user for automated benchmarking
├── api/                             # [TEAMMATE A] FastAPI web service
│   ├── __init__.py
│   ├── main.py                      # FastAPI app, middleware, lifecycle, error handlers
│   ├── auth.py                      # Clerk JWT verification via PyJWKClient & guest mode
│   ├── config.py                    # Pydantic Settings loading from environment
│   ├── routes/                      # Route controllers (/health, /sessions, /world, etc.)
│   │   ├── health.py
│   │   ├── me.py
│   │   ├── sessions.py
│   │   ├── world.py
│   │   └── benchmark.py
│   ├── repositories/                # Storage abstraction (Supabase vs In-Memory)
│   │   ├── base.py
│   │   ├── memory.py
│   │   └── supabase.py
│   └── llm/                         # Google Gen AI client & caching
│       ├── client.py                # Gemma 4 client with retries, timeout, concurrency
│       └── replay.py                # Replay cache recorder and loader
├── supabase/                        # [TEAMMATE A] Database migrations and seeds
│   ├── migrations/
│   │   └── 20261013000000_initial_schema.sql
│   └── seed.sql                     # Initial seed dataset
├── benchmark/                       # [TEAMMATE A] Evaluation harness and datasets
│   ├── tasks.json                   # 24 evaluation tasks (8 clear, 8 decisive, 8 harmless)
│   ├── runner.py                    # Benchmark execution script and metric calculators
│   ├── baselines.py                 # Always-act, always-ask, and llm-judged baselines
│   └── results/                     # Cached run artifacts and replay recordings
│       ├── latest_summary.json
│       └── replay_cache/
├── scripts/                         # [TEAMMATE A] Verification and smoke test helpers
│   ├── smoke_test.py                # Dual-OS end-to-end smoke verification script
│   └── dev_seed.py                  # Database populator
├── web/                             # [TEAMMATE B] Next.js 15 App Router frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── app/                     # App router pages
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx             # Landing hero and value proposition
│   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   ├── sign-up/[[...sign-up]]/page.tsx
│   │   │   ├── app/                 # Main assistant interface
│   │   │   │   ├── page.tsx
│   │   │   │   ├── world/page.tsx   # Interactive world state inspector
│   │   │   │   └── history/page.tsx # Session history and inspection
│   │   │   ├── benchmark/page.tsx   # Benchmark curves & ablation tables
│   │   │   └── about/page.tsx       # Architecture, research citations & ethics
│   │   ├── components/              # Reusable UI components
│   │   │   ├── PlanForks.tsx        # Visualizer for K=5 proposed plans & effect clusters
│   │   │   ├── QuestionCard.tsx     # Single clarifying question with option chips
│   │   │   ├── WorldDiff.tsx        # Green/red visual diff of affected entities
│   │   │   ├── ReversibilityBadge.tsx # Weight badge & friction indicators
│   │   │   ├── BenchmarkChart.tsx   # Recharts Questions-vs-Errors curve
│   │   │   └── Navbar.tsx
│   │   └── lib/                     # API client and Clerk hooks
│   │       ├── api.ts
│   │       └── types.ts
├── design/                          # [TEAMMATE B] Design tokens, handoff notes, mockups
│   ├── tokens.json
│   └── HANDOFF.md
└── deploy/                          # Container deployment specifications
    ├── api/                         # [TEAMMATE A] Backend Dockerfile
    │   └── Dockerfile
    └── web/                         # [TEAMMATE B] Frontend Dockerfile
        └── Dockerfile
```

---

## 7. Mock World and Tool Schemas

### 7.1 Entities and Initial Seed Dataset
The mock world provides a deterministic sandbox representing personal digital life in Pune, India:

```json
{
  "contacts": [
    {
      "id": "priya-sharma",
      "name": "Priya Sharma",
      "email": "priya.sharma@fincorp.internal",
      "phone": "+91-98765-43210",
      "relationship": "Manager",
      "company": "FinCorp Global Pune"
    },
    {
      "id": "priya-kulkarni",
      "name": "Priya Kulkarni",
      "email": "priya.kulkarni@academics.internal",
      "phone": "+91-98765-12345",
      "relationship": "Classmate / Study Partner",
      "company": "Pune University CS Dept"
    },
    {
      "id": "rohan-verma",
      "name": "Rohan Verma",
      "email": "rohan.v@techops.internal",
      "phone": "+91-98765-67890",
      "relationship": "Colleague",
      "company": "FinCorp Global Pune"
    },
    {
      "id": "ananya-iyer",
      "name": "Ananya Iyer",
      "email": "ananya.iyer@cloudclub.org",
      "phone": "+91-98765-99887",
      "relationship": "Hackathon Mentor",
      "company": "Cloud Computing Club Pune"
    }
  ],
  "calendar_events": [
    {
      "id": "evt-01",
      "title": "Quarterly Planning Sync",
      "start_time": "2026-10-15T10:00:00+05:30",
      "end_time": "2026-10-15T11:00:00+05:30",
      "attendees": ["priya.sharma@fincorp.internal", "rohan.v@techops.internal"]
    },
    {
      "id": "evt-02",
      "title": "Hackathon Check-in",
      "start_time": "2026-10-13T14:00:00+05:30",
      "end_time": "2026-10-13T14:30:00+05:30",
      "attendees": ["ananya.iyer@cloudclub.org"]
    }
  ],
  "restaurants": [
    {
      "id": "rest-spice-route",
      "name": "Spice Route Pune",
      "cuisine": "North Indian",
      "dietary_tags": ["vegetarian", "jain_options"],
      "price_band": "₹₹",
      "capacity": 45
    },
    {
      "id": "rest-deccan-bistro",
      "name": "Deccan Bistro",
      "cuisine": "Continental & Italian",
      "dietary_tags": ["vegetarian", "vegan", "gluten_free"],
      "price_band": "₹₹₹",
      "capacity": 30
    },
    {
      "id": "rest-viman-greens",
      "name": "Viman Greens",
      "cuisine": "Organic South Indian",
      "dietary_tags": ["pure_vegetarian", "vegan"],
      "price_band": "₹",
      "capacity": 60
    },
    {
      "id": "rest-bawarchi-table",
      "name": "Bawarchi Table",
      "cuisine": "Mughlai & Biryani",
      "dietary_tags": ["halal"],
      "price_band": "₹₹",
      "capacity": 50
    }
  ],
  "reservations": [],
  "emails": [],
  "expenses": []
}
```

### 7.2 Tool Definitions and Schemas
Sawal registers exactly 8 tools. Every proposed tool call is validated against these schemas:

#### 1. `contacts.search`
```json
{
  "name": "contacts.search",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {"type": "string", "description": "Search keyword (e.g., 'Priya', 'Manager')"}
    },
    "required": ["query"]
  }
}
```

#### 2. `calendar.list`
```json
{
  "name": "calendar.list",
  "parameters": {
    "type": "object",
    "properties": {
      "start_date": {"type": "string", "format": "date-time"},
      "end_date": {"type": "string", "format": "date-time"}
    },
    "required": ["start_date", "end_date"]
  }
}
```

#### 3. `calendar.create_event`
```json
{
  "name": "calendar.create_event",
  "parameters": {
    "type": "object",
    "properties": {
      "title": {"type": "string"},
      "start_time": {"type": "string", "format": "date-time"},
      "end_time": {"type": "string", "format": "date-time"},
      "attendees": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["title", "start_time", "end_time", "attendees"]
  }
}
```

#### 4. `restaurants.search`
```json
{
  "name": "restaurants.search",
  "parameters": {
    "type": "object",
    "properties": {
      "cuisine": {"type": "string"},
      "dietary": {"type": "string"},
      "price_band": {"type": "string", "enum": ["₹", "₹₹", "₹₹₹"]},
      "party_size": {"type": "integer"}
    }
  }
}
```

#### 5. `restaurants.book`
```json
{
  "name": "restaurants.book",
  "parameters": {
    "type": "object",
    "properties": {
      "restaurant_id": {"type": "string"},
      "date_time": {"type": "string", "format": "date-time"},
      "party_size": {"type": "integer", "minimum": 1},
      "guest_name": {"type": "string"}
    },
    "required": ["restaurant_id", "date_time", "party_size", "guest_name"]
  }
}
```

#### 6. `email.draft`
```json
{
  "name": "email.draft",
  "parameters": {
    "type": "object",
    "properties": {
      "to": {"type": "string", "format": "email"},
      "subject": {"type": "string"},
      "body": {"type": "string"}
    },
    "required": ["to", "subject", "body"]
  }
}
```

#### 7. `email.send`
```json
{
  "name": "email.send",
  "parameters": {
    "type": "object",
    "properties": {
      "to": {"type": "string", "format": "email"},
      "subject": {"type": "string"},
      "body": {"type": "string"}
    },
    "required": ["to", "subject", "body"]
  }
}
```

#### 8. `expenses.log`
```json
{
  "name": "expenses.log",
  "parameters": {
    "type": "object",
    "properties": {
      "category": {"type": "string"},
      "amount": {"type": "number", "minimum": 0.0},
      "description": {"type": "string"},
      "currency": {"type": "string", "default": "INR"}
    },
    "required": ["category", "amount", "description"]
  }
}
```

---

## 8. API Reference

All backend endpoints are prefixed with `/v1`. Machine-readable specifications are in `contracts/openapi.yaml`.

| Method | Path | Summary | Auth Required | Operation ID |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/v1/health` | Health & service status check | No | `getHealth` |
| `GET` | `/v1/config` | Public runtime & policy configuration | No | `getConfig` |
| `GET` | `/v1/me` | Current user profile & preference memory | Yes | `getMe` |
| `PUT` | `/v1/me/preferences` | Update user preference weights | Yes | `updatePreferences` |
| `POST` | `/v1/sessions` | Create assistant session from prompt | Yes | `createSession` |
| `GET` | `/v1/sessions` | List past sessions with cursor pagination | Yes | `listSessions` |
| `GET` | `/v1/sessions/{id}` | Retrieve session state, regret & trace | Yes | `getSessionById` |
| `POST` | `/v1/sessions/{id}/answer` | Answer clarification question | Yes | `answerQuestion` |
| `GET` | `/v1/world` | Inspect active mock sandbox world | Yes | `getWorldState` |
| `POST` | `/v1/world/reset` | Reset mock world to initial seed | Yes | `resetWorldState` |
| `GET` | `/v1/benchmark/summary`| Retrieve cached headline benchmark curve | No | `getBenchmarkSummary` |
| `POST` | `/v1/benchmark/runs` | Trigger benchmark suite (Dev gated) | Yes | `createBenchmarkRun` |
| `GET` | `/v1/benchmark/runs/{id}` | Inspect progress of benchmark run | Yes | `getBenchmarkRunById` |

### 8.1 Standard Error Envelope
All error responses adhere to a consistent JSON structure:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or expired Clerk authentication token",
    "details": {"required_header": "Authorization: Bearer <token>"}
  }
}
```

### 8.2 Session Lifecycle Example

<details>
<summary><strong>Click to view Request & Response Payload: POST /v1/sessions (Ambiguous Request)</strong></summary>

**Request:**
```http
POST /v1/sessions HTTP/1.1
Host: localhost:8000
Authorization: Bearer <CLERK_JWT>
Content-Type: application/json

{
  "request_text": "Email Priya that the quarterly planning sync is moved to Thursday 3 PM"
}
```

**Response (Status: `asked` because Expected Regret $R = 0.50 > 0.25$):**
```json
{
  "id": "7b0fa5c4-2794-4d8e-908d-ef6e6cbb91b2",
  "user_id": "user_2tQ...",
  "request_text": "Email Priya that the quarterly planning sync is moved to Thursday 3 PM",
  "status": "asked",
  "decision": {
    "action": "ask",
    "expected_regret": 0.50,
    "tau": 0.25,
    "chosen_group_id": "grp-sharma",
    "groups": [
      {
        "id": "grp-sharma",
        "mass": 0.60,
        "interpretation_ids": ["interp-01", "interp-02", "interp-03"],
        "canonical_effects": [
          {
            "entity_type": "email",
            "operation": "send",
            "key_fields": {
              "to": "priya.sharma@fincorp.internal",
              "subject": "Quarterly planning sync moved to Thursday 3 PM"
            },
            "reversibility_weight": 1.0
          }
        ],
        "signature": "sha256-a1b2c3d4e5..."
      },
      {
        "id": "grp-kulkarni",
        "mass": 0.40,
        "interpretation_ids": ["interp-04", "interp-05"],
        "canonical_effects": [
          {
            "entity_type": "email",
            "operation": "send",
            "key_fields": {
              "to": "priya.kulkarni@academics.internal",
              "subject": "Quarterly planning sync moved to Thursday 3 PM"
            },
            "reversibility_weight": 1.0
          }
        ],
        "signature": "sha256-f6e7d8c9b0..."
      }
    ]
  },
  "interpretations": [
    {
      "id": "interp-01",
      "rationale": "Assumes Priya Sharma (Manager) is recipient based on corporate sync context.",
      "slots": {"contact_id": "priya-sharma"},
      "plan": [
        {
          "tool": "email.send",
          "args": {
            "to": "priya.sharma@fincorp.internal",
            "subject": "Quarterly planning sync moved to Thursday 3 PM",
            "body": "Hi Priya, the quarterly planning sync is rescheduled to Thursday at 3 PM."
          }
        }
      ],
      "signature": "sha256-a1b2c3d4e5...",
      "group_id": "grp-sharma"
    }
  ],
  "question": {
    "id": "q-contact-01",
    "slot_name": "contact_id",
    "question": "Which Priya would you like to email about the quarterly planning sync?",
    "options": [
      {
        "id": "opt-priya-sharma",
        "label": "Priya Sharma (Manager at FinCorp)",
        "value": "priya-sharma",
        "target_group_ids": ["grp-sharma"]
      },
      {
        "id": "opt-priya-kulkarni",
        "label": "Priya Kulkarni (Classmate at Pune University)",
        "value": "priya-kulkarni",
        "target_group_ids": ["grp-kulkarni"]
      }
    ]
  },
  "result": null,
  "trace": [
    {"id": "trc-01", "kind": "INTERPRETATIONS_GENERATED", "payload": {"count": 5}, "timestamp": "2026-10-13T10:00:01Z"},
    {"id": "trc-02", "kind": "DRY_RUN_COMPLETED", "payload": {"valid_count": 5}, "timestamp": "2026-10-13T10:00:02Z"},
    {"id": "trc-03", "kind": "REGRET_CALCULATED", "payload": {"R": 0.50, "tau": 0.25}, "timestamp": "2026-10-13T10:00:02Z"}
  ],
  "created_at": "2026-10-13T10:00:00Z",
  "updated_at": "2026-10-13T10:00:02Z"
}
```
</details>

---

## 9. Data Model

The persistence layer runs on Supabase (PostgreSQL). All tables enforce Row-Level Security (RLS) with default deny policies.

### 9.1 PostgreSQL Migration Schema
File path: `supabase/migrations/20261013000000_initial_schema.sql`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE profiles (
    user_id TEXT PRIMARY KEY, -- Clerk string ID (e.g., 'user_2tQ...')
    display_name TEXT NOT NULL,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. Sessions Table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    request_text TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('asked', 'completed', 'failed')),
    decision JSONB NOT NULL,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX idx_sessions_user_created ON sessions(user_id, created_at DESC);

-- 3. Session Events (Trace stream)
CREATE TABLE session_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX idx_session_events_session ON session_events(session_id, created_at ASC);

-- 4. World States Table (Per-user sandbox persistence)
CREATE TABLE world_states (
    user_id TEXT PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 5. Benchmark Runs Table (Dev results)
CREATE TABLE benchmark_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    summary JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ROW LEVEL SECURITY: Deny by default for anon and authenticated clients.
-- Backend accesses tables via Supabase Service Role Key.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_runs ENABLE ROW LEVEL SECURITY;
```

---

## 10. Frontend and Design Handoff

The frontend is built using Next.js 15 (App Router), TypeScript, Tailwind CSS, and Recharts.

### 10.1 Route Structure
- `/` — Landing page with live demo playground explanation and track badge.
- `/sign-in` & `/sign-up` — Clerk authentication flows.
- `/app` — Primary assistant interface: prompt input, execution status, and decision stream.
- `/app/world` — Visual sandbox inspector showing current contacts, calendar, emails, reservations, and reset button.
- `/app/history` — Paginated history of prior sessions with regret meters.
- `/app/history/[id]` — Detailed inspection of past session traces, forks, and world diffs.
- `/benchmark` — Interactive Questions vs. Errors curve (Recharts) with baseline comparison and ablation tables.
- `/about` — Technical architecture breakdown, verified arXiv citations, and ethical disclosures.

### 10.2 Key Component Specifications
- **`PlanForks`:** Visual tree diagram rendering the $K=5$ proposed plans grouped into outcome clusters, showing the mass percentage of each branch and tool call sequence.
- **`QuestionCard`:** High-contrast clarification card presented when `status == 'asked'`. Features clickable pre-rendered option chips (derived directly from slot values) and an optional free-form input.
- **`WorldDiff`:** Color-coded structural diff viewer. Green highlights indicate added entities (drafts, calendar items); red highlights mark modified or deleted entities.
- **`ReversibilityBadge`:** Dynamic pill component displaying the reversibility cost ($w(e)$). Renders in emerald for $w \le 0.1$, amber for $0.1 < w < 0.7$, and ruby/crimson with a warning shield for $w \ge 0.7$ (e.g., `email.send`).

### 10.3 Design Tokens

| Token Category | Token Name | Value | Usage |
| :--- | :--- | :--- | :--- |
| **Color (Primary)** | `saffron-600` | `#E06100` | Primary actions, CTA buttons, active accents |
| **Color (Surface)** | `slate-950` | `#0B0F19` | Main application background (Dark mode default) |
| **Color (Card)** | `slate-900` | `#111827` | Component card surfaces, modals |
| **Color (Border)** | `slate-800` | `#1F2937` | Subtle dividers, card borders |
| **Color (Safe)** | `emerald-500` | `#10B981` | Completed actions, reversible mutations, low regret |
| **Color (Warn)** | `amber-500` | `#F59E0B` | Clarification questions, moderate cost |
| **Color (Danger)** | `rose-500` | `#F43F5E` | Irreversible actions (`email.send`), high regret |
| **Typography** | `font-sans` | `Inter, -apple-system, sans-serif` | Clean UI body copy and headings |
| **Typography** | `font-mono` | `JetBrains Mono, monospace` | Tool call payloads, signatures, diffs |
| **Spacing** | `space-unit` | `4px` | Standard 4px grid (`p-2`, `p-4`, `p-6`) |
| **Radii** | `radius-md` | `8px` (`0.5rem`) | Cards, option chips, input fields |
| **Radii** | `radius-full`| `9999px` | Badges, avatar placeholders |

### 10.4 Teammate B Mock Workflow
Teammate B develops against a mock server before Teammate A's backend is ready.
```bash
# In the web/ directory:
npx -y @stoplight/prism-cli mock ../contracts/openapi.yaml -p 8000
npm run dev
```

---

## 11. Authentication and Security

### 11.1 Clerk JWT Verification
Every API request to protected routes requires an `Authorization: Bearer <token>` header.
1. The FastAPI backend extracts the token and uses `pyjwt.PyJWKClient` pointing to `CLERK_JWKS_URL` (`https://<clerk-domain>/.well-known/jwks.json`).
2. The verification enforces:
   - Signature algorithm: `RS256`
   - Issuer (`iss`): Matches `CLERK_ISSUER_URL`
   - Expiration (`exp`): Validates current time against token lifetime
   - Authorized Parties (`azp`): Validates origin against `CLERK_AUTHORIZED_PARTIES`
3. The authenticated Clerk user ID (`sub`) scopes every database query.

### 11.2 Guest Demo Mode
When `ALLOW_GUEST_DEMO=true`:
- Unauthenticated visitors can use the app without signing up.
- The backend generates an ephemeral session key (`X-Guest-Session-ID`) tied to an in-memory repository (`STORAGE_BACKEND=memory`).
- Guest data never writes to Supabase and is purged after 1 hour.
- Rate-limited to 10 requests per minute per IP address.

### 11.3 Prompt Injection Defense & Data Privacy
- **Zero Arbitrary Execution:** Gemma 4's outputs are strictly validated against Pydantic tool schemas. Even if an injection attack succeeds in convincing Gemma to run arbitrary code, the output parser drops any non-allowlisted tool call.
- **Privacy Disclosure:** User prompts and context summaries are transmitted to Google's hosted Gemini API. No customer data is retained for model training under Google AI Studio's API Terms of Service.
- **Pre-Publication Security Checklist:**
  - [ ] No API keys or credentials committed to git history.
  - [ ] `.env` is listed in `.gitignore`.
  - [ ] All database queries filter explicitly by Clerk `user_id`.
  - [ ] Supabase RLS is enabled on all tables with zero public access.
  - [ ] Input strings capped at 1,000 characters.

---

## 12. AI and LLM Layer

### 12.1 Unified Architecture & Provider Interface
Sawal enforces an **open-source-first, strictly open-weight policy**: every inference task—generating the $K=5$ plan interpretations, phrasing clarification questions, mapping free-form answers back to slot options, and running the `llm_judged` baseline—must execute against an **open-weight foundation model**. Closed-source proprietary models (e.g., proprietary commercial models) are prohibited and rejected at engine initialization.

The system abstracts model interaction behind a unified interface (`core/interpreter.py` and `api/llm/client.py`) supporting two swappable providers selected via `LLM_PROVIDER`:
1. **Gemini API (`LLM_PROVIDER=gemini`, Default):** Interacts with hosted Gemma 4 models using the official `google-genai` Python SDK. Requires `GEMINI_API_KEY`.
2. **OpenAI-Compatible (`LLM_PROVIDER=openai_compatible`):** Interacts with any server exposing standard `/v1/chat/completions` endpoints. Enables local offline execution via **Ollama** or **vLLM** (`OPENAI_BASE_URL=http://localhost:11434/v1`) or hosted open-weight platforms (Together AI, Groq, DeepInfra).

```python
# Provider abstraction interface sketch
class OpenWeightLLMClient:
    async def generate_structured(
        self, prompt: str, schema: type[BaseModel], temperature: float = 0.2
    ) -> BaseModel:
        """Enforces open-weight family check, client-side RPM rate limiting, and backoff retries."""
        ...
```

### 12.2 Supported Open-Weight Models & Licenses
At service startup, Sawal validates `GEMMA_MODEL_ID` against `ALLOWED_MODEL_FAMILIES=gemma,llama,mistral,qwen`. If a non-compliant or closed model ID is detected, the engine raises an immediate configuration error and halts.

| Model Family | Representative Identifiers | License | Attribution & Terms |
| :--- | :--- | :--- | :--- |
| **Gemma** *(Default)* | `gemma-4-26b-a4b-it`, `gemma-4-31b-it` | **Gemma Terms of Use** (Permissive open weights) | Free commercial & research use; attribution to Google. |
| **Llama** | `llama-3.3-70b-instruct`, `llama-3.1-8b-instruct` | **Llama 3 Community License** | Permissive open weights; commercial use up to 700M MAU; "Built with Llama". |
| **Mistral** | `mistral-nemo-12b-instruct`, `mistral-7b-instruct` | **Apache-2.0** | Fully open source; permissive commercial & academic use. |
| **Qwen** | `qwen-2.5-32b-instruct`, `qwen-2.5-7b-instruct` | **Apache-2.0** | Fully open source; permissive commercial & academic use. |

*TODO-VERIFY: Verify exact model ID for Gemma 4 on the Google Gemini API (e.g. gemma-4-26b-a4b-it or gemma-4-31b-it) and verify whether native tool calling / json_schema response mode is supported on Gemma 4 endpoints or requires structured prompt parsing.*

### 12.3 Client-Side Rate Limiter & Concurrency (`LLM_MAX_RPM`)
To prevent `429 RESOURCE_EXHAUSTED` errors on developer free tiers, Sawal implements an in-memory token-bucket rate limiter:
- **`LLM_MAX_RPM` (Default: `15`):** Restricts upstream requests to 15 per minute.  
  *TODO-VERIFY: Verify free-tier requests-per-minute (RPM) limits in Google AI Studio dashboard or Gemini API documentation.*
- **Queueing:** Outgoing inference requests enter an `asyncio.PriorityQueue`, smoothing request bursts.
- **Concurrency Cap (`LLM_MAX_CONCURRENCY=4`):** Maximum simultaneous in-flight HTTP connections.
- **Exponential Backoff:** If an upstream `429` or `503` occurs, the client retries up to `LLM_MAX_RETRIES=3` times with randomized jitter ($t_{\text{wait}} = 2^k \times (1 \pm 0.2)$ seconds).
- **Timeout (`LLM_TIMEOUT_SECONDS=15`):** Request aborted if upstream model stalls.

### 12.4 Benchmark Call Budget Calculation
Evaluating the 24-task benchmark suite has a strictly bounded API call budget:

1. **Sawal Policy Run (24 Tasks):**
   - **8 Clear Tasks:** 1 proposal call + 0 question calls = 8 calls.
   - **8 Decisively Ambiguous Tasks:** 1 proposal call + 1 question phrasing call = 16 calls. (Simulated user answers via deterministic slot filtering; zero extra LLM calls needed).
   - **8 Harmlessly Ambiguous Tasks:** 1 proposal call + 0 question calls = 8 calls.
   - **Total for Sawal:** **32 calls**. At 15 RPM, total execution time is **~2.13 minutes** (~128 seconds).

2. **Baseline Comparison Call Budgets:**
   - `always_act`: 24 tasks $\times$ 1 call = **24 calls** (~1.6 minutes).
   - `always_ask`: 24 tasks $\times$ (1 proposal + 1 question) = **48 calls** (~3.2 minutes).
   - `llm_judged`: 24 tasks $\times$ 1 decision prompt = **24 calls** (~1.6 minutes).
   - **Complete Evaluation Suite (All 4 Baselines):** $32 + 24 + 48 + 24 = \mathbf{128\text{ calls}}$ (~8.5 minutes at 15 RPM).
   - **Offline Replay Mode (`LLM_MODE=replay`):** $\mathbf{0\text{ calls}}$, 0 API cost, execution completes in under 2 seconds.

*Optional P1:* Run the identical benchmark suite using a second open-weight model (e.g., Llama 3.3 70B via Ollama/vLLM) to demonstrate empirically that Sawal's effect-grounded harness is completely model-agnostic.

### 12.5 LLM Execution Modes (`LLM_MODE`)
1. `live`: Directly invokes the active open-weight provider.
2. `record`: Calls the provider and serializes exact prompt/response pairs to `benchmark/results/replay_cache/`.
3. `replay`: Purely offline. Matches prompt hashes against local recordings. Zero network required.
4. `auto` *(Default)*: Attempts `live` mode. If network fails or times out, seamlessly falls back to `replay`.

**Deterministic Cache Key Construction:**
$$\text{CacheKey} = \text{SHA-256}\big(\text{provider} + \text{model\_id} + \text{prompt\_text} + \text{schema\_json} + \text{temperature} + \text{seed}\big)$$

---

## 13. Benchmark and Evaluation

The evaluation suite tests Sawal across 24 hand-crafted tasks divided into three equal cohorts.

### 13.1 Task Cohorts

#### Cohort 1: Clear Tasks (8 tasks)
*Expectation: High certainty. 0 questions asked. Immediate execution.*
- **Task C-01:** "Search my calendar for any events scheduled tomorrow."
  - *Context:* Read-only inspection. Reversibility weight is 0.0. Immediate act.
- **Task C-02:** "Draft an email to Ananya Iyer thanking her for the hackathon mentorship session."
  - *Context:* Single Ananya in contacts. Email draft reversibility weight is 0.1. Immediate act.

#### Cohort 2: Decisively Ambiguous Tasks (8 tasks)
*Expectation: High risk of wrong outcome. Exactly 1 clarifying question asked.*
- **Task D-01:** "Send an email to Priya confirming that our quarterly planning sync is moved to Thursday 3 PM."
  - *Context:* Ambiguous between Priya Sharma (Manager) and Priya Kulkarni (Classmate). `email.send` weight is 1.0. Expected regret $R = 0.50 > 0.25$. Must ask which Priya.
- **Task D-02:** "Book dinner for 4 people at our favorite spot at 8 PM tonight."
  - *Context:* Two restaurants match history (Deccan Bistro at ₹₹₹ vs. Spice Route at ₹₹). `restaurants.book` weight is 0.7. Non-trivial booking friction. Must ask which restaurant.

#### Cohort 3: Harmlessly Ambiguous Tasks (8 tasks)
*Expectation: Vague phrasing, but divergent interpretations have identical canonical effects or cost $< \tau$. 0 questions asked.*
- **Task H-01:** "Look up where Deccan Bistro is located and check if they have vegetarian food."
  - *Context:* Two plans: one calls `restaurants.search(cuisine='Continental')`, another calls `restaurants.search(dietary='vegetarian')`. Both read-only ($w=0.0$). Expected regret $R = 0.0$. Immediate act.
- **Task H-02:** "Log 350 rupees for lunch under food expenses."
  - *Context:* Minor slot wording difference ("lunch meal" vs "afternoon lunch"), but both map to `expenses.log(category='food', amount=350, currency='INR')`. Effect symmetric difference is empty ($R = 0.0$). Immediate act.

### 13.2 Baselines & Metrics
**Baselines Evaluated:**
1. `always_act`: Executes highest-ranked interpretation without ever asking.
2. `always_ask`: Prompts the user whenever interpretations are not 100% identical.
3. `llm_judged`: Single prompt to Gemma 4 asking "Should I ask or act?" based on text alone.
4. `sawal`: Our effect-based expected regret policy.

**Evaluation Metrics:**
- **Wrong-Action Rate (%):** Executed effects do not match user ground truth.
- **Questions Per Task:** Average clarification questions asked.
- **Unnecessary-Question Rate (%):** Asked questions on Clear or Harmless tasks.
- **Missed-Ask Rate (%):** Acted immediately on Decisively Ambiguous tasks.
- **Irreversible-Error Rate (%):** Executed wrong action on operations with $w(e) \ge 0.7$.

### 13.3 Headline Results Table
*Note: Results must come from live benchmark execution on Gemma 4; never fabricated. Run `python benchmark/runner.py` to populate.*

| Policy | Wrong-Action Rate | Questions / Task | Unnecessary Questions | Missed-Ask Rate | Irreversible Errors |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `always_act` | *Run runner.py* | 0.00 | 0.0% | 100.0% | *Run runner.py* |
| `always_ask` | 0.0% | 1.85 | 100.0% | 0.0% | 0.0% |
| `llm_judged` | *Run runner.py* | *Run runner.py* | *Run runner.py* | *Run runner.py* | *Run runner.py* |
| **Sawal ($\tau=0.25$)** | **To be populated** | **To be populated** | **To be populated** | **To be populated** | **0.0%** |

---

## 14. Setup and Run

### 14.1 Prerequisites
- Python 3.11+
- Node.js 20.x+ & npm / pnpm
- Google AI Studio API Key (Gemini API)
- Free Clerk account (Frontend & Backend keys)
- Free Supabase project (or use local in-memory mode)

### 14.2 Environment Variables Reference
Every variable present in `.env.example` is documented below:

| Environment Variable | Default / Example Value | Service & Role | Description |
| :--- | :--- | :--- | :--- |
| `HOST` | `0.0.0.0` | Backend Server | Bind host for the FastAPI server |
| `PORT` | `8000` | Backend Server | Bind port for the FastAPI server |
| `ENVIRONMENT` | `development` | Backend Server | Application environment (`development`, `production`, `test`) |
| `DEBUG` | `true` | Backend Server | Verbose debugging flag |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Backend Server | Comma-separated CORS allowed origin list |
| `ALLOW_GUEST_DEMO` | `true` | Backend Server | Enables ephemeral unauthenticated guest sessions in memory |
| `STORAGE_BACKEND` | `memory` | Backend Server | Repository engine: `memory` (offline/test) or `supabase` |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `60` | Backend Server | Global request throttling cap per IP/user |
| `SUPABASE_URL` | `https://<REF>.supabase.co` | Supabase Client | Supabase PostgreSQL project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `<KEY>` | Supabase Client | Backend-only key bypassing RLS (server-side only) |
| `CLERK_ISSUER_URL` | `https://<DOMAIN>.clerk.accounts.dev` | Clerk Auth | Issuer domain for Clerk JWT signature verification |
| `CLERK_JWKS_URL` | `https://<DOMAIN>.clerk.accounts.dev/.well-known/jwks.json` | Clerk Auth | Clerk public JWKS endpoint for RS256 keys |
| `CLERK_AUTHORIZED_PARTIES` | `http://localhost:3000,http://127.0.0.1:3000` | Clerk Auth | Authorized parties (`azp` claim) allowed in JWT |
| `LLM_PROVIDER` | `gemini` | LLM Client | Provider engine: `gemini` (Google SDK) or `openai_compatible` |
| `GEMINI_API_KEY` | `<KEY>` | LLM Client | Google AI Studio API key (used if `LLM_PROVIDER=gemini`) |
| `OPENAI_BASE_URL` | `http://localhost:11434/v1` | LLM Client | Base URL for OpenAI-compatible open-weight endpoint |
| `OPENAI_API_KEY` | `<KEY>` | LLM Client | API key for OpenAI-compatible endpoint (optional for Ollama) |
| `ALLOWED_MODEL_FAMILIES` | `gemma,llama,mistral,qwen` | LLM Policy | Open-weight family allowlist; startup blocks closed models |
| `GEMMA_MODEL_ID` | `gemma-4-26b-a4b-it` | LLM Client | Model identifier for hosted Gemma 4 via Gemini API |
| `LLM_MODE` | `auto` | LLM Client | Operational mode: `live`, `record`, `replay`, `auto` |
| `LLM_REPLAY_CACHE_DIR` | `benchmark/results/replay_cache` | LLM Client | Directory containing recorded prompt/response cache |
| `LLM_TIMEOUT_SECONDS` | `15` | LLM Client | Timeout in seconds for upstream Gemini API calls |
| `LLM_MAX_RETRIES` | `3` | LLM Client | Max exponential backoff retry attempts on 429/503 |
| `LLM_MAX_CONCURRENCY` | `4` | LLM Client | Semaphore cap for simultaneous upstream LLM calls |
| `LLM_MAX_RPM` | `15` | LLM Client | Client-side rate limiter requests-per-minute cap |
| `NUM_INTERPRETATIONS` | `5` | Core Policy | Number of distinct plan interpretations generated ($K$) |
| `DECISION_TAU` | `0.25` | Core Policy | Regret threshold ($\tau$): ask if $R > \tau$, else act |
| `MAX_QUESTIONS` | `2` | Core Policy | Maximum number of clarification rounds before acting |
| `WEIGHT_EMAIL_SEND` | `1.0` | Core Policy | Reversibility cost for `email.send` (irreversible) |
| `WEIGHT_RESTAURANTS_BOOK` | `0.7` | Core Policy | Reversibility cost for `restaurants.book` |
| `WEIGHT_CALENDAR_CREATE` | `0.4` | Core Policy | Reversibility cost for `calendar.create_event` |
| `WEIGHT_EXPENSES_LOG` | `0.3` | Core Policy | Reversibility cost for `expenses.log` |
| `WEIGHT_EMAIL_DRAFT` | `0.1` | Core Policy | Reversibility cost for `email.draft` |
| `BENCHMARK_FLAG_GATED` | `true` | Dev Gating | Flag protecting POST `/v1/benchmark/runs` endpoint |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000/v1` | Frontend Web | Backend API base URL consumed by Next.js client |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_<KEY>` | Frontend Web | Clerk public client key for browser authentication |
| `CLERK_SECRET_KEY` | `sk_test_<KEY>` | Frontend Web | Clerk secret key for Next.js middleware verification |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Frontend Web | Route for Clerk sign-in page |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | Frontend Web | Route for Clerk sign-up page |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/app` | Frontend Web | Post-authentication redirect target |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/app` | Frontend Web | Post-registration redirect target |
| `NEXT_PUBLIC_ALLOW_GUEST_DEMO` | `true` | Frontend Web | Shows guest demo launch button on web landing UI |

### 14.3 Open-Source-First Architecture & Dependency License Audit
Sawal is architected so that the **core decision engine operates without any proprietary SaaS dependencies**:
- **Zero-Cloud Minimal Run:** Setting `STORAGE_BACKEND=memory` and `ALLOW_GUEST_DEMO=true` allows the entire harness, UI, and benchmark suite to run with **only an LLM API key** (or zero external keys if using local Ollama via `LLM_PROVIDER=openai_compatible`).
- **Optional Adapters:** Clerk (auth) and Supabase (cloud Postgres) are strictly optional adapters. If unconfigured, the application runs entirely in memory without failing.
- **Offline Mode:** In `LLM_MODE=replay`, the entire system runs disconnected from the internet.

#### Third-Party Dependency Licenses (All OSI-Approved)
All libraries used across backend and frontend are governed by permissive, OSI-approved open-source licenses:

| Ecosystem | Package Name | Verified Version | License | OSI Approved? | Purpose |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Python** | `fastapi` | `0.143.0` | **MIT** | Yes | High-performance asynchronous REST API framework |
| **Python** | `pydantic` | `2.12.0` | **MIT** | Yes | Data validation and schema allowlist enforcement |
| **Python** | `pydantic-settings` | `>=2.5.0` | **MIT** | Yes | Type-safe environment variable parsing |
| **Python** | `google-genai` | `2.29.0` | **Apache-2.0** | Yes | Official Google Gen AI Python SDK for Gemma 4 |
| **Python** | `httpx` | `>=0.27.0` | **BSD-3-Clause**| Yes | Async HTTP client for OpenAI-compatible endpoint |
| **Python** | `uvicorn` | `>=0.30.0` | **BSD-3-Clause**| Yes | ASGI web server implementation |
| **Python** | `pyjwt` | `>=2.9.0` | **MIT** | Yes | JWT verification and JWKS key parsing |
| **Python** | `cryptography` | `>=43.0.0` | **Apache-2.0 / BSD** | Yes | Cryptographic primitives for RS256 decoding |
| **Python** | `supabase` | `>=2.9.0` | **MIT** | Yes | Optional Supabase Python client for persistence |
| **Python** | `pytest` | `>=8.3.0` | **MIT** | Yes | Unit and integration test runner |
| **Python** | `pytest-asyncio` | `>=0.24.0` | **Apache-2.0** | Yes | Asynchronous test execution plugin |
| **Python** | `ruff` | `>=0.6.0` | **MIT / Apache-2.0** | Yes | High-speed Python linter and code formatter |
| **Python** | `pyyaml` | `>=6.0.2` | **MIT** | Yes | Machine-readable YAML parser for OpenAPI validation |
| **Node.js** | `next` | `16.4.0` | **MIT** | Yes | React framework for web frontend (App Router) |
| **Node.js** | `react` / `react-dom` | `19.0.0` | **MIT** | Yes | Core UI rendering library |
| **Node.js** | `tailwindcss` | `v4.3.3` | **MIT** | Yes | Utility-first CSS styling engine |
| **Node.js** | `recharts` | `3.10.1` | **MIT** | Yes | Composable charting library for Questions-vs-Errors |
| **Node.js** | `@clerk/nextjs` | `>=5.0.0` | **MIT** | Yes | Optional user authentication components |
| **Node.js** | `lucide-react` | `>=0.400.0` | **ISC** | Yes | Open-source iconography |

*Audit Finding:* Zero non-OSI or viral copyleft licenses are present in Sawal's dependency tree. Every dependency is safe for open-source redistribution under Apache-2.0.

### 14.4 Setup Commands

#### Windows (PowerShell)
```powershell
# 1. Navigate to repository root
Set-Location d:\Sawal

# 2. Copy environment template
Copy-Item .env.example .env

# 3. Create and activate Python virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 4. Install backend dependencies
pip install --upgrade pip
pip install fastapi pydantic pydantic-settings google-genai pyjwt cryptography httpx uvicorn pytest pytest-asyncio ruff pyyaml

# 5. Install frontend dependencies
Set-Location web
npm install
Set-Location ..
```

#### macOS / Linux (bash/zsh)
```bash
# 1. Navigate to repository root
cd /path/to/Sawal

# 2. Copy environment template
cp .env.example .env

# 3. Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 4. Install backend dependencies
pip install --upgrade pip
pip install fastapi pydantic pydantic-settings google-genai pyjwt cryptography httpx uvicorn pytest pytest-asyncio ruff pyyaml

# 5. Install frontend dependencies
cd web
npm install
cd ..
```

### 14.4 Running Locally (No-Docker)

#### Backend Service (Port 8000)
```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```
```bash
# macOS / Linux
source .venv/bin/activate
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend Web Application (Port 3000)
```powershell
# Windows PowerShell
Set-Location web
npm run dev
```
```bash
# macOS / Linux
cd web
npm run dev
```

### 14.5 Running Locally via Docker Compose
```bash
# Start all services in isolated containers
docker-compose up --build

# Stop services
docker-compose down
```

---

## 15. Testing and Acceptance Scenarios

### 15.1 Acceptance Scenarios (P0 Definition of Done)

- **S1 (Clear Request):** "Search my calendar for events tomorrow."  
  *Result:* Executes tool `calendar.list`. Zero questions asked. Status: `completed`.
- **S2 (Decisive Ambiguity):** "Send an email to Priya confirming 3 PM meeting."  
  *Result:* Halts before `email.send`. Status: `asked`. Presents QuestionCard with Priya Sharma vs. Priya Kulkarni. User answers $\rightarrow$ dispatches email. Status: `completed`.
- **S3 (Harmless Ambiguity):** "Find where Deccan Bistro is located and check dietary info."  
  *Result:* Divergent read tool queries executed in sandbox. $R = 0.0 \le \tau$. Status: `completed`.
- **S4 (Asymmetric Risk):** Request with 4 low-risk interpretations and 1 high-risk `email.send` to ambiguous contact.  
  *Result:* Expected regret $R = 0.20 \times 1.0 = 0.20$ or higher. Halts and asks despite single dissenting plan.
- **S5 (Graceful LLM Failure):** Upstream Gemma API returns 503 or times out.  
  *Result:* Returns HTTP 502/504 with standard error body. Sandbox world remains unmutated; zero data corruption.
- **S6 (Offline Replay Mode):** Disconnect network, set `LLM_MODE=replay`.  
  *Result:* Replays cached tasks from `benchmark/results/replay_cache/` successfully.
- **S7 (Authentication Rejection):** Request sent without Bearer token when `ALLOW_GUEST_DEMO=false`.  
  *Result:* Immediate HTTP 401 Unauthorized.
- **S8 (Cross-User Isolation):** User A creates a session. User B attempts to access `/v1/sessions/{id}`.  
  *Result:* Returns HTTP 404 Not Found. No data leakage between user accounts.

### 15.2 Running Verification Tests
```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pytest -v
ruff check .
```
```bash
# macOS / Linux
source .venv/bin/activate
pytest -v
ruff check .
```

---

## 16. Team Split, Merge Protocol, and 3-Hour Plan

### 16.1 Roles and Ownership
- **Teammate A (Brain & Backend):** `core/`, `api/`, `supabase/`, `benchmark/`, `scripts/`, `deploy/api/`
- **Teammate B (Face & Frontend):** `web/`, `design/`, `deploy/web/`
- **Frozen Shared Files:** `README.md`, `contracts/openapi.yaml`, `.env.example`, `LICENSE`, `docker-compose.yml`.

### 16.2 Merge Protocol (No GitHub, Local Git Only)
Both teammates work in isolated branches on a shared local filesystem or network share:
1. Teammate A works on branch `a/backend`.
2. Teammate B works on branch `b/frontend`.
3. At checkpoints, exchange bundles via local git bundle:
   ```bash
   # Export bundle
   git bundle create teammate_a.bundle a/backend
   
   # Import bundle
   git pull teammate_a.bundle a/backend
   ```
4. Merge Order: Merge `a/backend` into main first, verify tests, then merge `b/frontend`. Run `scripts/smoke_test.py`.

### 16.3 3-Hour Minute-by-Minute Plan

| Time | Teammate A (Backend & Core) | Teammate B (Frontend & Web) | Milestone |
| :--- | :--- | :--- | :---: |
| **T+00 - T+30** | Scaffold `core/world.py` and `core/tools.py`. Implement deep-copy dry run. | Scaffold Next.js app in `web/`. Configure Tailwind tokens and fonts. | P0 Core |
| **T+30 - T+60** | Implement `core/engine.py` canonical effects and `core/policy.py` regret logic. | Build mock API service from `openapi.yaml`. Scaffold `/app` layout. | **Checkpoint 1 (T+60):** Engine dry-runs locally |
| **T+60 - T+90** | Wire FastAPI `/v1/sessions` and in-memory repository. Connect Gemma 4 client. | Build `PlanForks` tree visualizer and `QuestionCard` component. | P0 Integration |
| **T+90 - T+120**| Implement Clerk JWT verification and `/v1/sessions/:id/answer`. | Build `/benchmark` page with Recharts Questions-vs-Errors chart. | **Checkpoint 2 (T+120):** Full loop ask-or-act works |
| **T+120 - T+150**| Run 24-task benchmark suite. Cache results to `benchmark/results/`. | Connect Next.js to live FastAPI backend at `localhost:8000`. | **Checkpoint 3 (T+150):** UI renders live decision diff |
| **T+150 - T+180**| Polish Dockerfiles. Run smoke tests (S1–S8). Lock presentation deck. | Polish empty states, error toasts, and mobile responsiveness. | **Feature Freeze (T+180):** Ready for Demo |

### 16.4 Feature Cut List (Emergency Triage)
If time runs short during the hackathon:
1. **First Cut (P2):** Hindi / Marathi UI localization and Multimodal receipt image attachments.
2. **Second Cut (P1):** Live SSE streaming of the thinking trace (use polling instead) and Supabase cloud persistence (fall back to pure in-memory `STORAGE_BACKEND=memory`).
3. **Never Cut (P0):** The core 5-plan proposal, dry-run regret calculation, the question/act decision, and the interactive demo UI.

---

## 17. Deployment and Runbook

> [!NOTE]
> **Deployment Policy:** The hackathon evaluation does **not** require cloud deployment; running locally with local replay and mock evaluation serves as the primary baseline. Deployment is an optional P1 demonstration enhancement.

### 17.1 Dockerfiles Specification
Multi-stage Dockerfiles ensure minimal image sizes and security hardening:
- Non-root user `appuser` (UID 10001)
- Python slim base image (`python:3.11-slim`)
- Node Alpine base image (`node:20-alpine`)
- Zero credentials or secrets baked into image layers

### 17.2 Optional Cloud Path: Google Cloud Run

#### Deploy Backend to Cloud Run
```bash
# 1. Build and push image to Google Artifact Registry
gcloud builds submit --tag gcr.io/<PROJECT_ID>/sawal-api:latest deploy/api/

# 2. Deploy service with secret injection and 1 warm instance for demo
gcloud run deploy sawal-api \
  --image gcr.io/<PROJECT_ID>/sawal-api:latest \
  --platform managed \
  --region us-central1 \
  --port 8000 \
  --min-instances 1 \
  --timeout 30 \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --set-env-vars ENVIRONMENT=production,ALLOW_GUEST_DEMO=true,STORAGE_BACKEND=memory
```
*TODO-VERIFY: Check current Google Cloud Run free tier limits and billing rates for target deployment region (e.g., asia-south1 or us-central1).*

#### Deploy Frontend to Cloud Run
```bash
gcloud builds submit --tag gcr.io/<PROJECT_ID>/sawal-web:latest deploy/web/

gcloud run deploy sawal-web \
  --image gcr.io/<PROJECT_ID>/sawal-web:latest \
  --platform managed \
  --region us-central1 \
  --port 3000 \
  --min-instances 1 \
  --set-env-vars NEXT_PUBLIC_API_BASE_URL=https://sawal-api-<HASH>.a.run.app/v1
```

### 17.3 Alternative Cloud Path: DigitalOcean App Platform
DigitalOcean is an event track sponsor with **no credits provided**. The team may optionally deploy containers to DigitalOcean App Platform at standard developer pricing if cloud hosting is desired.  
*TODO-VERIFY: Check current DigitalOcean App Platform container pricing and memory specs for basic tier (no sponsor credits provided).*

### 17.4 Demo-Day Runbook
1. **Primary Baseline (Local Run):** Launch FastAPI backend on `http://localhost:8000` and Next.js frontend on `http://localhost:3000`.
2. **Pre-warm (T-30 Min):** Hit `/v1/health` and run a sample session to eliminate cold-start lag.
3. **Offline Replay Fallback (T-15 Min):** If venue Wi-Fi becomes saturated, switch to `LLM_MODE=replay`. The entire demo and benchmark run without external network access.
4. **Backup Media:** Maintain a pre-recorded 90-second screen walkthrough of S1, S2, and S3 scenarios as a presentation safeguard.

### 17.5 Submission (Manual Steps, at the End)
At the conclusion of the hackathon build, execute these manual steps for final submission (*Do NOT execute during local development*):
1. **Final Secret Scan:** Run an automated scan across local commit history to ensure no API keys or `.env` files were tracked:
   ```bash
   git log -p | grep -E "(AIza[0-9A-Za-z-_]{35}|sk_test_)" || echo "No secrets detected"
   ```
2. **Create Public Repository:** On GitHub, create a new public repository (e.g., `github.com/<org>/sawal`) with license set to Apache-2.0.
3. **Push Commits:** Add remote and push local work:
   ```bash
   git remote add origin https://github.com/<org>/sawal.git
   git branch -M main
   git push -u origin main
   ```
4. **Confirm License Detection:** Visit repository on GitHub and verify that the "Apache-2.0 license" badge is displayed in the sidebar.
5. **Confirm README Rendering:** Ensure headings, code blocks, tables, and the Mermaid flowchart render correctly on GitHub's web interface.
6. **Optional Hacktoberfest Topic:** In repository settings, add the `hacktoberfest` topic **only** if the team actively invites external open-source contributions.
7. **Submit Link:** Submit the public repository URL and demo link through the OrganizerHQ hackathon portal before the submission deadline.

---

## 18. Hackathon Track Compliance

### 18.1 Track Compliance Matrix

| Track Requirement | Compliance Specification in Sawal | Exact File / Section |
| :--- | :--- | :--- |
| **Open-Weight AI Role** | Core decision loop relies on open-weight LLMs (Gemma 4 default) to hypothesize interpretations and generate clarifying questions. Closed models strictly rejected. | [`core/interpreter.py`](file:///d:/Sawal/core/interpreter.py), [`api/llm/client.py`](file:///d:/Sawal/api/llm/client.py), [Section 12](#12-ai-and-llm-layer) |
| **Public Repository & License** | Licensed under Apache-2.0; complete text in root `LICENSE`. Public GitHub repo setup documented in submission checklist. | [`LICENSE`](file:///d:/Sawal/LICENSE), [Section 17.5](#175-submission-manual-steps-at-the-end), [Section 22](#22-license-and-contributing) |
| **Original Model-Harness** | Custom mathematical harness: sandbox state cloning, canonical effect extraction, symmetric difference cost, and expected regret minimization. Zero LangChain/LlamaIndex wrappers. | [`core/world.py`](file:///d:/Sawal/core/world.py), [`core/engine.py`](file:///d:/Sawal/core/engine.py), [`core/clustering.py`](file:///d:/Sawal/core/clustering.py), [`core/policy.py`](file:///d:/Sawal/core/policy.py), [Section 5](#5-core-algorithm-specification) |
| **Best Use of Gemma 4 (Secondary)** | **Moderate fit.** Sawal is designed as model-agnostic across open weights, but utilizes hosted Gemma 4 as its default benchmark model via Google Gen AI Python SDK. | [Section 18.2](#182-secondary-track-assessment-best-use-of-gemma-4) |
| **Community Guidelines** | Full Contributor Covenant Code of Conduct and contributor guidelines. | [`CODE_OF_CONDUCT.md`](file:///d:/Sawal/CODE_OF_CONDUCT.md), [`CONTRIBUTING.md`](file:///d:/Sawal/CONTRIBUTING.md) |

### 18.2 Secondary Track Assessment: Best Use of Gemma 4
We characterize Sawal's fit for the *Best Use of Gemma 4* track as **moderate**. 
- *Why it fits:* Gemma 4 serves as the default semantic reasoning engine for all 24 benchmark tasks and interactive sessions, leveraging its structured JSON output capabilities via the Google Gen AI SDK.
- *Honest distinction:* Sawal is architected from first principles to be foundation-model-agnostic across all open-weight architectures (Gemma, Llama, Mistral, Qwen). We do not fine-tune Gemma weights or rely on proprietary Gemma-only extensions.

### 18.3 Good First Issues (Hacktoberfest Contributor Tasks)
To welcome community contributions during Hacktoberfest, we identify 8 self-contained starter issues:
1. `good-first-issue #1`: Add support for `contacts.update` tool with reversibility weight $w=0.4$ in `core/tools.py`.
2. `good-first-issue #2`: Add unit tests for negative currency amounts and non-INR symbols in `core/world.py`.
3. `good-first-issue #3`: Implement a Rich terminal table renderer for `benchmark/runner.py` results.
4. `good-first-issue #4`: Add dark/light mode toggle to the Next.js header in `web/src/components/Navbar.tsx`.
5. `good-first-issue #5`: Add Hindi and Marathi localization strings for `QuestionCard` action buttons.
6. `good-first-issue #6`: Add CSV export button for benchmark evaluation data on `/benchmark`.
7. `good-first-issue #7`: Implement a local vLLM preset connection helper in `api/llm/client.py`.
8. `good-first-issue #8`: Add keyboard shortcuts (`1`, `2`, `3`) for option chip selection in `web/src/components/QuestionCard.tsx`.

### 18.4 AI Assistance Disclosure
In accordance with open-source transparency:
- AI coding assistance (Antigravity IDE / Gemini) was utilized during the initial ideation, API contract drafting, and architectural documentation phase of this project.
- Core algorithmic formulations, decision theory logic, tool schemas, and benchmark design were authored and verified specifically for this hackathon.
- *Team Note:* The team must check the event's specific AI-use guidelines with Hack Day Pune organizers on the morning of October 13, 2026.

### 18.5 Pre-Event Preparation vs. Onsite Event Work
- **Permitted Pre-Event Preparation:** Architectural design, documentation scaffolding (`README.md`, `contracts/openapi.yaml`, `LICENSE`), developer account setup (Google AI Studio, Clerk, Supabase), API key generation, and reading research literature.
- **Onsite Event Execution:** Writing application code, debugging tool sandboxes, executing the 24-task benchmark against live models, frontend UI styling, and presentation preparation.
- *TODO-VERIFY: Confirm with hackathon organizers the policy on pre-event documentation/scaffolding versus code written onsite.*

---

## 19. Related Work

Sawal does not claim to invent decision-theoretic uncertainty, but rather provides an open-source, effect-grounded implementation with empirical evaluation. We build upon recent research:

1. **Structured Uncertainty for Agents:**  
   *Structured Uncertainty guided Clarification for LLM Agents* (Manan Suri et al., arXiv:2511.08798). Introduces SAGE-Agent and ClarifyBench, demonstrating that modeling uncertainty over structured tool parameters significantly improves clarification timing compared to unstructured prompting.
2. **Multi-Turn Clarification Dynamics:**  
   *ClarifyMT-Bench: Benchmarking and Improving Multi-Turn Clarification for Conversational Large Language Models* (arXiv:2512.21120). Identifies systemic under-clarification bias across modern conversational agents.
3. **Agent Abstention and Safety:**  
   *AgentAbstain: Do LLM Agents Know When Not to Act?* (arXiv:2607.10059). Details the inability of frontier tool-using agents to withhold action when constraints are ambiguous.
4. **Search and Ambiguity:**  
   *When Search Agents Should Ask: DiscoBench for Clarification-Aware Deep Search* (arXiv:2606.27669). Examines ambiguity detection in information-seeking agents.
5. **Task-Framing Ambiguity:**  
   *Ambig-DS: A Benchmark for Task-Framing Ambiguity in Data-Science Agents* (arXiv:2605.09698). Formulates "silent misframing" in goal-oriented tool execution.

---

## 20. Limitations and Ethics

- **Mock World Boundaries:** Current tool sandboxes simulate 8 discrete actions. Real-world tools involve complex external side effects (e.g., non-idempotent web APIs) that cannot always be cloned in memory.
- **Prompt Sensitivity:** The quality of the $K=5$ interpretation pool depends on Gemma 4's diversity. Highly biased models may propose 5 identical wrong plans, bypassing regret detection.
- **User Autonomy vs. Friction:** The $\tau$ threshold represents an inherent trade-off: lower $\tau$ increases clarification fatigue, while higher $\tau$ increases error risk.

---

## 21. Roadmap

- **P0 (Hackathon Day 1):** Complete 5-plan proposal, sandbox dry-run, expected regret calculation, 8 mock tools, Next.js UI, Clerk auth, and 24-task benchmark.
- **P1 (Post-Hackathon):** Server-Sent Events (SSE) streaming for real-time thinking traces; per-user preference memory in Supabase to personalize prior weights.
- **P2 (Future):** Multimodal interpretation (receipt image processing); packaging Sawal as an official Agent Skill for standard agent frameworks; Hindi and Marathi natural language UI localization.

---

## 22. License and Contributing

Copyright 2026 Jugaad Labs.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at:

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
