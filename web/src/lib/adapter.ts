/**
 * Sawal API Adapter.
 * Normalizes backend response shapes into the strict frontend types defined in types.ts.
 * Handles schema differences between Teammate A's backend and Teammate B's frontend.
 */

import {
  BenchmarkSummary,
  Decision,
  DecisionAction,
  Effect,
  ExecutionResult,
  OutcomeGroup,
  PlanStep,
  PolicyMetric,
  PolicyName,
  Question,
  QuestionOption,
  Reversibility,
  Session,
  SessionError,
  SweepPoint,
  WorldDiffItem,
} from "./types";

/**
 * Derives the reversibility label from the numeric reversibility_weight when no label exists:
 * - no effects or weight <= 0 -> "readonly"
 * - weight < 0.7 -> "reversible"
 * - weight >= 0.7 -> "irreversible"
 */
export function deriveReversibility(weight?: number | null): Reversibility {
  if (weight === undefined || weight === null || weight <= 0) {
    return "readonly";
  }
  if (weight < 0.7) {
    return "reversible";
  }
  return "irreversible";
}

/**
 * Normalizes an effect dictionary into the frontend Effect type.
 */
export function normalizeEffect(rawEff: Record<string, unknown> | null | undefined): Effect {
  if (!rawEff || typeof rawEff !== "object") {
    return {
      summary: "Safe operation",
      reversibility: "readonly",
    };
  }

  // Determine reversibility
  let reversibility: Reversibility = "readonly";
  const rawRev = typeof rawEff.reversibility === "string" ? rawEff.reversibility : undefined;
  if (rawRev === "readonly" || rawRev === "reversible" || rawRev === "irreversible") {
    reversibility = rawRev;
  } else {
    const rawWeight = typeof rawEff.reversibility_weight === "number" ? rawEff.reversibility_weight : null;
    reversibility = deriveReversibility(rawWeight);
  }

  const keyFields = (rawEff.key_fields && typeof rawEff.key_fields === "object"
    ? rawEff.key_fields
    : {}) as Record<string, unknown>;

  // Determine summary
  let summary = typeof rawEff.summary === "string" ? rawEff.summary : typeof rawEff.description === "string" ? rawEff.description : "";
  if (!summary) {
    const entity = typeof rawEff.entity_type === "string" ? rawEff.entity_type : "item";
    const op = typeof rawEff.operation === "string" ? rawEff.operation : "update";
    if (entity === "email" && op === "send") {
      summary = `Email sent to ${typeof keyFields.to === "string" ? keyFields.to : "recipient"}`;
    } else if (entity === "email" && (op === "draft" || op === "create")) {
      summary = `Draft created for ${typeof keyFields.to === "string" ? keyFields.to : "recipient"}`;
    } else if (entity === "calendar" || entity === "calendar_events") {
      summary = `Calendar event: ${typeof keyFields.title === "string" ? keyFields.title : op}`;
    } else if (entity === "expense" || entity === "expenses") {
      summary = `Expense logged${keyFields.amount ? ` ₹${keyFields.amount}` : ""}`;
    } else if (entity === "reservation" || entity === "restaurants") {
      summary = `Reservation for ${keyFields.party_size ? keyFields.party_size : 2} guests`;
    } else {
      summary = `${entity} · ${op}`;
    }
  }

  // Determine detail
  let detail = typeof rawEff.detail === "string" ? rawEff.detail : undefined;
  if (!detail && keyFields) {
    if (typeof keyFields.subject === "string") {
      detail = `Re: ${keyFields.subject}`;
    } else if (keyFields.description !== undefined && keyFields.description !== null) {
      detail = String(keyFields.description);
    }
  }

  return {
    summary,
    reversibility,
    detail: detail || undefined,
  };
}

/**
 * Flattens backend world_diff { added, modified, deleted } or array into WorldDiffItem[]
 */
