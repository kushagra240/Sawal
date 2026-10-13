/* eslint-disable @typescript-eslint/no-explicit-any */
import { normalizeSession } from "./api";
import { Session } from "./types";

async function loadFixture(): Promise<any> {
  const response = await fetch("/api/v1/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_text: "Check my calendar for tomorrow afternoon.", llm_mode: "replay" }),
  });
  return response.json();
}

export async function mockCreateSession(input: { request_text: string; llm_mode?: string }): Promise<Session> {
  if (input.request_text === "trigger error") {
    return normalizeSession({
      id: "mock-error",
      request_text: input.request_text,
      status: "failed",
      decision: { action: "ask", expected_regret: 0, tau: 0.25, groups: [] },
      interpretations: [],
      question: null,
      result: null,
      trace: [],
      error: { message: "Execution engine aborted" },
    });
  }
  const response = await fetch("/api/v1/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return normalizeSession(await loadFixture());
  return normalizeSession(await response.json());
}

export async function mockAnswerSession(sessionId: string, answer: { option_id?: string; free_text?: string }): Promise<Session> {
  const current = await fetch(`/api/v1/sessions/${sessionId}`).then((response) => response.json());
  const response = await fetch(`/api/v1/sessions/${sessionId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_id: current.question?.id, ...answer }),
  });
  return normalizeSession(await response.json());
}
