"use client";

import React, { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

export const EXAMPLE_CHIPS = [
  "Check my calendar for tomorrow afternoon.",
  "Find a quiet spot for team lunch near campus.",
  "Send an email to Priya confirming the lab slot.",
  "Draft a note to the study group and log forty rupees for tea.",
  "Book the seminar hall for a group meeting.",
] as const;

interface RequestBarProps {
  onRun: (text: string) => void;
  isLoading: boolean;
  initialValue?: string;
}

export function RequestBar({ onRun, isLoading, initialValue = "" }: RequestBarProps) {
  const [inputText, setInputText] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onRun(inputText.trim());
  };

  const handleChipClick = (chip: string) => {
    if (isLoading) return;
    setInputText(chip);
    onRun(chip);
  };

  return (
    <div className="w-full space-y-3">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <label htmlFor="sawal-request-input" className="sr-only">
          Natural language command or request
        </label>
        <input
          id="sawal-request-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Give Sawal a vague or high-stakes request..."
          disabled={isLoading}
          className="w-full rounded-xl border-2 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3.5 pr-28 text-base sm:text-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 shadow-sm transition-all focus:border-indigo-600 dark:focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-70"
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="absolute right-2 top-2 bottom-2 inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 font-semibold text-sm sm:text-base text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-neutral-400 dark:disabled:bg-neutral-700 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">Rehearsing...</span>
            </>
          ) : (
            <>
              <span>Run</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* 5 Clickable example chips */}
      <div className="flex flex-wrap items-center gap-2 pt-1" aria-label="Example requests">
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Try:</span>
        </span>
        {EXAMPLE_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isLoading}
            onClick={() => handleChipClick(chip)}
            className="group inline-flex items-center text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 hover:bg-white dark:bg-neutral-800/80 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <span className="truncate max-w-[280px] sm:max-w-none">{chip}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
