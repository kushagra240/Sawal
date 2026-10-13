"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Reversibility, Session } from "@/lib/types";
import { ReversibilityBadge } from "./ReversibilityBadge";

interface ForkPanelProps {
  session: Session | null;
  isLoading: boolean;
  selectedOptionGroupId?: string | null;
  highlightedGroupId?: string | null;
  onReplayRequest?: () => void;
}

export function ForkPanel({
  session,
  isLoading,
  selectedOptionGroupId,
  highlightedGroupId,
  onReplayRequest,
}: ForkPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1100, height: 380 });
  const [drawnCount, setDrawnCount] = useState(0);
  const componentId = useId();

  const interpretations = useMemo(
    () => session?.interpretations || [],
    [session?.interpretations]
  );
  const groups = useMemo(
    () => session?.groups || [],
    [session?.groups]
  );
  const totalReadings = interpretations.length;
  const isSingleGroup = groups.length === 1;
  const isCommitted = session?.status === "completed" && session?.result !== null;

  // Track size of container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height: Math.max(height, 360) });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Reveal animation: Staggered 90ms, counts k of N drawn
  useEffect(() => {
    if (isLoading || totalReadings === 0) return;

    let count = 0;
    const interval = setInterval(() => {
      count += 1;
      setDrawnCount(count);
      if (count >= totalReadings) {
        clearInterval(interval);
      }
    }, 90);

    return () => clearInterval(interval);
  }, [isLoading, totalReadings, session?.session_id]);

  // Compute guess error risk
  const guessGroup = groups.find((g) => g.id === interpretations[0]?.group_id) || groups[0];
  const guessGroupSize = guessGroup?.size || 1;
  const errorRiskPercent = totalReadings > 0
    ? Math.round(100 * (1 - guessGroupSize / totalReadings))
    : 0;

  // Active target group to highlight (from option hover or selection)
  const activeGroupId = highlightedGroupId || selectedOptionGroupId;

  // Compute station chips for each interpretation (up to 2 tools)
  const interpretationThreads = useMemo(() => {
    return interpretations.map((interp, idx) => {
      const tools = interp.plan.slice(0, 2).map((p) => p.tool);
      return {
        ...interp,
        index: idx,
        tools,
      };
    });
  }, [interpretations]);

  // Geometric layout anchor points based on dimensions
  const layout = useMemo(() => {
    const W = dimensions.width;
    const H = dimensions.height;

    // Slip on left: 24px from left, 260px wide, centered vertically
    const slipX = 24;
    const slipW = 260;
    const slipY = Math.max(70, H / 2 - 75);
    const slipH = 150;
    const slipAnchor = { x: slipX + slipW, y: slipY + slipH / 2 };

    // Fork/Merge node: centered horizontally between slip and destination cards
    const forkX = Math.round(slipAnchor.x + (W - slipAnchor.x - 300) * 0.48);
    const forkY = Math.round(H / 2);

    // Destination cards on right: 280px wide
    const cardW = Math.min(290, W * 0.28);
    const cardX = W - cardW - 24;

    const numGroups = Math.max(groups.length, 1);
    const spacing = H / (numGroups + 1);
    const groupAnchors = groups.map((g, idx) => {
      const y = Math.round((idx + 1) * spacing);
      return {
        group: g,
        anchor: { x: cardX, y },
      };
    });

    return {
      slipX,
      slipY,
      slipW,
      slipH,
      slipAnchor,
      forkX,
      forkY,
      cardX,
      cardW,
      groupAnchors,
    };
  }, [dimensions, groups]);

  return (
    <section
      ref={containerRef}
      className="relative w-full rounded-[12px] border border-[#DDD0BA] bg-surface shadow-sawal-sm overflow-hidden"
      aria-label="Rehearsal Fork Panel"
    >
      {/* Background Dotted Grid */}
      <div className="absolute inset-0 bg-dotted-grid pointer-events-none opacity-80" />

      {/* Top Status Strip */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-[#DDD0BA] bg-surface/90 backdrop-blur-xs text-xs font-mono">
        {/* Left Status: Loading vs Rehearsed */}
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-[#8A5A0B] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#8A5A0B] animate-pulse" />
              <span>REHEARSING FIVE READINGS...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#231B12] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#17494D]" />
              <span>{totalReadings} READINGS REHEARSED</span>
            </div>
          )}
        </div>

        {/* Right Status Chips */}
        <div className="flex items-center gap-2">
          {!isLoading && totalReadings > 0 && (
            <>
              {/* Readings & Outcomes Forked Pill */}
              <span className="px-2.5 py-1 rounded-[6px] bg-[#EBDFCB] border border-[#DDD0BA] text-[#231B12] font-medium text-[11px]">
                {totalReadings} READINGS · {groups.length}{" "}
                {groups.length === 1 ? "OUTCOME" : "OUTCOMES FORKED"}
              </span>

              {/* k of N drawn indicator */}
              <span className="px-2.5 py-1 rounded-[6px] bg-[#DCE9E6] border border-[#17494D]/20 text-[#17494D] font-semibold text-[11px]">
                {drawnCount} OF {totalReadings} DRAWN
              </span>

              {session?.decision?.low_diversity && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#FBF1DC] border border-[#8A5A0B]/30 text-[#8A5A0B] font-bold text-[11px]">
                  <AlertCircle className="w-3 h-3" strokeWidth={1.5} />
                  <span>LOW DIVERSITY</span>
                </span>
              )}

              {/* Replay Button */}
              {onReplayRequest && (
                <button
                  type="button"
                  onClick={onReplayRequest}
                  className="p-1 rounded-[6px] text-[#6E6253] hover:text-[#231B12] hover:bg-[#EBDFCB] transition-colors cursor-pointer"
                  title="Replay rehearsal animation (Key: R)"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Canvas Area: Minimum Height for Staged Rehearsal */}
      <div className="relative min-h-[360px] p-4 sm:p-6 select-none">
        {/* Loading In-Flight State: Looping dashed threads + slip */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="flex flex-col items-center gap-2 p-4 rounded-[12px] bg-surface/95 border border-[#DDD0BA] shadow-sawal-md">
              <span className="w-3 h-3 rounded-full bg-[#17494D] animate-ping" />
              <span className="text-xs font-mono uppercase tracking-wider text-[#17494D] font-bold">
                Rehearsing parallel sandboxes...
              </span>
            </div>
          </div>
        )}

        {/* ZONE 1: Request Slip */}
        <div
          className="absolute z-10 w-[260px] rounded-[12px] bg-[#F4EBDD] border border-[#DDD0BA] p-4 shadow-sawal-sm transition-all"
          style={{
            left: `${layout.slipX}px`,
            top: `${layout.slipY}px`,
          }}
        >
          {/* Origin Tab */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-[#DCE9E6] text-[#17494D] font-bold">
              ORIGIN
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6E6253]">
              REQUEST SLIP
            </span>
          </div>

          {/* Request Text in Fraunces */}
          <p className="text-sm sm:text-base font-serif font-bold text-[#231B12] leading-snug">
            {session?.request_text || "Send an email to Priya confirming the lab slot."}
          </p>

          {/* Ambiguity Footer */}
          <div className="mt-4 pt-2 border-t border-[#DDD0BA] flex items-center justify-between text-[11px] font-mono text-[#6E6253]">
            <span>
              ambiguity: {groups.length} {groups.length === 1 ? "outcome" : "outcomes"}
            </span>
            {/* Amber bookmark dot */}
            <span className="w-2 h-2 rounded-full bg-[#8A5A0B]" title="Origin bookmark" />
          </div>
        </div>

        {/* SVG Threads Overlay */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          style={{ width: "100%", height: "100%" }}
        >
          <defs>
            <linearGradient id={`${componentId}-thread-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#231B12" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#231B12" stopOpacity="0.65" />
            </linearGradient>
          </defs>

          {/* 1. Ghost Thread: Dashed arc from slip to first group's destination */}
          {layout.groupAnchors[0] && (session?.status === "asked" || isCommitted) && (
            <g className="transition-opacity duration-300">
              <path
                d={`M ${layout.slipAnchor.x} ${layout.slipAnchor.y - 20} C ${
                  layout.slipAnchor.x + (layout.cardX - layout.slipAnchor.x) * 0.35
                } ${Math.min(layout.slipAnchor.y - 80, 40)}, ${
                  layout.cardX - (layout.cardX - layout.slipAnchor.x) * 0.35
                } ${Math.min(layout.groupAnchors[0].anchor.y - 40, 60)}, ${
                  layout.cardX
                } ${layout.groupAnchors[0].anchor.y}`}
                fill="none"
                stroke="#6E6253"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.55"
              />
            </g>
          )}

          {/* 2. Reading Threads: From Slip to Fork/Merge Point */}
          {interpretationThreads.map((thread) => {
            const isDrawn = thread.index < drawnCount || drawnCount >= totalReadings;
            const belongsToActiveGroup = activeGroupId
              ? thread.group_id === activeGroupId
              : true;
            const opacity = activeGroupId && !belongsToActiveGroup ? 0.15 : 0.6;

            // Stagger starting Y offset from slip
            const spreadY = (thread.index - (totalReadings - 1) / 2) * 14;
            const startY = layout.slipAnchor.y + spreadY;

            const pathD = `M ${layout.slipAnchor.x} ${startY} C ${
              layout.slipAnchor.x + (layout.forkX - layout.slipAnchor.x) * 0.5
            } ${startY}, ${
              layout.forkX - (layout.forkX - layout.slipAnchor.x) * 0.5
            } ${layout.forkY}, ${layout.forkX} ${layout.forkY}`;

            return (
              <g key={thread.id} style={{ opacity, transition: "opacity 300ms ease" }}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={`url(#${componentId}-thread-grad)`}
                  strokeWidth="1.5"
                  strokeDasharray={isDrawn ? "none" : "300"}
                  strokeDashoffset={isDrawn ? "0" : "300"}
                  style={{
                    transition: "stroke-dashoffset 400ms ease-out",
                  }}
                />
              </g>
            );
          })}

          {/* 3. Fork Point to Destination Trunks */}
          {layout.groupAnchors.map(({ group, anchor }) => {
            const isGroupActive = activeGroupId ? group.id === activeGroupId : true;
            const isRuledOut = isCommitted && activeGroupId && group.id !== activeGroupId;
            const opacity = isRuledOut ? 0.15 : isGroupActive ? 0.85 : 0.25;

            // Trunk stroke width scales with group size (e.g., 3.5px for size 3, 2.5px for size 2)
            const trunkWidth = Math.min(6, 1.5 + group.size * 1.2);

            const trunkD = `M ${layout.forkX} ${layout.forkY} C ${
              layout.forkX + (anchor.x - layout.forkX) * 0.5
            } ${layout.forkY}, ${
              anchor.x - (anchor.x - layout.forkX) * 0.5
            } ${anchor.y}, ${anchor.x} ${anchor.y}`;

            return (
              <g key={group.id} style={{ opacity, transition: "opacity 300ms ease" }}>
                <path
                  d={trunkD}
                  fill="none"
                  stroke="#17494D"
                  strokeWidth={trunkWidth}
                />
              </g>
            );
          })}
        </svg>

        {/* Ghost Thread Label Pill (Centered along ghost curve) */}
        {layout.groupAnchors[0] && (session?.status === "asked" || isCommitted) && (
          <div
            className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${layout.slipAnchor.x + (layout.cardX - layout.slipAnchor.x) * 0.45}px`,
              top: `${Math.max(50, layout.slipAnchor.y - 65)}px`,
            }}
          >
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#EBDFCB] border border-[#DDD0BA] text-[10px] font-mono text-[#6E6253] shadow-sawal-sm">
              * If it had just guessed ({errorRiskPercent}% error risk)
            </span>
          </div>
        )}

        {/* Station Chips along threads: Tools on interpretations */}
        {interpretationThreads.map((thread) => {
          if (!thread.tools || thread.tools.length === 0) return null;
          const isDrawn = thread.index < drawnCount || drawnCount >= totalReadings;
          if (!isDrawn) return null;

          const spreadY = (thread.index - (totalReadings - 1) / 2) * 14;
          const startY = layout.slipAnchor.y + spreadY;

          // Position station chip at ~42% along Bezier curve
          const chipX = layout.slipAnchor.x + (layout.forkX - layout.slipAnchor.x) * 0.42;
          const chipY = startY + (layout.forkY - startY) * 0.45;

          const toolName = thread.tools[0] || "tool";

          return (
            <div
              key={`chip-${thread.id}`}
              className="absolute z-10 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-300"
              style={{
                left: `${chipX}px`,
                top: `${chipY}px`,
                opacity: activeGroupId && thread.group_id !== activeGroupId ? 0.2 : 1,
              }}
            >
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-surface border border-[#DDD0BA] text-[10px] font-mono text-[#231B12] shadow-sawal-sm">
                <span className="text-[#6E6253]">•</span>
                <span>{toolName}</span>
              </span>
            </div>
          );
        })}

        {/* Central Node: FORK POINT or MERGE POINT */}
        {totalReadings > 0 && (
          <div
            className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
            style={{
              left: `${layout.forkX}px`,
              top: `${layout.forkY}px`,
            }}
          >
            {/* Pulsing ring every 1.6s */}
            <div className="relative flex items-center justify-center">
              <span className="absolute w-5 h-5 rounded-full bg-[#17494D]/20 animate-ping" />
              <div className="w-3.5 h-3.5 rounded-full bg-[#17494D] border-2 border-white shadow-sawal-sm" />
            </div>

            <span className="px-1.5 py-0.5 rounded-[4px] bg-surface border border-[#DDD0BA] text-[9px] font-mono uppercase tracking-wider text-[#17494D] font-bold shadow-sawal-sm">
              {isSingleGroup ? "MERGE POINT" : "FORK POINT"}
            </span>
          </div>
        )}

        {/* ZONE 3: Destination Cards (one per outcome group) */}
        {layout.groupAnchors.map(({ group, anchor }, gIdx) => {
          const isGroupActive = activeGroupId ? group.id === activeGroupId : false;
          const isRuledOut = isCommitted && activeGroupId && group.id !== activeGroupId;

          const primaryEffect = group.effects[0];
          const reversibility: Reversibility = primaryEffect?.reversibility || "reversible";
          const isIrreversible = reversibility === "irreversible";

          return (
            <div
              key={group.id}
              className={`absolute z-10 rounded-[12px] p-3.5 sm:p-4 bg-surface border transition-all shadow-sawal-sm ${
                isGroupActive
                  ? "border-[#17494D] ring-2 ring-[#17494D]/20"
                  : "border-[#DDD0BA] hover:border-[#6E6253]"
              } ${isRuledOut ? "opacity-25" : "opacity-100"}`}
              style={{
                width: `${layout.cardW}px`,
                left: `${layout.cardX}px`,
                top: `${anchor.y - 65}px`,
              }}
            >
              {/* Header: Readings Pill + Reversibility Badge */}
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-[#EBDFCB] text-[#231B12] font-semibold">
                  • {group.size} readings
                </span>

                <ReversibilityBadge reversibility={reversibility} size="sm" />
              </div>

              {/* Title: Effect Summary */}
              <h4 className="text-xs sm:text-sm font-bold text-[#231B12] leading-snug line-clamp-2">
                {group.label || primaryEffect?.summary || `Outcome Cluster ${gIdx + 1}`}
              </h4>

              {/* Subtitle: Detail */}
              {primaryEffect?.detail && (
                <p className="text-[11px] text-[#6E6253] font-sans mt-1 leading-snug line-clamp-2">
                  {primaryEffect.detail}
                </p>
              )}

              {/* Bottom Tag */}
              <div className="mt-2.5 pt-2 border-t border-[#DDD0BA] flex items-center justify-between text-[10px] font-mono">
                <span className="text-[#6E6253]">
                  {isIrreversible ? (
                    <span className="text-[#A33A2B] font-bold">High impact</span>
                  ) : reversibility === "readonly" ? (
                    <span className="text-[#1F6B4A]">Read only</span>
                  ) : (
                    <span className="text-[#8A5A0B]">Undoable</span>
                  )}
                </span>

                {isRuledOut && (
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-[#EBDFCB] text-[#6E6253] uppercase font-bold text-[9px]">
                    ruled out
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
