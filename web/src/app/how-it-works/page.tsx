"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
} from "lucide-react";

export default function HowItWorksPage() {
  const repoUrl =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_REPO_URL
      : undefined;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DDD0BA] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#DDD0BA] bg-surface text-xs sm:text-sm font-semibold text-[#231B12] hover:border-[#17494D] transition-colors shadow-sawal-sm"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>Back to Assistant</span>
          </Link>
          <div className="h-5 w-px bg-[#DDD0BA]" />
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#17494D]" strokeWidth={1.5} />
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#231B12] tracking-tight">
              How Sawal Works
            </h1>
          </div>
        </div>

        <span className="text-xs font-mono text-[#6E6253]">
          Jugaad Labs Architecture Brief
        </span>
      </div>

      {/* 1. The Core Problem */}
      <section className="space-y-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#17494D] font-bold">
          01 · THE PROBLEM
        </span>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#231B12]">
          Every AI assistant either guesses or nags.
        </h2>
        <p className="text-sm sm:text-base text-[#6E6253] font-sans leading-relaxed">
          When given a vague natural language request like &ldquo;Send an email to Priya confirming the lab slot,&rdquo; existing AI assistants make one of two mistakes:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-[12px] bg-surface border border-[#DDD0BA] shadow-sawal-sm space-y-1.5">
            <h3 className="font-serif font-bold text-base text-[#A33A2B] flex items-center gap-1.5">
              <span>The Guesser (Silent Risk)</span>
            </h3>
            <p className="text-xs text-[#6E6253] leading-relaxed">
              Picks the highest-probability interpretation and executes immediately. If it guesses wrong, external email is sent to the wrong person with permanent consequence.
            </p>
          </div>

          <div className="p-4 rounded-[12px] bg-surface border border-[#DDD0BA] shadow-sawal-sm space-y-1.5">
            <h3 className="font-serif font-bold text-base text-[#8A5A0B] flex items-center gap-1.5">
              <span>The Nagger (Friction)</span>
            </h3>
            <p className="text-xs text-[#6E6253] leading-relaxed">
              Interrupts the user with questions for every vague request, even when all interpretations collapse to the exact same safe read-only operation.
            </p>
          </div>
        </div>
      </section>

      {/* 2. The Five Decision Steps in Plain Words */}
      <section className="space-y-4">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#17494D] font-bold">
          02 · THE FIVE DECISION STEPS
        </span>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#231B12]">
          Rehearse Before Acting.
        </h2>

        <div className="space-y-3 pt-2">
          {/* Step 1 */}
          <div className="p-4 rounded-[12px] bg-surface border border-[#DDD0BA] shadow-sawal-sm flex items-start gap-3.5">
            <span className="w-6 h-6 rounded-full bg-[#DCE9E6] text-[#17494D] font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <div className="space-y-1">
              <h3 className="font-sans font-bold text-sm text-[#231B12]">
                Synthesize Candidate Readings
              </h3>
              <p className="text-xs text-[#6E6253] leading-relaxed">
                Sample five plausible interpretations of the vague prompt, branching entity references, scope parameters, and user intent.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-[12px] bg-surface border border-[#DDD0BA] shadow-sawal-sm flex items-start gap-3.5">
            <span className="w-6 h-6 rounded-full bg-[#DCE9E6] text-[#17494D] font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <div className="space-y-1">
              <h3 className="font-sans font-bold text-sm text-[#231B12]">
                Rehearse in Ephemeral Sandbox
              </h3>
              <p className="text-xs text-[#6E6253] leading-relaxed">
                Run each candidate plan against an isolated sandbox runtime. No real emails are sent, no real databases are updated.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-[12px] bg-surface border border-[#DDD0BA] shadow-sawal-sm flex items-start gap-3.5">
            <span className="w-6 h-6 rounded-full bg-[#DCE9E6] text-[#17494D] font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <div className="space-y-1">
              <h3 className="font-sans font-bold text-sm text-[#231B12]">
                Cluster Resultant World Diffs
              </h3>
              <p className="text-xs text-[#6E6253] leading-relaxed">
                Collapse candidate executions into equivalent outcome clusters. Multiple different tool pathways that lead to identical external world states are joined together.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-[12px] bg-surface border border-[#DDD0BA] shadow-sawal-sm flex items-start gap-3.5">
            <span className="w-6 h-6 rounded-full bg-[#DCE9E6] text-[#17494D] font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              4
            </span>
            <div className="space-y-1">
              <h3 className="font-sans font-bold text-sm text-[#231B12]">
                Compute Expected Regret
              </h3>
              <p className="text-xs text-[#6E6253] leading-relaxed">
                Evaluate the loss of guessing wrong versus the cost of user interruption. Actions are weighted by reversibility: Read only (0 loss), Can be undone (low loss), and Can&apos;t be undone (high loss).
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="p-4 rounded-[12px] bg-surface border border-[#DDD0BA] shadow-sawal-sm flex items-start gap-3.5">
            <span className="w-6 h-6 rounded-full bg-[#17494D] text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              5
            </span>
            <div className="space-y-1">
              <h3 className="font-sans font-bold text-sm text-[#231B12]">
                Act or Ask ONE Targeted Question
              </h3>
              <p className="text-xs text-[#6E6253] leading-relaxed">
                If expected regret &le; threshold &tau;, execute autonomously without bugging the user. If regret exceeds &tau;, pause execution and ask exactly ONE clarifying question.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Canned ForkMap Architecture Diagram */}
      <section className="space-y-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#17494D] font-bold">
          03 · FORK MAP ARCHITECTURE
        </span>
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#231B12]">
          Visual Forking &amp; Outcome Collapsing
        </h2>

        <div className="p-6 rounded-[12px] bg-surface border border-[#DDD0BA] shadow-sawal-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#6E6253]">
            <div className="p-3 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-center w-full sm:w-44">
              <span className="block font-bold text-[#231B12]">Vague Request</span>
              <span className="text-[10px]">Natural language input</span>
            </div>

            <div className="text-[#17494D] font-bold text-center">
              &rarr; 5 Parallel Readings &rarr;
            </div>

            <div className="p-3 rounded-[8px] bg-[#DCE9E6] border border-[#17494D]/30 text-center w-full sm:w-44 text-[#17494D]">
              <span className="block font-bold">Sandbox Fork</span>
              <span className="text-[10px]">Zero real-world mutation</span>
            </div>

            <div className="text-[#17494D] font-bold text-center">
              &rarr; Regret Evaluator &rarr;
            </div>

            <div className="p-3 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-center w-full sm:w-44">
              <span className="block font-bold text-[#231B12]">ACT or 1 ASK</span>
              <span className="text-[10px]">&tau; threshold gate</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. What is Real and What is Mocked */}
      <section className="space-y-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#17494D] font-bold">
          04 · TRANSPARENCY &amp; INTEGRITY
        </span>
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#231B12]">
          What is Real and What is Mocked
        </h2>
        <div className="p-5 rounded-[12px] bg-surface border border-[#DDD0BA] shadow-sawal-sm space-y-3 text-xs sm:text-sm text-[#6E6253] font-sans leading-relaxed">
          <p>
            <strong className="text-[#231B12]">Mock Tools &amp; Local Simulator:</strong> When running in mock mode (<code>NEXT_PUBLIC_USE_MOCK=true</code>), Sawal simulates realistic calendar, address book, and mail server bindings with synthetic latency (800–1200ms) to model real-world tool execution.
          </p>
          <p>
            <strong className="text-[#231B12]">Live Backend Mode:</strong> When attached to the Python FastAPI backend on port 8000, Sawal dispatches live rehearsal plans through sandboxed Docker or in-memory execution runners.
          </p>
          <p>
            <strong className="text-[#231B12]">Benchmark Numbers:</strong> Benchmark curves displayed under <code>?sample=1</code> are explicitly labeled placeholders to demonstrate the Pareto evaluation UI. Real benchmarks require running the Python evaluation harness against test datasets.
          </p>
        </div>
      </section>

      {/* 5. Open Source & Credits */}
      <section className="space-y-3 border-t border-[#DDD0BA] pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-lg text-[#231B12]">
              Built by Jugaad Labs
            </h3>
            <p className="text-xs text-[#6E6253]">
              Released under the Apache-2.0 License. Designed for open-weight foundation models.
            </p>
          </div>

          {repoUrl && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] bg-[#17494D] text-white text-xs font-semibold hover:bg-[#0F3639] transition-colors"
            >
              <span>GitHub Repository</span>
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
