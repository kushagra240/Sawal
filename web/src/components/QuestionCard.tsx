"use client";

import React, { useState } from "react";
import { ArrowRight, HelpCircle, Loader2, Send } from "lucide-react";
import { Question } from "@/lib/types";

interface QuestionCardProps {
  question: Question;
  onAnswer: (answer: { option_id?: string; free_text?: string }) => void;
  isAnswering: boolean;
}

export function QuestionCard({
  question,
  onAnswer,
  isAnswering,
}: QuestionCardProps) {
  const [customText, setCustomText] = useState("");

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim() || isAnswering) return;
    onAnswer({ free_text: customText.trim() });
  };

  return (
    <section
      role="dialog"
      aria-labelledby="question-heading"
      className="rounded-2xl border-2 border-indigo-500 bg-white dark:bg-neutral-900 p-5 sm:p-6 shadow-lg shadow-indigo-500/10 space-y-5 transition-all"
    >
      {/* Question Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 shrink-0 mt-0.5">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Disambiguation Needed • 1 Question Only
          </span>
          <h3
            id="question-heading"
            className="text-lg sm:text-xl font-bold text-neutral-950 dark:text-white leading-snug"
          >
            {question.text}
          </h3>
        </div>
      </div>

      {/* Option Chips */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Select intended target:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={isAnswering}
              onClick={() => onAnswer({ option_id: opt.id })}
              className="flex items-center justify-between p-3.5 rounded-xl border-2 border-neutral-200 dark:border-neutral-700/80 bg-neutral-50 dark:bg-neutral-800/60 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 hover:border-indigo-500 dark:hover:border-indigo-400 text-left transition-all group focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                {opt.label}
              </span>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>

      {/* Custom Answer Input */}
      <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
        <label
          htmlFor="custom-answer-input"
          className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2"
        >
          Or type your own answer:
        </label>
        <div className="relative flex items-center">
          <input
            id="custom-answer-input"
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Type specific details, person name, or custom preference..."
            disabled={isAnswering}
            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2.5 pr-24 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isAnswering || !customText.trim()}
            className="absolute right-1.5 top-1.5 bottom-1.5 inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
          >
            {isAnswering ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <span>Submit</span>
                <Send className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
