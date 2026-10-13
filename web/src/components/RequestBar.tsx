"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, PenLine } from "lucide-react";

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
  activeChipText?: string;
}

export function RequestBar({
  onRun,
  isLoading,
  initialValue = "",
  activeChipText = "",
}: RequestBarProps) {
  const [inputText, setInputText] = useState(initialValue);
  const [prevInitial, setPrevInitial] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  if (initialValue !== prevInitial) {
    setPrevInitial(initialValue);
    setInputText(initialValue);
  }

  // Focus with '/' shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      {/* Input row */}
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <label htmlFor="sawal-request-input" className="sr-only">
          Natural language command
        </label>
        <div className="absolute left-4 text-[#6B665E] pointer-events-none">
          <PenLine className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <input
          id="sawal-request-input"
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Send an email to Priya confirming the lab slot..."
          disabled={isLoading}
          className="w-full rounded-[8px] border border-[#E8E2D8] bg-white pl-12 pr-28 py-3.5 text-base sm:text-lg text-[#1C1B19] placeholder-[#6B665E]/60 shadow-sawal-sm transition-all focus:border-[#17494D] focus:outline-none focus:ring-2 focus:ring-[#17494D]/20 disabled:opacity-70 font-sans"
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="absolute right-2 top-2 bottom-2 inline-flex items-center justify-center gap-1.5 px-5 font-semibold text-sm text-white bg-[#17494D] hover:bg-[#0F3639] disabled:bg-[#6B665E]/40 rounded-[6px] shadow-sawal-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#17494D] cursor-pointer disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <>
              <span>Run</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </>
          )}
        </button>
      </form>

      {/* Examples row */}
      <div className="flex flex-wrap items-baseline gap-2 pt-0.5 text-xs" aria-label="Example requests">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#6B665E] shrink-0 mr-1">
          EXAMPLES:
        </span>
        {EXAMPLE_CHIPS.map((chip, idx) => {
          const isSelected = activeChipText === chip || inputText.trim() === chip;
          return (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => handleChipClick(chip)}
              className={`inline-flex items-center gap-1.5 text-xs font-sans px-3 py-1.5 rounded-[8px] border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left ${
                isSelected
                  ? "bg-white text-[#17494D] border-[#17494D] font-medium shadow-sawal-sm ring-1 ring-[#17494D]/20"
                  : "bg-white text-[#1C1B19] border-[#E8E2D8] hover:border-[#6B665E] shadow-sawal-sm"
              }`}
            >
              {isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#17494D] shrink-0" />
              )}
              {/* Full text, no ellipsis, wraps onto two lines if needed */}
              <span className="leading-snug">{chip}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