export function normalizeWorldDiff(rawDiff: unknown): WorldDiffItem[] {
  if (!rawDiff) return [];
  if (Array.isArray(rawDiff)) {
    return rawDiff.map((d, idx) => {
      const rec = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
      return {
        id: String(rec.id || `diff-${idx}`),
        entity: String(rec.entity || "entity"),
        op: String(rec.op || "change"),
        summary: String(rec.summary || ""),
        reversibility: (rec.reversibility as Reversibility) || "reversible",
      };
    });
  }

  if (typeof rawDiff !== "object") return [];
  const diffRecord = rawDiff as Record<string, unknown>;

  const rows: WorldDiffItem[] = [];
  const collections = ["added", "modified", "deleted"] as const;

  for (const opKey of collections) {
    const groupObj = diffRecord[opKey];
    if (!groupObj || typeof groupObj !== "object") continue;

    for (const [entityName, items] of Object.entries(groupObj as Record<string, unknown>)) {
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        const itemObj = (item && typeof item === "object" && ((item as Record<string, unknown>).after || item)) || {};
        const itemRec = itemObj as Record<string, unknown>;
        let summary = "";
        let reversibility: Reversibility = "reversible";

        if (entityName === "emails") {
          const isSent = itemRec.status === "sent";
          summary = isSent
            ? `Email sent to ${itemRec.to || "recipient"}${itemRec.subject ? ` (${itemRec.subject})` : ""}`
            : `Draft created for ${itemRec.to || "recipient"}${itemRec.subject ? ` (${itemRec.subject})` : ""}`;
          reversibility = isSent ? "irreversible" : "reversible";
        } else if (entityName === "calendar_events") {
          summary = `Calendar: ${itemRec.title || "Event"}${itemRec.start_time ? ` at ${itemRec.start_time}` : ""}`;
          reversibility = "reversible";
        } else if (entityName === "expenses") {
          summary = `Logged ₹${itemRec.amount || 0} for ${itemRec.description || "expense"}`;
          reversibility = "reversible";
        } else if (entityName === "reservations") {
          summary = `Reservation for ${itemRec.party_size || 2} guests at ${itemRec.restaurant_id || "venue"}`;
          reversibility = "irreversible";
        } else {
          summary = typeof itemObj === "string" ? itemObj : `${entityName} item ${opKey}`;
        }

        rows.push({
          id: `${opKey}-${entityName}-${rows.length}`,
          entity: entityName,
          op: opKey === "added" ? "create" : opKey === "deleted" ? "delete" : "update",
          summary,
          reversibility,
        });
      }
    }
  }

  return rows;
}

/**
 * Normalizes backend execution result.
 */
export function normalizeResult(rawResult: unknown): ExecutionResult | null {
  if (!rawResult || typeof rawResult !== "object") return null;
  const resObj = rawResult as Record<string, unknown>;

  let executed_tools: string[] = [];
  if (Array.isArray(resObj.executed_tools)) {
    executed_tools = resObj.executed_tools.map(String);
  } else if (Array.isArray(resObj.executed_plan)) {
    executed_tools = resObj.executed_plan
      .map((p) => (p && typeof p === "object" ? String((p as Record<string, unknown>).tool) : null))
      .filter((t): t is string => Boolean(t));
  }

  const world_diff = normalizeWorldDiff(resObj.world_diff);

  return {
    success: typeof resObj.success === "boolean" ? resObj.success : true,
    executed_tools,
    world_diff,
    message: typeof resObj.message === "string" ? resObj.message : "Execution completed",
  };
}

/**
 * Normalizes backend Question shape.
 */
