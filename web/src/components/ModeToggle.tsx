"use client";

import React from "react";
import { PlayCircle, Repeat } from "lucide-react";
import { LlmMode } from "@/lib/types";

interface ModeToggleProps {
  mode: LlmMode;
  onChange: (mode: LlmMode) => void;
  disabled?: boolean;
}

export function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="LLM Execution Mode"
      className="inline-flex items-center rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5 shadow-xs"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("live")}
        aria-pressed={mode === "live"}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 ${
          mode === "live"
            ? "bg-white dark:bg-neutral-900 text-indigo-700 dark:text-indigo-400 shadow-xs font-semibold"
            : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
        }`}
      >
        <PlayCircle className="w-3.5 h-3.5" />
        <span>Live</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("replay")}
        aria-pressed={mode === "replay"}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 ${
          mode === "replay"
            ? "bg-white dark:bg-neutral-900 text-indigo-700 dark:text-indigo-400 shadow-xs font-semibold"
            : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
        }`}
      >
        <Repeat className="w-3.5 h-3.5" />
        <span>Replay</span>
      </button>
    </div>
  );
}
