# Sawal - Team Hackathon Plan

## 1. Pitch and Problem Statement
Pitch: Every AI assistant either guesses or nags. Sawal rehearses first.

When a student asks an AI assistant to handle daily tasks, current agents fail in two opposite ways.
First, they guess blindly when instructions are vague.
This causes mistakes that cannot be undone.
An assistant might send an unreviewed email to the department head instead of a classmate.
It might reserve the wrong lab bench during exam week.
It might log a messy shared lunch expense to the wrong student group account.
Or it might book an expensive restaurant dinner instead of the campus canteen.
Second, cautious assistants swing to the other extreme and nag constantly.
They ask five basic confirmation questions before doing even read-only searches.
Students get tired of answering questions and stop using the tool.
Sawal solves this tension by rehearsing every guess inside a private sandbox first.
It only interrupts when the possible readings lead to different outcomes and a wrong guess would be costly, especially if it cannot be undone.

## 2. What We Build
A simple, focused web application with four visible areas on a single screen:
- A prompt input where the student types a natural, ambiguous request in plain language.
- A rehearsal viewer showing the five distinct interpretations proposed by the model.
- Each proposed plan displays its sequence of tool steps and its simulated outcome.
- A question card that appears only when clarification is mathematically needed.
- The question card provides pre-rendered clickable option chips and a custom answer text box.
- A live effect inspector that shows the exact sandbox changes side by side.
- Safe actions like calendar reads or draft emails are highlighted in green.
- Irreversible actions like sent emails or room bookings are highlighted in amber or red.
- A toggle switch at the top to flip instantly between live model calls and offline replay.

## 3. How It Works
1. Propose: An open-weight model reads the request and proposes about five structured tool plans.
   The model also extracts key slot values like recipient names and booking times.
2. Rehearse: Deterministic Python code runs each candidate plan inside an in-memory clone of the mock world.
   Every tool runs in complete isolation without mutating the user's live data.
3. Group: The engine inspects the actual state changes and groups plans that produce identical results.
   Plans with cosmetic differences but identical real-world consequences share the same group.
4. Weigh: The engine calculates expected regret across the outcome groups.
   Irreversible actions like sending an email or booking a room receive much heavier penalty weights.
   Safe actions like creating a draft or listing events carry minimal friction weights.
5. Decide: If expected regret is below our tuned threshold, Sawal acts right away on the live state.
   If regret is above the threshold, Sawal selects the single slot that resolves the ambiguity.
   The open-weight model phrases a natural question, and the app pauses until answered.

## 4. Demo Plan

### 3-Minute Presentation Script
- Minute 0:00 to 0:45: Introduce Jugaad Labs.
  Explain the two bad extremes of agent behavior: blind guessing versus constant nagging.
  Show a real student example of emailing the wrong professor.
- Minute 0:45 to 1:45: Run a clear request that executes instantly without interrupting.
  Then run an ambiguous request where Sawal pauses and displays a crisp single question.
  Answer the question by clicking an option chip, and watch Sawal execute the correct plan.
- Minute 1:45 to 2:30: Walk through the rehearsal panel.
  Show how the five interpretations were dry-run in parallel sandboxes.
  Highlight the reversibility badge and show the live world diff.
- Minute 2:30 to 3:00: Show the real benchmark chart and state the actual numbers from our runs, whatever they are.

### 5 Rehearsed Vague Requests
1. Clear Act: "Check my calendar for tomorrow afternoon."
   Read-only search, zero real-world cost, acts immediately without asking.
2. Harmless Ambiguity: "Find a quiet spot for team lunch near campus."
   Different search filters produce safe query reads, acts immediately without asking.
3. Decisive Ask: "Send an email to Priya confirming the lab slot."
   Two contacts named Priya in the address book; sending an email cannot be unsent.
   Sawal halts and asks: "Did you mean Priya Sharma (Lab Lead) or Priya Kulkarni (Classmate)?"
   Click "Priya Sharma (Lab Lead)" on the question card; Sawal maps the slot, executes the email tool on live state, and shows the updated outbox.
