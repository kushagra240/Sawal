"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChatColumn } from "@/components/ChatColumn";
import { DebugPanel } from "@/components/DebugPanel";
import { EmptyState } from "@/components/EmptyState";
import { Footer } from "@/components/Footer";
import { ForkPanel } from "@/components/ForkPanel";
import { Header } from "@/components/Header";
import { ReadingsDetailsList } from "@/components/ReadingsDetailsList";
import { RegretRiskRuler } from "@/components/RegretRiskRuler";
import { SentenceLine } from "@/components/SentenceLine";
import { ShortcutsModal } from "@/components/ShortcutsModal";
import { WorldStrip } from "@/components/WorldStrip";
import { answerSession, createSession } from "@/lib/api";
import { useSessionContext } from "@/lib/sessionContext";
import { ChatTurn, LlmMode, Session } from "@/lib/types";

function MainContent() {
  const searchParams = useSearchParams();
  const showDebug = searchParams.get("debug") === "1";

  const {
    turns,
    activeTurnId,
    setActiveTurnId,
    addTurn,
    updateTurn,
    activeSession,
    setActiveSession,
    recordSession,
  } = useSessionContext();

  const [isLoading, setIsLoading] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [llmMode, setLlmMode] = useState<LlmMode>("live");
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Highlighting & selection synchronization between Chat options and Stage ForkPanel
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);
  const [selectedOptionGroupId, setSelectedOptionGroupId] = useState<string | null>(null);

  // Active turn on stage
  const currentActiveTurn =
    turns.find((t) => t.id === activeTurnId) ||
    (turns.length > 0 ? turns[turns.length - 1] : null);

  const displayedSession: Session | null =
    currentActiveTurn?.session || activeSession;

  // Global Keyboard shortcuts: P (presenter), ? (shortcuts), R (replay)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsOpen(true);
      } else if (e.key === "r" || e.key === "R") {
        if (displayedSession) {
          // Re-trigger animation
          const cur = displayedSession;
          setActiveSession(null);
          setTimeout(() => setActiveSession(cur), 50);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayedSession, setActiveSession]);

  const handleRunRequest = async (requestText: string) => {
    setIsLoading(true);
    setHighlightedGroupId(null);
    setSelectedOptionGroupId(null);

    const turnId = `turn-${Date.now()}`;
    const newTurn: ChatTurn = {
      id: turnId,
      requestText,
      session: null,
      isLoading: true,
      timestamp: Date.now(),
    };
    addTurn(newTurn);
    setActiveTurnId(turnId);

    try {
      const result = await createSession(requestText, llmMode);
      const isFailed = result.status === "failed" && result.error;

      updateTurn(turnId, {
        session: result,
        isLoading: false,
        errorMessage: isFailed ? result.error?.message : null,
      });

      setActiveSession(result);
      recordSession(result);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to execute rehearsal session.";
      updateTurn(turnId, {
        isLoading: false,
        errorMessage: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerQuestion = async (answer: {
    option_id?: string;
    free_text?: string;
  }) => {
    if (!displayedSession || !currentActiveTurn) return;
    setIsAnswering(true);

    try {
      const updated = await answerSession(displayedSession.session_id, answer);
      updateTurn(currentActiveTurn.id, {
        session: updated,
        answerText: answer.free_text || answer.option_id,
        errorMessage: null,
      });
      setActiveSession(updated);
      recordSession(updated);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit disambiguation answer.";
      updateTurn(currentActiveTurn.id, {
        errorMessage: msg,
      });
    } finally {
      setIsAnswering(false);
    }
  };

  const handleSwitchToReplay = () => {
    setLlmMode("replay");
    if (currentActiveTurn?.requestText) {
      handleRunRequest(currentActiveTurn.requestText);
    }
  };

  const handleSelectTurn = (turnId: string) => {
    setActiveTurnId(turnId);
    const target = turns.find((t) => t.id === turnId);
    if (target?.session) {
      setActiveSession(target.session);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Global Header */}
      <Header
        llmMode={llmMode}
        onModeChange={setLlmMode}
        disabled={isLoading || isAnswering}
      />

      {/* Main Two-Column Assistant Workspace */}
      <main className="max-w-[1920px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 flex-1">
        <div className="flex flex-col min-[1200px]:flex-row gap-6 items-start">
          {/* LEFT: Assistant Chat Column (400-440px wide at >=1280px, pinned composer at bottom) */}
          <div className="w-full min-[1200px]:w-[420px] 2xl:w-[450px] min-[1200px]:shrink-0 h-[640px] min-[1200px]:h-[calc(100vh-125px)] min-[1200px]:sticky min-[1200px]:top-[68px] overflow-hidden">
            <ChatColumn
              turns={turns}
              activeTurnId={currentActiveTurn?.id || null}
              onSelectTurn={handleSelectTurn}
              onSendMessage={handleRunRequest}
              onAnswerQuestion={handleAnswerQuestion}
              isLoading={isLoading}
              isAnswering={isAnswering}
              onOptionHover={setHighlightedGroupId}
              onOptionSelect={setSelectedOptionGroupId}
              onRetry={() => {
                if (currentActiveTurn?.requestText) {
                  handleRunRequest(currentActiveTurn.requestText);
                }
              }}
              onSwitchToReplay={handleSwitchToReplay}
            />
          </div>

          {/* RIGHT: Rehearsal Stage Column (Fills remaining width, responsive 1280 to 1920px) */}
          <div className="flex-1 min-w-0 w-full space-y-6">
            {/* If no session yet and not loading, show Empty Stage */}
            {!displayedSession && !isLoading && <EmptyState />}

            {/* Rehearsal Fork Panel */}
            {(isLoading || (displayedSession && displayedSession.interpretations.length > 0)) && (
              <ForkPanel
                session={displayedSession}
                isLoading={isLoading}
                selectedOptionGroupId={selectedOptionGroupId}
                highlightedGroupId={highlightedGroupId}
                onReplayRequest={() => {
                  if (displayedSession) {
                    const cur = displayedSession;
                    setActiveSession(null);
                    setTimeout(() => setActiveSession(cur), 50);
                  }
                }}
              />
            )}

            {/* Sentence Line with Fraunces italic & underlined accent phrase */}
            {!isLoading && displayedSession && displayedSession.decision && (
              <SentenceLine session={displayedSession} />
            )}

            {/* Risk Ruler & World Strip Row */}
            {!isLoading && displayedSession && displayedSession.decision && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left/Middle: World Strip (7 cols) */}
                <div className="lg:col-span-6 space-y-4">
                  <WorldStrip worldDiff={displayedSession.result?.world_diff || []} />
                </div>

                {/* Right: Regret & Risk Ruler (6 cols) */}
                <div className="lg:col-span-6">
                  <RegretRiskRuler session={displayedSession} />
                </div>
              </div>
            )}

            {/* Collapsible 'All readings (N)' Details List (Hidden in Presenter Mode) */}
            {!isLoading && displayedSession && displayedSession.interpretations.length > 0 && (
              <div className="hide-in-presenter">
                <ReadingsDetailsList
                  interpretations={displayedSession.interpretations}
                  highlightedGroupId={highlightedGroupId || selectedOptionGroupId}
                  onHoverReading={setHighlightedGroupId}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Global Footer (Hidden in Presenter Mode) */}
      <div className="hide-in-presenter">
        <Footer
          session={displayedSession}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
        />
      </div>

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Debug Panel (?debug=1) */}
      {showDebug && (
        <DebugPanel
          onLoadSession={(sess) => {
            if (!sess) {
              setActiveSession(null);
              return;
            }
            const turnId = `debug-${sess.session_id}`;
            addTurn({
              id: turnId,
              requestText: sess.request_text,
              session: sess,
              timestamp: 0,
            });
            setActiveSession(sess);
            recordSession(sess);
          }}
          onSetLoading={setIsLoading}
          onSetError={(msg) => {
            if (msg && currentActiveTurn) {
              updateTurn(currentActiveTurn.id, { errorMessage: msg });
            }
          }}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center font-mono text-xs text-[#6E6253]">
          Loading Sawal workspace...
        </div>
      }
    >
      <MainContent />
    </Suspense>
  );
}
