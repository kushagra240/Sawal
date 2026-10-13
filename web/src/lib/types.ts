export type LlmMode = "live" | "replay";
export type ToolMode = "mock" | "live";
export type Reversibility = "readonly" | "reversible" | "irreversible";
export type PolicyName = "always_act" | "always_ask" | "ask_if_model_unsure" | "sawal";
export type DecisionAction = "act" | "ask";

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export type PlanStep = ToolCall;

export interface Effect {
  summary: string;
  detail?: string;
  reversibility: Reversibility;
}

export interface Interpretation {
  id: string;
  rationale: string;
  group_id: string;
  plan: ToolCall[];
  effects: Effect[];
  slots?: Record<string, unknown>;
  signature?: string;
}

export interface OutcomeGroup {
  id: string;
  size: number;
  label: string;
  effects: Effect[];
  mass?: number;
  interpretation_ids?: string[];
}

export interface Decision {
  action: "act" | "ask";
  expected_regret: number;
  threshold: number;
  low_diversity?: boolean;
  chosen_group_id?: string | null;
}

export interface QuestionOption {
  id: string;
  label: string;
  value?: string;
  target_group_ids?: string[];
  matched?: boolean;
  description?: string;
  meta?: string[];
}

export interface Question {
  id: string;
  text: string;
  slot_name?: string;
  options: QuestionOption[];
}

export interface WorldDiffItem {
  id: string;
  op: string;
  entity: string;
  summary: string;
  reversibility: Reversibility;
}

export interface ExecutionResult {
  success: boolean;
  executed_tools: string[];
  world_diff: WorldDiffItem[];
  message: string;
}

export interface TraceStep {
  step: number;
  message: string;
  kind?: string;
  timestamp?: string;
}

export interface Session {
  session_id: string;
  request_text: string;
  proposer?: string;
  status: "asked" | "ready" | "awaiting_confirmation" | "executing" | "completed" | "cancelled" | "failed";
  decision: Decision;
  interpretations: Interpretation[];
  groups: OutcomeGroup[];
  question: Question | null;
  result: ExecutionResult | null;
  trace: TraceStep[];
  error?: { message: string; code?: string } | null;
  _chosenGroupId?: string | null;
  tool_mode?: ToolMode;
  action?: LiveAction | null;
}

export interface ActionPreviewItem {
  tool: string;
  provider?: string;
  position: number;
  to?: string;
  subject?: string;
  body?: string;
  [key: string]: unknown;
}

export interface LiveAction {
  id: string;
  session_id: string;
  state: "ready" | "awaiting_confirmation" | "executing" | "completed" | "cancelled" | "failed";
  idempotency_key: string;
  preview: {
    items: ActionPreviewItem[];
    requires_confirmation: boolean;
    warning: string;
  };
  result?: Record<string, unknown> | null;
  error?: { code: string; message: string; retryable?: boolean } | null;
}

export interface ConnectionStatus {
  provider: string;
  connected: boolean;
  account_email?: string | null;
  scopes: string[];
  updated_at?: string | null;
  credential_storage_persistent?: boolean;
}

export interface AuditEvent {
  id: string;
  action_id?: string | null;
  event_type: string;
  provider?: string | null;
  tool?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ChatTurn {
  id: string;
  requestText: string;
  session: Session | null;
  isLoading?: boolean;
  timestamp: number;
  answerText?: string;
  errorMessage?: string | null;
}

export interface LiveCalendarEvent { id: string; title: string; start_time: string; end_time?: string }
export interface LiveEmail { id: string; to: string; subject: string; status: string }
export interface LiveReservation { id: string; restaurant_id: string; party_size: number; time?: string }
export interface LiveExpense { id: string; amount: number; currency?: string; description: string }
export interface LiveWorldState {
  contacts: Array<Record<string, unknown>>;
  calendar_events: LiveCalendarEvent[];
  restaurants: Array<Record<string, unknown>>;
  reservations: LiveReservation[];
  emails: LiveEmail[];
  expenses: LiveExpense[];
}

export interface BenchmarkPolicy {
  name: PolicyName;
  questions_per_task: number;
  wrong_action_rate: number;
  unnecessary_question_rate: number;
  irreversible_error_rate: number;
}

export type PolicyMetric = BenchmarkPolicy;

export interface SweepPoint {
  tau: number;
  questions_per_task: number;
  wrong_action_rate: number;
}

export interface SessionError {
  message: string;
  code?: string;
}

export interface BenchmarkSummary {
  meta: { n_tasks: number; model: string; date: string };
  policies: BenchmarkPolicy[];
  sweep: SweepPoint[];
  execution_mode?: string;
  tasks_count?: number;
  timestamp?: string;
  note?: string;
}