4. Asymmetric Risk: "Draft a note to the study group and log forty rupees for tea."
   Logging an expense and saving a draft carry low undo friction, acts immediately.
5. Decisive Ambiguity: "Book the seminar hall for a group meeting."
   Two halls fit; room booking cannot be undone easily, so Sawal halts and asks.

### Backup Plan If Wi-Fi Fails
All demo requests are pre-recorded into the local replay cache folder.
If the venue network drops or latency spikes, switch the backend mode to replay.
The entire three-minute demo then runs locally from disk in under two seconds.
A backup 90-second screen recording will also be kept ready on the presenter laptop.

## 5. Tech Stack
- Backend: Python 3.11+ with FastAPI for the lightweight REST API service.
- Frontend: Next.js App Router with TypeScript and Tailwind CSS.
  Any UI wireframes or Figma designs are external and stay off the repo.
- Storage: Pure in-memory dictionaries for the hackathon P0 build.
  Supabase and Clerk are optional P1 adapters and will not be touched during P0.
- Open-Weight LLM: Hosted Gemma 4 through the Gemini API as our primary default.
  Also supports an OpenAI-compatible endpoint for local models like Ollama or vLLM.
- Model Guard: An allowlist rejects any closed proprietary model at startup.
- Resilience: Client-side rate limiter to stay under 15 requests per minute.
  Disk replay cache ensures full offline execution during internet outages.

## 6. Work Split and Single Interface

### Role Division
- Teammate A (Brain): Decision engine, mock world state, tool sandboxes, regret math, LLM client, benchmark runner.
- Teammate B (Face): Web UI, visual rehearsal components, question card, state diff viewer, demo deck, pitch practice.

### The Single Interface Between Teammates
A single HTTP endpoint connects the frontend and backend:
The frontend sends a POST request to create a session with the user request text.
The backend responds with a JSON session object containing:
- Session ID: unique string identifier.
- Status: either "completed" or "asked".
- Expected regret score and the decision threshold value.
- Question object: a question string and an array of clickable options with labels and IDs (present only if asked).
- Result object: list of executed tools and the world state diff (present only if completed).
- Trace list: short progress steps explaining what the engine did during rehearsal.

Teammate B builds the UI against this mock response from minute one, while Teammate A writes the engine.

### Working Together
At minute 0 one teammate creates the GitHub repo (add the Apache-2.0 license and a .gitignore that excludes .env files first) and the other clones it. Teammate A edits only core/, api/ and benchmark/. Teammate B edits only web/. The shared file contracts/sample_session.json is written together at minute 0 and changes only by agreement. Commit and push every 20-30 minutes, pull before each work block, never commit API keys.

## 7. Three-Hour Build Timeline

### Minute 0 to 60
- Both: At minute 0, write the sample session JSON together, run git init, add the Apache-2.0 license, and commit often.
- Teammate A: Build the mock world entities, deep-copy sandbox, tool schemas, and basic dry-run executor; minute 0-15 test one real model call for structured output; minute 0-60 also build the model proposer and plan validation.
- Teammate B: Set up Next.js skeleton, Tailwind styles, request input box, and static mock session response; write the 24 benchmark tasks and the rule-based simulated user.
- Checkpoint 60: Engine runs tool plans locally in memory; UI displays a mock question card.

### Minute 60 to 120
- Teammate A: Implement canonical effect grouping, regret formula, ask-or-act policy, and wire FastAPI endpoint; minute 60-100 build the rate limiter; minute 90-110 write the benchmark runner and baselines (if behind, cut to Sawal versus Always Act); Teammate A starts the benchmark run by minute 125.
- Teammate B: Build the candidate plan viewer, effect diff component, and hook UI to local backend.
- Checkpoint 120: Full loop works end-to-end on localhost with a live open-weight model call.

### Minute 120 to 150
- Teammate A: Run the 24-task benchmark suite, record replay cache, and export results JSON; record the 5 rehearsed demo requests into the replay cache.
- Teammate B: Build the benchmark chart component, polish layout, test empty and error states.
- Checkpoint 150: Benchmark curve displays real numbers; UI runs smoothly offline on replay cache.

