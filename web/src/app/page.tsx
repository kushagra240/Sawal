"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CompletedCard } from "@/components/CompletedCard";
import { DebugPanel } from "@/components/DebugPanel";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Footer } from "@/components/Footer";
import { ForkPanel } from "@/components/ForkPanel";
import { Header } from "@/components/Header";
import { QuestionNote } from "@/components/QuestionNote";
import { ReadingsDetailsList } from "@/components/ReadingsDetailsList";
import { RegretRiskRuler } from "@/components/RegretRiskRuler";
import { RequestBar } from "@/components/RequestBar";
import { SentenceLine } from "@/components/SentenceLine";
import { ShortcutsModal } from "@/components/ShortcutsModal";
import { answerSession, createSession } from "@/lib/api";
import { useSessionContext } from "@/lib/sessionContext";
import { LlmMode, Session } from "@/lib/types";

function MainContent() {
  const searchParams = useSearchParams();
  const showDebug = searchParams.get("debug") === "1";

  const { activeSession, setActiveSession, recordSession } = useSessionContext();

  const [session, setSession] = useState<Session | null>(activeSession);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [llmMode, setLlmMode] = useState<LlmMode>("live");
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Highlighting & selection synchronization across columns
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);
  const [selectedOptionGroupId, setSelectedOptionGroupId] = useState<string | null>(null);

  // Sync active session from context if present
  const [prevActive, setPrevActive] = useState<Session | null>(activeSession);
  if (activeSession !== prevActive) {
    setPrevActive(activeSession);
    setSession(activeSession);
  }

  // Keyboard shortcut listener: P, ?, R
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;

      if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsOpen(true);
      } else if (e.key === "r" || e.key === "R") {
        if (session) {
          // Re-trigger animation
          const current = session;
          setSession(null);
          setTimeout(() => setSession(current), 50);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [session]);

  const handleRunRequest = async (requestText: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setHighlightedGroupId(null);
    setSelectedOptionGroupId(null);

    try {
      const result = await createSession(requestText, llmMode);
      setSession(result);
      setActiveSession(result);
      recordSession(result);

      if (result.status === "failed" && result.error) {
        setErrorMessage(result.error.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute rehearsal session.";
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
      setActiveSession(updated);
      recordSession(updated);
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

  // Map option IDs to corresponding group IDs
  const optionGroupMap: Record<string, string> = {
    "opt-sharma": "grp-sharma",
    "opt-kulkarni": "grp-kulkarni",
    "opt-audi": "grp-audi",
    "opt-old": "grp-old",
    "opt-div-1": "grp-div-1",
    "opt-div-2": "grp-div-2",
  };

  const hasIrreversibleInGroup = (groupId: string): boolean => {
    const group = session?.groups.find((g) => g.id === groupId);
    return group
      ? group.effects.some((e) => e.reversibility === "irreversible")
      : true;
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Global Header */}
      <Header
        llmMode={llmMode}
        onModeChange={setLlmMode}
        disabled={isLoading || isAnswering}
      />

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 flex-1">
        {/* 1. Request Bar */}
        <section aria-label="Command bar">
          <RequestBar
            onRun={handleRunRequest}
            isLoading={isLoading}
            initialValue={session?.request_text || ""}
            activeChipText={session?.request_text || ""}
          />
        </section>

        {/* 2. Error State */}
        {errorMessage && (
          <ErrorState
            message={errorMessage}
            onRetry={() => session?.request_text && handleRunRequest(session.request_text)}
            onSwitchToReplay={handleSwitchToReplay}
          />
        )}

        {/* 3. Empty State (Initial Visit) */}
        {!session && !isLoading && !errorMessage && <EmptyState />}

        {/* 4. FORK PANEL (In-flight rehearsal or loaded) */}
        {(isLoading || (session && session.interpretations.length > 0)) && (
          <ForkPanel
            session={session}
            isLoading={isLoading}
            selectedOptionGroupId={selectedOptionGroupId}
            highlightedGroupId={highlightedGroupId}
            onReplayRequest={() => {
              if (session) {
                const cur = session;
                setSession(null);
                setTimeout(() => setSession(cur), 50);
              }
            }}
          />
        )}

        {/* 5. Sentence Line (Fraunces italic with underlined accent phrase) */}
        {!isLoading && session && session.decision && (
          <SentenceLine session={session} />
        )}

        {/* 6. Two Columns (Left: QuestionNote / CompletedCard, Right: RegretRiskRuler) */}
        {!isLoading && session && session.decision && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: State Dependent (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              {session.status === "asked" && session.question ? (
                <QuestionNote
                  question={session.question}
                  isAnswering={isAnswering}
                  onAnswer={handleAnswerQuestion}
                  onOptionHover={setHighlightedGroupId}
                  onOptionSelect={setSelectedOptionGroupId}
                  optionGroupMap={optionGroupMap}
                  hasIrreversibleInGroup={hasIrreversibleInGroup}
                />
              ) : (
                <CompletedCard
                  status={session.status}
                  action={session.decision.action}
                  result={session.result}
                  groups={session.groups}
                  isCommittedAnswer={Boolean(session._chosenGroupId)}
                />
              )}
            </div>

            {/* RIGHT COLUMN: Regret & Risk Ruler (5 Cols) */}
            <div className="lg:col-span-5">
              <RegretRiskRuler session={session} />
            </div>
          </div>
        )}

        {/* 7. Collapsible "All readings (N)" Details List */}
        {!isLoading && session && session.interpretations.length > 0 && (
          <ReadingsDetailsList
            interpretations={session.interpretations}
            highlightedGroupId={highlightedGroupId || selectedOptionGroupId}
            onHoverReading={setHighlightedGroupId}
          />
        )}
      </main>

      {/* Global Footer */}
      <Footer
        session={session}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Debug Panel (when ?debug=1 is active) */}
      {showDebug && (
        <DebugPanel
          onLoadSession={(sess) => {
            setSession(sess);
            setActiveSession(sess);
            if (sess) recordSession(sess);
          }}
          onSetLoading={setIsLoading}
          onSetError={setErrorMessage}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-mono text-[#6B665E]">Loading Sawal...</div>}>
      <MainContent />
    </Suspense>
  );
}
