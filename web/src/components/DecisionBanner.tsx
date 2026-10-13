"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { Decision } from "@/lib/types";

interface DecisionBannerProps {
  decision: Decision;
  status: "completed" | "asked" | "failed";
  interpretationsCount?: number;
  groupsCount?: number;
}

export function DecisionBanner({
  decision,
  status,
  interpretationsCount = 5,
  groupsCount = 1,
}: DecisionBannerProps) {
  const isAct = decision.action === "act" || status === "completed";
  const regret = decision.expected_regret;
  const threshold = decision.threshold;

  // Derive the plain sentence of why
  let explanationSentence = "";
  if (isAct) {
    if (groupsCount <= 1 || regret < 0.05) {
      explanationSentence = `All ${interpretationsCount} readings lead to the same outcome.`;
    } else {
      explanationSentence = "Actions are safely reversible and expected regret is well below threshold.";
    }
  } else {
    explanationSentence = "Readings differ and a wrong guess can't be undone.";
  }

  // Calculate percentage widths for regret and threshold
  const regretPercent = Math.min(Math.max(regret * 100, 0), 100);
  const thresholdPercent = Math.min(Math.max(threshold * 100, 0), 100);

  return (
    <div
      role="region"
      aria-label="Sawal Decision Banner"
      className={`rounded-2xl border-2 p-4 sm:p-6 shadow-sm transition-all ${
        isAct
          ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40"
          : "border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Action badge & explanation */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`shrink-0 flex items-center justify-center px-4 py-2 rounded-xl font-black text-lg sm:text-xl tracking-wider uppercase shadow-xs ${
              isAct
                ? "bg-emerald-600 text-white"
                : "bg-amber-500 text-neutral-950"
            }`}
          >
            {isAct ? (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>ACT</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                <span>ASK</span>
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            <h3
              className={`text-base sm:text-lg font-bold leading-tight ${
                isAct
                  ? "text-emerald-950 dark:text-emerald-100"
                  : "text-amber-950 dark:text-amber-100"
              }`}
            >
              {explanationSentence}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
              {isAct
                ? "Execution proceeded automatically without interrupting user."
                : "Sawal halted autonomous execution to ask ONE targeted disambiguation question."}
            </p>
          </div>
        </div>

        {/* Right: Regret vs Threshold bar */}
        <div className="lg:w-80 xl:w-96 shrink-0 space-y-2 bg-white/70 dark:bg-neutral-900/60 p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-neutral-700 dark:text-neutral-300">
              Expected Regret:{" "}
              <span
                className={`font-mono font-bold ${
                  regret > threshold
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {regret.toFixed(2)}
              </span>
            </span>
            <span className="text-neutral-500 dark:text-neutral-400">
              Threshold (τ): <span className="font-mono">{threshold.toFixed(2)}</span>
            </span>
          </div>

          {/* Progress track */}
          <div className="relative h-3 w-full rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
            {/* Regret fill */}
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                regret > threshold
                  ? "bg-rose-500 dark:bg-rose-400"
                  : "bg-emerald-500 dark:bg-emerald-400"
              }`}
              style={{ width: `${regretPercent}%` }}
            />
            {/* Threshold indicator marker */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-neutral-900 dark:bg-white z-10 shadow-xs"
              style={{ left: `${thresholdPercent}%` }}
              title={`Threshold τ = ${threshold}`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
            <span>0.00 (Pure certainty)</span>
            <span>1.00 (Max loss)</span>
          </div>
        </div>
      </div>

      {decision.low_diversity && (
        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/60 flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Warning: Low candidate diversity detected across sandbox plans.</span>
        </div>
      )}
    </div>
  );
}
