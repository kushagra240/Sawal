"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, ListOrdered } from "lucide-react";
import { TraceStep } from "@/lib/types";

interface TraceDrawerProps {
  trace: TraceStep[];
}

export function TraceDrawer({ trace }: TraceDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!trace || trace.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-surface dark:bg-neutral-900 overflow-hidden shadow-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50/70 dark:bg-neutral-800/40 hover:bg-neutral-100/70 dark:hover:bg-neutral-800 text-left transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-neutral-500" />
          <span className="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Rehearsal &amp; Decision Trace
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
            {trace.length} {trace.length === 1 ? "step" : "steps"}
          </span>
        </div>
        <div className="text-neutral-500 flex items-center gap-1 text-xs">
          <span>{isOpen ? "Collapse" : "Expand"}</span>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/40 space-y-2">
          <ol className="relative border-l border-neutral-200 dark:border-neutral-700 ml-3 space-y-3">
            {trace.map((item, idx) => (
              <li key={idx} className="mb-2 ml-4">
                <div className="absolute w-2.5 h-2.5 bg-indigo-500 rounded-full -left-1.25 border border-white dark:border-neutral-900" />
                <div className="flex items-start gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                    Step {item.step}:
                  </span>
                  <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300">
                    {item.message}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
