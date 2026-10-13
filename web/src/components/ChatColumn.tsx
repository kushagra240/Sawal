"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Cpu } from "lucide-react";
import { ChatTurn, Reversibility, Session } from "@/lib/types";
import { ChatComposer, EXAMPLE_PROMPTS } from "./ChatComposer";
import { QuestionNote } from "./QuestionNote";
import { ReversibilityBadge } from "./ReversibilityBadge";

interface ChatColumnProps {
  turns: ChatTurn[];
  activeTurnId: string | null;
  onSelectTurn: (turnId: string) => void;
  onSendMessage: (text: string) => void;
  onAnswerQuestion: (answer: { option_id?: string; free_text?: string }) => void;
  isLoading: boolean;
  isAnswering: boolean;
  onOptionHover: (groupId: string | null) => void;
  onOptionSelect: (groupId: string | null) => void;
  onRetry: () => void;
  onSwitchToReplay: () => void;
}

export function ChatColumn({
  turns,
  activeTurnId,
  onSelectTurn,
  onSendMessage,
  onAnswerQuestion,
  isLoading,
  isAnswering,
  onOptionHover,
  onOptionSelect,
  onRetry,
  onSwitchToReplay,
}: ChatColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat when new turn appears or loading changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns.length, isLoading]);

  // Find active turn to check if a question is currently pending
  const activeTurn = turns.find((t) => t.id === activeTurnId) || turns[turns.length - 1];
  const isQuestionPending =
    activeTurn?.session?.status === "asked" && Boolean(activeTurn?.session?.question);

  // Mapping options to outcome groups for question note
  const optionGroupMap: Record<string, string> = {
    "opt-sharma": "grp-sharma",
    "opt-kulkarni": "grp-kulkarni",
    "opt-audi": "grp-audi",
    "opt-old": "grp-old",
    "opt-div-1": "grp-div-1",
    "opt-div-2": "grp-div-2",
  };

  const hasIrreversibleInGroup = (session: Session, groupId: string): boolean => {
    const group = session.groups.find((g) => g.id === groupId);
    return group
      ? group.effects.some((e) => e.reversibility === "irreversible")
      : true;
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-[#DDD0BA] rounded-[12px] shadow-sawal-sm overflow-hidden">
      {/* Chat Header / Session indicator */}
      <div className="px-4 py-3 border-b border-[#DDD0BA] bg-sunken/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-devanagari font-bold text-base text-[#17494D]">
            सवाल
          </span>
          <span className="text-xs font-mono uppercase tracking-wider text-[#6E6253]">
            ASSISTANT CONVERSATION
          </span>
        </div>
        {turns.length > 0 && (
          <span
            suppressHydrationWarning
            className="text-[11px] font-mono text-[#6E6253] bg-surface px-2 py-0.5 rounded-[6px] border border-[#DDD0BA]"
          >
            {turns.length} {turns.length === 1 ? "turn" : "turns"}
          </span>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4"
        style={{ scrollBehavior: "smooth" }}
      >
        {/* 1. Greeting Message (always visible at top of conversation) */}
        <div className="space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#17494D] text-surface flex items-center justify-center font-devanagari text-xs font-bold shrink-0 shadow-sawal-sm">
              स
            </div>
            <div className="flex-1 min-w-0 bg-surface border border-[#DDD0BA] rounded-[12px] rounded-tl-[4px] p-4 shadow-sawal-sm space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-sm text-[#231B12]">
                    Sawal
                  </span>
                  <span className="text-[10px] font-mono text-[#6E6253]">
                    rehearsal engine
                  </span>
                </div>
                <p className="text-sm font-sans text-[#231B12] leading-relaxed">
                  Say something vague. I&apos;ll try every reading before I act.
                </p>
                <p className="text-xs text-[#6E6253] font-sans">
                  Your request stays in rehearsal until the outcome is clear.
                </p>
              </div>

              {/* 5 Example Chips directly in greeting */}
              <div className="pt-2 border-t border-[#DDD0BA]/70 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#6E6253] block">
                  QUICK EXAMPLES:
                </span>
                <div className="flex flex-col gap-1.5">
                  {EXAMPLE_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="text-left text-xs font-sans text-[#231B12] bg-[#F4EBDD] hover:bg-[#DCE9E6] hover:border-[#17494D]/30 border border-[#DDD0BA] rounded-[8px] px-3 py-2 transition-all shadow-sawal-sm leading-snug cursor-pointer disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. List of Turns */}
        {turns.map((turn) => {
          const isActive = turn.id === activeTurnId;
          const session = turn.session;

          return (
            <div
              key={turn.id}
              onClick={() => onSelectTurn(turn.id)}
              className={`space-y-3 cursor-pointer rounded-[8px] transition-all p-1.5 ${
                isActive
                  ? "ring-1 ring-[#17494D]/40 bg-[#F4EBDD]/30"
                  : "opacity-90 hover:opacity-100 hover:bg-[#F4EBDD]/15"
              }`}
            >
              {/* User Message Bubble */}
              <div className="flex justify-end">
                <div className="bg-[#DCE9E6] text-[#231B12] border border-[#17494D]/20 rounded-[14px] rounded-br-[4px] px-4 py-2.5 max-w-[88%] text-sm font-sans shadow-sawal-sm leading-relaxed">
                  {turn.requestText}
                </div>
              </div>

              {/* Sawal Rehearsing message */}
              {turn.isLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#17494D] text-surface flex items-center justify-center font-devanagari text-xs font-bold shrink-0">
                    स
                  </div>
                  <div className="bg-surface border border-[#DDD0BA] rounded-[12px] rounded-tl-[4px] px-4 py-3 shadow-sawal-sm flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#17494D] animate-ping" />
                    <span className="text-xs font-mono uppercase tracking-wider text-[#17494D] font-semibold">
                      Rehearsing five readings...
                    </span>
                    <span className="flex gap-1 ml-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#17494D]/60 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#17494D]/60 animate-bounce [animation-delay:0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#17494D]/60 animate-bounce [animation-delay:0.3s]" />
                    </span>
                  </div>
                </div>
              )}

              {/* Sawal Error message */}
              {turn.errorMessage && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#912D1F] text-surface flex items-center justify-center font-mono text-xs font-bold shrink-0">
                    !
                  </div>
                  <div className="bg-[#FBE9E5] border border-[#DDD0BA] rounded-[12px] rounded-tl-[4px] p-4 shadow-sawal-sm space-y-3 flex-1">
                    <div className="text-xs font-sans text-[#912D1F] font-medium">
                      {turn.errorMessage}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry();
                        }}
                        className="px-3 py-1.5 rounded-[6px] bg-[#912D1F] text-surface text-xs font-semibold hover:opacity-90"
                      >
                        Try again
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwitchToReplay();
                        }}
                        className="px-3 py-1.5 rounded-[6px] bg-surface border border-[#DDD0BA] text-[#231B12] text-xs font-medium hover:bg-sunken"
                      >
                        Switch to Replay
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sawal Decision / Question / Result */}
              {session && !turn.isLoading && (
                <div className="space-y-3">
                  {/* Active turn badge */}
                  {isActive && turns.length > 1 && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#17494D] pl-9">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#17494D]" />
                      <span>Showing on Rehearsal Stage</span>
                    </div>
                  )}

                  {/* Sawal, decision sentence message */}
                  {session.decision && (
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#17494D] text-surface flex items-center justify-center font-devanagari text-xs font-bold shrink-0 shadow-sawal-sm">
                        स
                      </div>
                      <div className="bg-surface border border-[#DDD0BA] rounded-[12px] rounded-tl-[4px] px-3.5 py-2.5 shadow-sawal-sm text-xs font-serif italic text-[#231B12] leading-relaxed">
                        {(() => {
                          const totalReadings = session.interpretations.length;
                          const numGroups = session.groups.length;
                          const isAct =
                            session.decision?.action === "act" || session.status === "completed";
                          const isPending = ["ready", "awaiting_confirmation", "executing"].includes(session.status);
                          const hasIrreversible = session.groups.some((g) =>
                            g.effects.some((e) => e.reversibility === "irreversible")
                          );

                          let prefix = "";
                          let underlined = "";

                          if (isPending) {
                            prefix = `${totalReadings} readings produced an exact live plan, `;
                            underlined = "so I'm waiting for confirmation.";
                          } else if (session.status === "cancelled") {
                            prefix = "You cancelled the proposed action, ";
                            underlined = "so nothing was executed.";
                          } else if (session.status === "failed") {
                            prefix = "The live provider returned an error, ";
                            underlined = "so I am not claiming success.";
                          } else if (isAct) {
                            if (numGroups <= 1) {
                              prefix = `All ${totalReadings} readings lead to the same outcome, `;
                              underlined = "so I'm acting.";
                            } else {
                              prefix = `${totalReadings} readings across ${numGroups} outcomes, but all effects can be undone, `;
                              underlined = "so I'm acting.";
                            }
                          } else {
                            if (hasIrreversible) {
                              prefix = `${totalReadings} readings, ${numGroups} different outcomes. One of them can't be undone, `;
                              underlined = "so I'm asking.";
                            } else {
                              prefix = `${totalReadings} readings, ${numGroups} different outcomes with divergent side effects, `;
                              underlined = "so I'm asking.";
                            }
                          }

                          return (
                            <span>
                              &ldquo;{prefix}
                              <span className="underline decoration-[#17494D] decoration-1.5 underline-offset-2 text-[#17494D] font-medium not-italic">
                                {underlined}
                              </span>
                              &rdquo;
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Question Note (if status === 'asked') */}
                  {session.status === "asked" && session.question ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <QuestionNote
                        question={session.question}
                        isAnswering={isAnswering}
                        onAnswer={onAnswerQuestion}
                        onOptionHover={onOptionHover}
                        onOptionSelect={onOptionSelect}
                        optionGroupMap={optionGroupMap}
                        hasIrreversibleInGroup={(gid) =>
                          hasIrreversibleInGroup(session, gid)
                        }
                      />
                    </div>
                  ) : (
                    /* Completed Result Card (if completed or act) */
                    session.result && (
                      <div className="flex items-start gap-2.5 min-w-0 max-w-full">
                        <div className="w-7 h-7 rounded-full bg-[#19583D] text-surface flex items-center justify-center font-mono text-xs font-bold shrink-0">
                          ✓
                        </div>
                        <div className="flex-1 min-w-0 max-w-full bg-surface border border-[#DDD0BA] rounded-[12px] rounded-tl-[4px] p-4 shadow-sawal-sm space-y-3">
                          {/* Header with Title and Stamp */}
                          <div className="flex items-start justify-between gap-2 border-b border-[#DDD0BA] pb-2.5">
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6E6253] block">
                                {session.decision?.action === "act" && !session._chosenGroupId
                                  ? "AUTONOMOUS ACT"
                                  : "COMMITTED ACTION"}
                              </span>
                              <h4 className="font-serif font-bold text-base text-[#231B12] truncate">
                                {session.decision?.action === "act" && !session._chosenGroupId
                                  ? "Acting Autonomously"
                                  : "Execution Completed"}
                              </h4>
                            </div>

                            {/* Thin double-ring stamp */}
                            <div
                              className="shrink-0 border-2 border-double border-[#17494D] px-2 py-0.5 rounded-[6px] font-mono font-bold tracking-wider text-[10px] text-[#17494D] -rotate-3 select-none"
                              style={{ borderWidth: "2.5px" }}
                            >
                              {session.decision?.action === "act" && !session._chosenGroupId
                                ? `SAME OUTCOME ×${session.groups[0]?.size || 5}`
                                : "COMMITTED"}
                            </div>
                          </div>

                          {/* Executed Tools */}
                          {session.result.executed_tools.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-mono uppercase text-[#6E6253]">
                                Tools:
                              </span>
                              {session.result.executed_tools.map((tool, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-sunken text-[#231B12] font-mono text-[11px]"
                                >
                                  <Cpu className="w-3 h-3 text-[#6E6253]" />
                                  <span>{tool}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* World Diff Rows */}
                          {session.result.world_diff.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              {session.result.world_diff.map((diff, dIdx) => (
                                <div
                                  key={dIdx}
                                  className="flex items-center justify-between gap-2 p-2 rounded-[6px] bg-[#F4EBDD]/60 border border-[#DDD0BA] text-xs min-w-0 max-w-full"
                                >
                                  <div className="min-w-0 flex-1 truncate text-[#231B12] font-sans">
                                    <span className="font-mono text-[10px] text-[#6E6253] mr-1">
                                      {diff.entity}:
                                    </span>
                                    <span>{diff.summary}</span>
                                  </div>
                                  <div className="shrink-0">
                                    <ReversibilityBadge
                                      reversibility={diff.reversibility as Reversibility}
                                      size="sm"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Link to /world */}
                          <div className="pt-1 flex justify-end">
                            <Link
                              href="/world"
                              className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#17494D] hover:underline"
                            >
                              <span>See in World</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Docked Chat Composer at Bottom */}
      <div className="shrink-0">
        <ChatComposer
          onSendMessage={onSendMessage}
          onSendAnswerText={(text) => onAnswerQuestion({ free_text: text })}
          isQuestionPending={isQuestionPending}
          isLoading={isLoading || isAnswering}
          disabled={isLoading || isAnswering}
        />
      </div>
    </div>
  );
}
