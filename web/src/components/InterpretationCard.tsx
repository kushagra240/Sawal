"use client";

import React from "react";
import { Terminal } from "lucide-react";
import { Interpretation } from "@/lib/types";
import { ReversibilityBadge } from "./ReversibilityBadge";

interface InterpretationCardProps {
  interpretation: Interpretation;
  index: number;
}

export function InterpretationCard({
  interpretation,
  index,
}: InterpretationCardProps) {
  return (
    <div className="flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-700/80 bg-surface dark:bg-neutral-900/90 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-600 transition-all">
      {/* Header: Reading # & rationale */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold">
            {index + 1}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Reading {index + 1}
          </span>
        </div>
      </div>

      {/* Rationale */}
      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 leading-snug">
        {interpretation.rationale}
      </p>

      {/* Plan steps as small tool chips */}
      {interpretation.plan.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            <Terminal className="w-3 h-3" />
            <span>Sandbox Plan Steps</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {interpretation.plan.map((step, sIdx) => {
              const argKeys = Object.keys(step.args || {});
              const argsSummary = argKeys.length > 0 ? `(${argKeys.join(", ")})` : "";
              return (
                <span
                  key={sIdx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700 font-mono text-[11px] text-neutral-800 dark:text-neutral-300"
                  title={JSON.stringify(step.args, null, 2)}
                >
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{step.tool}</span>
                  {argsSummary && (
                    <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">
                      {argsSummary}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Effects list with ReversibilityBadge */}
      {interpretation.effects.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
          <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Simulated Effects
          </div>
          <div className="space-y-1">
            {interpretation.effects.map((eff, eIdx) => (
              <div
                key={eIdx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-neutral-700 dark:text-neutral-300 bg-neutral-50/80 dark:bg-neutral-800/50 p-2 rounded-lg"
              >
                <span className="font-normal leading-tight">{eff.summary}</span>
                <div className="shrink-0">
                  <ReversibilityBadge reversibility={eff.reversibility} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
