/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BenchmarkPolicy,
  BenchmarkSummary,
  AuditEvent,
  Effect,
  ExecutionResult,
  Interpretation,
  LlmMode,
  OutcomeGroup,
  Reversibility,
  Session,
  ToolMode,
  ConnectionStatus,
  WorldDiffItem,
} from "./types";

const API = "/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `Request failed (${response.status})`);
  }
  return body as T;
}

function reversibilityFor(tool = ""): Reversibility {
  if (tool.endsWith(".list") || tool.endsWith(".search")) return "readonly";
  if (tool === "email.send" || tool === "restaurants.book") return "irreversible";
  return "reversible";
}

function titleFor(tool = "action") {
  return tool.split(".").map((part) => part.replace(/_/g, " ")).join(" · ");
}

function effectFromTool(toolCall: any): Effect {
  const tool = toolCall?.tool || "action";
  return {
    summary: titleFor(tool),
    detail: Object.entries(toolCall?.args || {}).map(([key, value]) => `${key}: ${String(value)}`).join(" · "),
    reversibility: reversibilityFor(tool),
  };
}

function flattenWorldDiff(diff: any): WorldDiffItem[] {
  if (Array.isArray(diff)) return diff;
  const rows: WorldDiffItem[] = [];
  for (const op of ["added", "modified", "deleted"] as const) {
    const bucket = diff?.[op] || {};
    for (const [entity, value] of Object.entries(bucket)) {
      const values = Array.isArray(value) ? value : [value];
      values.forEach((item, index) => rows.push({
        id: `${op}-${entity}-${index}`,
        op,
        entity,
        summary: typeof item === "string" ? item : JSON.stringify(item),
        reversibility: op === "deleted" ? "irreversible" : "reversible",
      }));
    }
  }
  return rows;
}

export function normalizeSession(raw: any): Session {
  const rawInterpretations = raw?.interpretations || [];
  const interpretations: Interpretation[] = rawInterpretations.map((item: any) => ({
    ...item,
    plan: item.plan || [],
    effects: item.effects?.length ? item.effects : (item.plan || []).slice(-1).map(effectFromTool),
  }));

  const rawGroups = raw?.groups || raw?.decision?.groups || [];
  const groups: OutcomeGroup[] = rawGroups.map((group: any, index: number) => {
    const members = interpretations.filter((item) => item.group_id === group.id);
    const canonicalEffects = (group.canonical_effects || []).map((effect: any) => ({
      summary: `${effect.operation || "change"} ${effect.entity_type || "entity"}`,
      detail: Object.entries(effect.key_fields || {}).map(([key, value]) => `${key}: ${String(value)}`).join(" · "),
      reversibility: effect.reversibility_weight >= 0.7 ? "irreversible" : effect.reversibility_weight === 0 ? "readonly" : "reversible",
    }));
    const effects = group.effects?.length ? group.effects : canonicalEffects.length ? canonicalEffects : members[0]?.effects || [];
    return {
      ...group,
      size: group.size ?? group.interpretation_ids?.length ?? members.length,
      label: group.label || effects[0]?.summary || `Outcome ${index + 1}`,
      effects,
    };
  });

  const decision = raw?.decision || { action: "ask", expected_regret: 0, tau: 0.25 };
  const result: ExecutionResult | null = raw?.result ? {
    ...raw.result,
    executed_tools: raw.result.executed_tools || (raw.result.executed_plan || []).map((call: any) => call.tool),
    world_diff: flattenWorldDiff(raw.result.world_diff),
  } : null;

  return {
    ...raw,
    session_id: raw?.session_id || raw?.id || `session-${Date.now()}`,
    proposer: raw?.proposer,
    decision: {
      ...decision,
      threshold: decision.threshold ?? decision.tau ?? 0.25,
      low_diversity: decision.low_diversity ?? false,
    },
    interpretations,
    groups,
    question: raw?.question ? {
      ...raw.question,
      text: raw.question.text || raw.question.question,
    } : null,
    result,
    trace: (raw?.trace || []).map((item: any, index: number) => ({
      step: item.step ?? index + 1,
      message: item.message || item.kind?.replace(/_/g, " ") || "Trace event",
      kind: item.kind,
      timestamp: item.timestamp,
    })),
  };
}

