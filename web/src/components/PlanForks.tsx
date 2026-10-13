"use client";

import React from "react";
import { AlertCircle, GitBranch, Layers, Sparkles } from "lucide-react";
import { Interpretation, OutcomeGroup } from "@/lib/types";
import { InterpretationCard } from "./InterpretationCard";

interface PlanForksProps {
  isLoading: boolean;
  interpretations: Interpretation[];
  groups: OutcomeGroup[];
  lowDiversity?: boolean;
}

export function PlanForks({
  isLoading,
  interpretations,
  groups,
  lowDiversity,
}: PlanForksProps) {
  if (isLoading) {
    return (
      <div className="w-full rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800/60 bg-indigo-50/30 dark:bg-indigo-950/20 p-6 sm:p-8 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-sm font-semibold animate-pulse">
          <Sparkles className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
          <span>Rehearsing 5 readings...</span>
        </div>

        {/* Subtle staggered skeleton animation */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 max-w-5xl mx-auto pt-2">
          {[0, 1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-white dark:bg-neutral-900 shadow-xs animate-pulse"
              style={{ animationDelay: `${idx * 160}ms`, animationDuration: "1.2s" }}
            >
              <div className="h-3 w-16 bg-indigo-200 dark:bg-indigo-800 rounded-md" />
              <div className="h-4 w-full bg-neutral-200 dark:bg-neutral-800 rounded-md mt-1" />
              <div className="h-4 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
              <div className="h-6 w-20 bg-indigo-100 dark:bg-indigo-900/40 rounded-md mt-2" />
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Simulating real world diffs in ephemeral sandbox to calculate expected regret
        </p>
      </div>
    );
  }

  if (interpretations.length === 0) {
    return null;
  }

  // Group interpretations by group_id
  const groupMap = new Map<string, Interpretation[]>();
  interpretations.forEach((item) => {
    const list = groupMap.get(item.group_id) || [];
    list.push(item);
    groupMap.set(item.group_id, list);
  });

  return (
    <section className="space-y-4" aria-label="Rehearsal interpretations panel">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
            Rehearsed Interpretations &amp; Outcome Clusters
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
            {interpretations.length} readings across {groupMap.size} {groupMap.size === 1 ? "cluster" : "clusters"}
          </span>
        </div>

        {lowDiversity && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Low Candidate Diversity: models may share assumptions</span>
          </div>
        )}
      </div>

      {/* Outcome Groups Container */}
      <div className="grid grid-cols-1 gap-6">
        {Array.from(groupMap.entries()).map(([groupId, items], gIdx) => {
          const groupMeta = groups.find((g) => g.id === groupId);
          const groupCount = groupMeta?.size ?? items.length;

          return (
            <div
              key={groupId}
              className="relative rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/60 bg-neutral-50/60 dark:bg-neutral-900/40 p-4 sm:p-5 shadow-xs transition-all"
            >
              {/* Group Ribbon / Join Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-indigo-100 dark:border-indigo-900/40">
                <div className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider shadow-xs">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Outcome Cluster {gIdx + 1}</span>
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    same outcome ×{groupCount}
                  </span>
                </div>

                <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  {items.length} {items.length === 1 ? "reading points" : "readings point"} to this identical world state
                </div>
              </div>

              {/* Connected cards grid inside group */}
              <div
                className={`grid grid-cols-1 ${
                  items.length >= 3
                    ? "md:grid-cols-3"
                    : items.length === 2
                    ? "md:grid-cols-2"
                    : "md:grid-cols-1"
                } gap-3 sm:gap-4`}
              >
                {items.map((interp, iIdx) => {
                  const globalIdx = interpretations.findIndex((it) => it.id === interp.id);
                  return (
                    <InterpretationCard
                      key={interp.id}
                      interpretation={interp}
                      index={globalIdx >= 0 ? globalIdx : iIdx}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
