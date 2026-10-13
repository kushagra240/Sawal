"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  RotateCcw,
  Shield,
  Sparkles,
} from "lucide-react";
import { DecisionBanner } from "@/components/DecisionBanner";
import { EffectInspector } from "@/components/EffectInspector";
import { ModeToggle } from "@/components/ModeToggle";
import { PlanForks } from "@/components/PlanForks";
import { QuestionCard } from "@/components/QuestionCard";
import { RequestBar } from "@/components/RequestBar";
import { TraceDrawer } from "@/components/TraceDrawer";
import { answerSession, createSession } from "@/lib/api";
import { LlmMode, Session } from "@/lib/types";

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [llmMode, setLlmMode] = useState<LlmMode>("live");

  const handleRunRequest = async (requestText: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await createSession(requestText, llmMode);
      setSession(result);
      if (result.status === "failed" && result.error) {
        setErrorMessage(result.error.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute rehearsal session. Please check backend connection.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerQuestion = async (answer: {
    option_id?: string;
    free_text?: string;
  }) => {
    if (!session) return;
    setIsAnswering(true);
    setErrorMessage(null);
    try {
      const updated = await answerSession(session.session_id, answer);
      setSession(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit disambiguation answer.";
      setErrorMessage(msg);
    } finally {
      setIsAnswering(false);
    }
  };

  const handleSwitchToReplay = () => {
    setLlmMode("replay");
    setErrorMessage(null);
    if (session?.request_text) {
      handleRunRequest(session.request_text);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-950 dark:text-white">
                Sawal
              </span>
              <span className="text-base sm:text-lg font-normal text-indigo-600 dark:text-indigo-400 font-serif">
                सवाल
              </span>
            </div>
            <div className="hidden md:block h-5 w-px bg-neutral-300 dark:bg-neutral-700" />
            <p className="hidden md:block text-xs sm:text-sm font-medium text-neutral-600 dark:text-neutral-400 max-w-xl">
              Every AI assistant either guesses or nags.{" "}
              <strong className="text-neutral-900 dark:text-neutral-200 font-semibold">
                Sawal rehearses first.
              </strong>
            </p>
          </div>

          {/* Right Controls: Mode Toggle & Benchmark Nav */}
          <div className="flex items-center gap-3">
            <ModeToggle mode={llmMode} onChange={setLlmMode} disabled={isLoading} />
            <Link
              href="/benchmark"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              <span>Benchmark</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 flex-1">
        {/* Request Bar */}
        <section aria-label="Input command bar">
          <RequestBar
            onRun={handleRunRequest}
            isLoading={isLoading}
            initialValue={session?.request_text || ""}
          />
        </section>

        {/* Error State Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                  Execution Rehearsal Encountered an Error
                </h3>
                <p className="text-xs sm:text-sm text-rose-800 dark:text-rose-300 mt-0.5">
                  {errorMessage}
                </p>
              </div>
            </div>
            {llmMode === "live" && (
              <button
                type="button"
                onClick={handleSwitchToReplay}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs shrink-0 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Switch to Replay Mode</span>
              </button>
            )}
          </div>
        )}

        {/* Loading State or Interpretation Forks */}
        {(isLoading || (session && session.interpretations.length > 0)) && (
          <PlanForks
            isLoading={isLoading}
            interpretations={session?.interpretations || []}
            groups={session?.groups || []}
            lowDiversity={session?.decision.low_diversity}
          />
        )}

        {/* Decision Banner (visible once session decision is available) */}
        {!isLoading && session && session.decision && (
          <DecisionBanner
            decision={session.decision}
            status={session.status}
            interpretationsCount={session.interpretations.length}
            groupsCount={session.groups.length}
          />
        )}

        {/* Question Card (only displayed when status === 'asked') */}
        {!isLoading && session?.status === "asked" && session.question && (
          <QuestionCard
            question={session.question}
            onAnswer={handleAnswerQuestion}
            isAnswering={isAnswering}
          />
        )}

        {/* Effect Inspector (World diff when actions or disambiguation completed) */}
        {!isLoading && session?.result && (
          <EffectInspector result={session.result} />
        )}

        {/* Trace Drawer */}
        {!isLoading && session?.trace && session.trace.length > 0 && (
          <TraceDrawer trace={session.trace} />
        )}

        {/* Empty State (First visit) */}
        {!session && !isLoading && !errorMessage && (
          <section
            aria-label="Welcome and architecture summary"
            className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 p-6 sm:p-10 text-center space-y-8 shadow-xs"
          >
            <div className="max-w-2xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Interactive Rehearsal Harness</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-neutral-950 dark:text-white tracking-tight">
                No Guesswork. No Constant Interruptions.
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Choose any example chip above or type a natural language prompt. Sawal synthesizes
                candidate readings, executes them safely in a sandboxed runtime, clusters resultant
                world states, and decides whether acting autonomously risks irreversible regret.
              </p>
            </div>

            {/* 3 Step Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-4xl mx-auto">
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-neutral-900 dark:text-white">
                  <span className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-mono">
                    1
                  </span>
                  <span>Synthesize Readings</span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Branches 5 plausible interpretations from vague intents or entity references.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-neutral-900 dark:text-white">
                  <span className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-mono">
                    2
                  </span>
                  <span>Simulate World Diffs</span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Inspects effects for reversibility: Read only (safe), Reversible, or Irreversible.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-neutral-900 dark:text-white">
                  <span className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center text-xs font-mono">
                    3
                  </span>
                  <span>Act or 1 Question</span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  If expected regret &le; &tau;, acts immediately. Otherwise, asks ONE targeted question.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 py-3.5 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">Jugaad Labs</span>
            <span>•</span>
            <span>Sawal Assistant Harness</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
              <Shield className="w-3 h-3" />
              tau = 0.35
            </span>
          </div>
          <div>
            Built with Next.js App Router, Tailwind CSS, and Recharts.
          </div>
        </div>
      </footer>
    </div>
  );
}
