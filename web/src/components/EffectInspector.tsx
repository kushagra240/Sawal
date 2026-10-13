"use client";

import React from "react";
import { CheckCheck, Cpu, Database } from "lucide-react";
import { ExecutionResult } from "@/lib/types";
import { ReversibilityBadge } from "./ReversibilityBadge";

interface EffectInspectorProps {
  result: ExecutionResult | null;
}

export function EffectInspector({ result }: EffectInspectorProps) {
  if (!result || !result.world_diff || result.world_diff.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 sm:p-6 shadow-xs space-y-4"
      aria-label="World diff and effect inspector"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
            Effect Inspector: Applied World Diff
          </h3>
        </div>

        {result.executed_tools && result.executed_tools.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-semibold">Tools executed:</span>
            <div className="flex gap-1">
              {result.executed_tools.map((tool, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px] text-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 font-semibold"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* World diff table / rows */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-semibold text-[11px]">
              <th className="py-2.5 px-3">Entity Target</th>
              <th className="py-2.5 px-3">Op</th>
              <th className="py-2.5 px-3">Diff Summary</th>
              <th className="py-2.5 px-3 text-right">Reversibility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
            {result.world_diff.map((item, idx) => (
              <tr
                key={idx}
                className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors"
              >
                <td className="py-3 px-3 font-mono font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <CheckCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{item.entity}</span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-neutral-200/80 dark:bg-neutral-800 font-mono text-[10px] uppercase font-bold text-neutral-700 dark:text-neutral-300">
                    {item.op}
                  </span>
                </td>
                <td className="py-3 px-3 text-neutral-900 dark:text-neutral-100 font-medium">
                  {item.summary}
                </td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  <ReversibilityBadge reversibility={item.reversibility} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