export async function createSession(requestText: string, llmMode: LlmMode, toolMode: ToolMode = "mock"): Promise<Session> {
  const raw = await request<any>("/sessions", {
    method: "POST",
    body: JSON.stringify({ request_text: requestText, llm_mode: llmMode, tool_mode: toolMode }),
  });
  return normalizeSession(raw);
}

export async function answerSession(sessionId: string, answer: { option_id?: string; free_text?: string }): Promise<Session> {
  const current = await request<any>(`/sessions/${sessionId}`);
  const raw = await request<any>(`/sessions/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify({ question_id: current.question?.id, ...answer }),
  });
  return normalizeSession(raw);
}

export async function confirmAction(session: Session): Promise<Session> {
  if (!session.action) throw new Error("No action is waiting for confirmation.");
  const raw = await request<any>(`/sessions/${session.session_id}/confirm`, {
    method: "POST",
    body: JSON.stringify({
      action_id: session.action.id,
      idempotency_key: session.action.idempotency_key,
    }),
  });
  return normalizeSession(raw);
}

export async function cancelAction(session: Session): Promise<Session> {
  if (!session.action) throw new Error("No action is waiting for cancellation.");
  const raw = await request<any>(`/sessions/${session.session_id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ action_id: session.action.id }),
  });
  return normalizeSession(raw);
}

export async function fetchConnections(): Promise<ConnectionStatus[]> {
  const response = await request<{ items: ConnectionStatus[] }>("/connections");
  return response.items;
}

export async function connectGoogle(): Promise<void> {
  const response = await request<{ authorization_url: string }>("/oauth/google/connect");
  window.location.assign(response.authorization_url);
}

export async function disconnectGoogle(): Promise<void> {
  await request("/connections/google", { method: "DELETE" });
}

export async function fetchAudit(): Promise<AuditEvent[]> {
  const response = await request<{ items: AuditEvent[] }>("/audit");
  return response.items;
}

export const fetchLiveWorld = () => request<any>("/world");
export const resetLiveWorld = () => request<any>("/world/reset", { method: "POST" });

function policy(name: BenchmarkPolicy["name"], metrics: any): BenchmarkPolicy {
  return {
    name,
    questions_per_task: metrics?.questions_per_task || 0,
    wrong_action_rate: metrics?.wrong_action_rate || 0,
    unnecessary_question_rate: metrics?.unnecessary_question_rate || 0,
    irreversible_error_rate: metrics?.irreversible_error_rate || 0,
  };
}

export async function fetchBenchmarkData(forceSample = false): Promise<{ summary: BenchmarkSummary; isSample: boolean; source: "live" | "file" | "sample" }> {
  if (forceSample) {
    const summary = await fetch("/benchmark_results.sample.json").then((response) => response.json());
    return { summary, isSample: true, source: "sample" };
  }
  try {
    const raw = await request<any>("/benchmark/summary");
    const summary: BenchmarkSummary = {
      meta: { n_tasks: raw.tasks_count, model: raw.execution_mode || "backend", date: raw.timestamp?.slice(0, 10) || "" },
      execution_mode: raw.execution_mode,
      tasks_count: raw.tasks_count,
      timestamp: raw.timestamp,
      note: raw.note,
      policies: [
        policy("always_act", raw.baselines?.always_act),
        policy("always_ask", raw.baselines?.always_ask),
        policy("sawal", raw.metrics),
      ],
      sweep: raw.tau_sweep || [],
    };
    return { summary, isSample: false, source: "live" };
  } catch {
    const summary = await fetch("/benchmark_results.sample.json").then((response) => response.json());
    return { summary, isSample: true, source: "file" };
  }
}
