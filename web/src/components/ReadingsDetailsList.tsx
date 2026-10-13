"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Terminal } from "lucide-react";
import { Interpretation } from "@/lib/types";
import { ReversibilityBadge } from "./ReversibilityBadge";

interface ReadingsDetailsListProps {
  interpretations: Interpretation[];
  highlightedGroupId?: string | null;
  onHoverReading?: (groupId: string | null) => void;
}

export function ReadingsDetailsList({
  interpretations,
  highlightedGroupId,
  onHoverReading,
}: ReadingsDetailsListProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!interpretations || interpretations.length === 0) return null;

  return (
    <div className="rounded-[12px] border border-[#E8E2D8] bg-white overflow-hidden shadow-sawal-sm hide-in-presenter">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-[#FBF8F3] hover:bg-[#F4EFE7] text-left transition-colors cursor-pointer border-b border-[#E8E2D8]"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider font-bold text-[#1C1B19]">
            All readings ({interpretations.length})
          </span>
          <span className="text-[11px] font-mono text-[#6B665E]">
            · Complete sandbox execution traces
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-[#6B665E]">
          <span>{isOpen ? "Collapse" : "Expand"}</span>
          {isOpen ? (
            <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
          ) : (
            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          )}
        </div>
      </button>

      {/* Expanded list */}
      {isOpen && (
        <div className="p-4 sm:p-5 space-y-3 bg-white">
          {interpretations.map((interp, idx) => {
            const isHighlighted = highlightedGroupId === interp.group_id;

            return (
              <div
                key={interp.id}
                onMouseEnter={() => onHoverReading && onHoverReading(interp.group_id)}
                onMouseLeave={() => onHoverReading && onHoverReading(null)}
                className={`p-4 rounded-[8px] border transition-all ${
                  isHighlighted
                    ? "border-[#17494D] bg-[#FBF8F3] ring-1 ring-[#17494D]"
                    : "border-[#E8E2D8] bg-[#FBF8F3]/40 hover:bg-[#FBF8F3]"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-[4px] bg-[#E8E2D8] font-mono text-[11px] font-bold text-[#1C1B19]">
                      Reading {idx + 1}
                    </span>
                    <span className="text-[11px] font-mono text-[#6B665E]">
                      Cluster: {interp.group_id}
                    </span>
                  </div>
                </div>

                {/* Rationale */}
                <p className="text-xs sm:text-sm font-sans text-[#1C1B19] mb-3">
                  {interp.rationale}
                </p>

                {/* Plan chips */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-mono uppercase text-[#6B665E] mr-1 flex items-center gap-1">
                    <Terminal className="w-3 h-3" strokeWidth={1.5} />
                    <span>Plan:</span>
                  </span>
                  {interp.plan.map((step, sIdx) => (
                    <span
                      key={sIdx}
                      className="px-2 py-0.5 rounded-[4px] bg-white border border-[#E8E2D8] font-mono text-[10px] text-[#1C1B19]"
                    >
                      {step.tool}
                    </span>
                  ))}
                </div>

                {/* Effects */}
                <div className="space-y-1 pt-2 border-t border-[#E8E2D8]/60">
                  {interp.effects.map((eff, eIdx) => (
                    <div
                      key={eIdx}
                      className="flex items-center justify-between text-xs text-[#6B665E]"
                    >
                      <span className="truncate max-w-md">{eff.summary}</span>
                      <ReversibilityBadge reversibility={eff.reversibility} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