export function normalizeQuestion(
  rawQ: unknown,
  groups: OutcomeGroup[]
): Question | null {
  if (!rawQ || typeof rawQ !== "object") return null;
  const qObj = rawQ as Record<string, unknown>;

  const text = String(qObj.text || qObj.question || "Clarification needed");
  const rawOptions = Array.isArray(qObj.options) ? (qObj.options as Record<string, unknown>[]) : [];

  const options: QuestionOption[] = rawOptions.map((opt) => {
    const rawLabel = String(opt.label || opt.name || opt.value || "Option");
    let label = rawLabel;
    let description = typeof opt.description === "string" ? opt.description : undefined;

    // If label contains parentheses like "Priya Sharma (Manager)", extract description
    const match = rawLabel.match(/^(.+?)\s*\((.+?)\)$/);
    if (match && !description) {
      label = match[1].trim();
      description = match[2].trim();
    }

    // Compute matched readings count from target_group_ids if not already provided
    let matched = typeof opt.matched === "number" ? opt.matched : undefined;
    if (matched === undefined && Array.isArray(opt.target_group_ids)) {
      matched = (opt.target_group_ids as string[]).reduce((acc: number, gid: string) => {
        const found = groups.find((g) => g.id === gid);
        return acc + (found ? found.size : 0);
      }, 0);
    }

    const meta: string[] = Array.isArray(opt.meta)
      ? (opt.meta as string[])
      : opt.value && opt.value !== opt.id
      ? [String(opt.value)]
      : [];

    return {
      id: String(opt.id),
      label,
      description,
      meta: meta.length > 0 ? meta : undefined,
      matched: matched !== undefined && matched > 0 ? matched : undefined,
    };
  });

  return {
    id: String(qObj.id),
    text,
    options,
  };
}

/**
 * Normalizes backend error responses into SessionError.
 */
export function normalizeError(raw: unknown): SessionError {
  if (!raw) {
    return { code: "UNKNOWN_ERROR", message: "Request failed." };
  }
  if (typeof raw === "string") {
    return { code: "ERROR", message: raw };
  }
  const rawObj = raw as Record<string, unknown>;
  const errorObj = (rawObj.error && typeof rawObj.error === "object" ? rawObj.error : null) as Record<string, unknown> | null;
  const detailObj = (rawObj.detail && typeof rawObj.detail === "object" ? rawObj.detail : null) as Record<string, unknown> | null;

  const code =
    rawObj.code ||
    errorObj?.code ||
    detailObj?.code ||
    (rawObj.status ? `HTTP_${rawObj.status}` : "ERROR");

  const message =
    rawObj.message ||
    errorObj?.message ||
    detailObj?.message ||
    (typeof rawObj.detail === "string" ? rawObj.detail : "Request failed");

  return {
    code: String(code),
    message: String(message),
  };
}

/**
 * Normalizes any backend session response into a strict frontend Session.
 */