### Minute 150 to 180
- Both: Rehearse 3-minute pitch twice, run smoke test, record backup screen video, freeze code.

## 8. Cut List
- P0 (Must Ship): Five-plan rehearsal engine, mock tools, single-page web UI, ask-vs-act logic, cached benchmark chart, replay fallback.
- P1 (Extras if P0 ready early): Live streaming trace, user history page, Supabase persistence adapter, Clerk sign-in.
- P2 (Drop First): Mobile layout tuning, image attachments, multi-language Hindi or Marathi prompts.

If behind schedule at minute 120:
Drop Clerk and Supabase immediately; keep pure in-memory storage.
Drop streaming updates and use standard request-response.
Drop extra benchmark baselines and focus on Sawal versus Always Act.
Never drop the core rehearsal logic or the question card.

## 9. Mini Benchmark Plan
- Dataset: 24 hand-crafted student tasks split evenly across three cohorts.
- 8 Clear tasks: unambiguous requests that must act immediately without asking.
- 8 Decisively Ambiguous tasks: high-risk requests that must ask exactly one question.
- 8 Harmlessly Ambiguous tasks: vague phrasing with safe or identical effects that should act without asking.
- Baselines:
  Always Act: blindly executes the first plan every time.
  Always Ask: nags the user on every single task regardless of risk.
  Ask If Model Unsure: asks the model a single prompt whether it feels confident.
- Metrics:
  Wrong-action rate: percentage of tasks where executed effects contradict user intent.
  Questions asked per task: average clarification count.
  Unnecessary question rate: questions asked on clear or harmless tasks.
  Irreversible error rate: wrong actions on operations with high undo cost.
- Benchmark Chart: A scatter or curve showing questions asked on the horizontal axis versus errors on the vertical axis.
- Strict Rule: All benchmark numbers presented to judges must come from actual model runs on the day, never invented.
- Execution: Teammate B writes the 24 benchmark tasks and the rule-based simulated user in minutes 0-60; Teammate A starts the benchmark run by minute 110.

## 10. Rules Checklist
- Open-weight model is an integral part of the project (Gemma 4 default, open alternatives allowed).
- All application code must be written from scratch on the day of the event.
- Repository must be public with an Apache-2.0 license at submission time.
- Honest claims: state clearly that tools are sandboxed mocks and users are rule-based simulators.
- Disclose AI coding tool assistance if asked by judges or organizers.
- If any event rule is ambiguous, check on the day with the organizers before assuming.

## 11. Biggest Risks and Fallbacks
1. Model proposes repetitive or malformed plans:
   Prevention: Prompt engineering with few-shot examples of distinct slots.
   Fallback: Pydantic schema validation drops bad tool calls; if fewer than two valid plans survive, engine executes the best plan and flags low diversity.
2. API rate limits or quota exhaustion:
   Prevention: Client-side rate limiter queues requests to stay under 15 requests per minute.
   Fallback: Benchmark runs once, saves to local cache, and serves instant offline responses.
3. Live demo breaks during judging:
   Prevention: Test rehearsal logic locally multiple times before presentation.
   Fallback: Switch one toggle to replay mode; the app instantly uses saved runs without making network calls.
4. Running out of time during the build:
   Prevention: Strict 60, 120, and 150-minute checkpoints.
   Fallback: Enforce the cut list at minute 120; ship in-memory P0 with zero external cloud dependencies.

## 12. Submission Checklist
- Pre-submission secret check: verify no API keys or local environment files are committed.
- Public repository: confirm GitHub repository visibility is set to public.
- License: verify Apache-2.0 license file is present and detected on the repo homepage.
- Documentation: confirm README is complete, scannable, and rendered cleanly.
- Backup recording: record a 90-second screen demo video showing both act and ask flows.
- Final handoff: submit repository URL and video link through the OrganizerHQ portal before the deadline.