export function normalizeSession(raw: unknown): Session {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid session payload received from backend.");
  }
  const rawObj = raw as Record<string, unknown>;
  const decisionObj = (rawObj.decision && typeof rawObj.decision === "object" ? rawObj.decision : null) as Record<string, unknown> | null;

  const session_id = String(rawObj.session_id || rawObj.id || "sess-unknown");
  const request_text = String(rawObj.request_text || "");
  const status =
    rawObj.status === "asked" || rawObj.status === "completed" || rawObj.status === "failed"
      ? rawObj.status
      : decisionObj?.action === "ask"
      ? "asked"
      : "completed";

  // Raw groups from decision.groups or top-level groups
  const rawGroupsList =
    (decisionObj && Array.isArray(decisionObj.groups) && (decisionObj.groups as Record<string, unknown>[])) ||
    (Array.isArray(rawObj.groups) && (rawObj.groups as Record<string, unknown>[])) ||
    [];

  // Normalize groups
  let groups: OutcomeGroup[] = rawGroupsList.map((grp) => {
    const rawEffects = (grp.canonical_effects || grp.effects || []) as Record<string, unknown>[];
    const size =
      typeof grp.size === "number"
        ? grp.size
        : Array.isArray(grp.interpretation_ids)
        ? grp.interpretation_ids.length
        : typeof grp.mass === "number"
        ? Math.max(1, Math.round(grp.mass * (Array.isArray(rawObj.interpretations) ? rawObj.interpretations.length : 5)))
        : 1;

    return {
      id: String(grp.id),
      size,
      effects: rawEffects.map(normalizeEffect),
      label: typeof grp.label === "string" ? grp.label : `Outcome ${grp.id || ""}`.trim() || "Outcome",
    };
  });

  // Map interpretations
  const rawInterps = Array.isArray(rawObj.interpretations)
    ? (rawObj.interpretations as Record<string, unknown>[])
    : [];

  const interpretations = rawInterps.map((interp, idx: number) => {
    const id = String(interp.id || `interp-${idx + 1}`);
    const rationale = String(interp.rationale || "");
    const plan: PlanStep[] = (Array.isArray(interp.plan) ? interp.plan : []).map(
      (p) => {
        const pObj = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
        return {
          tool: String(pObj.tool || ""),
          args: (pObj.args && typeof pObj.args === "object" ? pObj.args : {}) as Record<string, unknown>,
        };
      }
    );

    // Group ID resolution
    let group_id = typeof interp.group_id === "string" ? interp.group_id : undefined;
    if (!group_id && typeof interp.signature === "string") {
      group_id = `grp-${interp.signature.slice(0, 10)}`;
    }

    // Effects for this interpretation: either from interp.effects or from the matching group
    let effects: Effect[] = [];
    if (Array.isArray(interp.effects) && interp.effects.length > 0) {
      effects = (interp.effects as Record<string, unknown>[]).map(normalizeEffect);
    } else if (group_id) {
      const matchGroup = groups.find((g) => g.id === group_id);
      if (matchGroup) {
        effects = matchGroup.effects;
      }
    }

    return {
      id,
      rationale,
      group_id: group_id || "grp-default",
      plan,
      effects,
    };
  });

  // If groups were missing, derive them in code by grouping interpretations with identical effect signatures
  if (groups.length === 0 && interpretations.length > 0) {
    const groupMap = new Map<string, { size: number; effects: Effect[] }>();
    for (const interp of interpretations) {
      const sigKey =
        interp.group_id !== "grp-default"
          ? interp.group_id
          : interp.effects.map((e) => `${e.summary}:${e.reversibility}`).join("|") ||
            interp.plan.map((p) => p.tool).join(";");
      const existing = groupMap.get(sigKey);
      if (existing) {
        existing.size += 1;
      } else {
        groupMap.set(sigKey, { size: 1, effects: interp.effects });
      }
    }

    groups = Array.from(groupMap.entries()).map(([gid, val], i) => ({
      id: gid.startsWith("grp-") ? gid : `grp-${i + 1}`,
      size: val.size,
      effects: val.effects,
      label: `Outcome ${i + 1}`,
    }));
  }

  // Decision normalization
  const expected_regret =
    typeof decisionObj?.expected_regret === "number"
      ? decisionObj.expected_regret
      : 0;
  const threshold =
    typeof decisionObj?.threshold === "number"
      ? decisionObj.threshold
      : typeof decisionObj?.tau === "number"
      ? decisionObj.tau
      : 0.25;

  const traceList = Array.isArray(rawObj.trace) ? (rawObj.trace as Record<string, unknown>[]) : [];
  const low_diversity = Boolean(
    decisionObj?.low_diversity ??
      traceList.some((t) => t.kind === "LOW_DIVERSITY_FALLBACK") ??
      (interpretations.length < 2)
  );

  const rawAction = decisionObj?.action;
  const action: DecisionAction =
    rawAction === "ask" || rawAction === "act"
      ? rawAction
      : status === "asked"
      ? "ask"
      : "act";

  const decision: Decision = {
    action,
    expected_regret,
    threshold,
    low_diversity,
  };

  // Question normalization
  const question = normalizeQuestion(rawObj.question, groups);

  // Result normalization
  const result = normalizeResult(rawObj.result);

  // Trace normalization
  const trace = traceList.map((tr, idx: number) => ({
    step: typeof tr.step === "number" ? tr.step : idx + 1,
    message: String(
      tr.message ||
      tr.kind ||
      (tr.payload ? JSON.stringify(tr.payload) : "Trace step")
    ),
  }));

  // Error normalization
  const error = rawObj.error ? normalizeError(rawObj.error) : null;

  // Proposer honesty detection
  let proposer: string | undefined = typeof rawObj.proposer === "string" ? rawObj.proposer : undefined;
  if (!proposer) {
    if (rawObj.llm_mode === "replay") {
      proposer = "Replay";
    } else if (
      low_diversity ||
      traceList.some((t) => t.kind === "LOW_DIVERSITY_FALLBACK")
    ) {
      proposer = "deterministic_mock";
    } else {
      proposer = "deterministic_mock"; // default backend mode is deterministic fallback
    }
  }

  return {
    session_id,
    request_text,
    status,
    decision,
    interpretations,
    groups,
    question,
    result,
    trace,
    error,
    _chosenGroupId: typeof decisionObj?.chosen_group_id === "string" ? decisionObj.chosen_group_id : undefined,
    proposer,
  };
}

/**
 * Normalizes backend benchmark summary response into BenchmarkSummary.
 */
export function normalizeBenchmark(raw: unknown): BenchmarkSummary {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid benchmark payload received from backend.");
  }
  const rawObj = raw as Record<string, unknown>;
  const metaObj = (rawObj.meta && typeof rawObj.meta === "object" ? rawObj.meta : null) as Record<string, unknown> | null;
  const metricsObj = (rawObj.metrics && typeof rawObj.metrics === "object" ? rawObj.metrics : null) as Record<string, unknown> | null;
  const baselinesObj = (rawObj.baselines && typeof rawObj.baselines === "object" ? rawObj.baselines : null) as Record<string, unknown> | null;

  const n_tasks = Number(rawObj.tasks_count || metaObj?.n_tasks || 24);
  const model = String(rawObj.execution_mode || metaObj?.model || "deterministic_mock");
  const date = String(rawObj.timestamp || metaObj?.date || new Date().toISOString());

  const policies: PolicyMetric[] = [];

  // 1. Sawal policy from raw.metrics
  if (metricsObj) {
    policies.push({
      name: "sawal",
      questions_per_task: Number(metricsObj.questions_per_task ?? 0.33),
      wrong_action_rate: Number(metricsObj.wrong_action_rate ?? 0.0),
      unnecessary_question_rate: Number(metricsObj.unnecessary_question_rate ?? 0.0),
      irreversible_error_rate: Number(metricsObj.irreversible_error_rate ?? 0.0),
    });
  }

  // 2. Baselines (ONLY policies that exist in raw.baselines)
  if (baselinesObj) {
    for (const [key, val] of Object.entries(baselinesObj)) {
      if (!val || typeof val !== "object") continue;
      const b = val as Record<string, unknown>;
      policies.push({
        name: key as PolicyName,
        questions_per_task: Number(b.questions_per_task ?? 0),
        wrong_action_rate: Number(b.wrong_action_rate ?? 0),
        unnecessary_question_rate: Number(b.unnecessary_question_rate ?? 0),
        irreversible_error_rate: Number(b.irreversible_error_rate ?? 0),
      });
    }
  }

  // 3. Tau sweep points
  const rawSweep = Array.isArray(rawObj.tau_sweep) ? (rawObj.tau_sweep as Record<string, unknown>[]) : [];
  const sweep: SweepPoint[] = rawSweep.map((pt) => ({
    tau: Number(pt.tau ?? 0),
    questions_per_task: Number(pt.questions_per_task ?? 0),
    wrong_action_rate: Number(pt.wrong_action_rate ?? 0),
  }));

  return {
    meta: {
      n_tasks,
      model,
      date,
    },
    policies,
    sweep,
    execution_mode: typeof rawObj.execution_mode === "string" ? rawObj.execution_mode : undefined,
    tasks_count: typeof rawObj.tasks_count === "number" ? rawObj.tasks_count : undefined,
    timestamp: typeof rawObj.timestamp === "string" ? rawObj.timestamp : undefined,
    note: typeof rawObj.note === "string" ? rawObj.note : undefined,
  };
}
