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
    <div className="rounded-[12px] border border-[#DDD0BA] bg-surface overflow-hidden shadow-sawal-sm hide-in-presenter">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-[#F4EBDD] hover:bg-[#EBDFCB] text-left transition-colors cursor-pointer border-b border-[#DDD0BA]"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider font-bold text-[#231B12]">
            All readings ({interpretations.length})
          </span>
          <span className="text-[11px] font-mono text-[#6E6253]">
            · Complete sandbox execution traces
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-[#6E6253]">
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
        <div className="p-4 sm:p-5 space-y-3 bg-surface">
          {interpretations.map((interp, idx) => {
            const isHighlighted = highlightedGroupId === interp.group_id;

            return (
              <div
                key={interp.id}
                onMouseEnter={() => onHoverReading && onHoverReading(interp.group_id)}
                onMouseLeave={() => onHoverReading && onHoverReading(null)}
                className={`p-4 rounded-[8px] border transition-all ${
                  isHighlighted
                    ? "border-[#17494D] bg-[#F4EBDD] ring-1 ring-[#17494D]"
                    : "border-[#DDD0BA] bg-[#F4EBDD]/40 hover:bg-[#F4EBDD]"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-[4px] bg-[#DDD0BA] font-mono text-[11px] font-bold text-[#231B12]">
                      Reading {idx + 1}
                    </span>
                    <span className="text-[11px] font-mono text-[#6E6253]">
                      Cluster: {interp.group_id}
                    </span>
                  </div>
                </div>

                {/* Rationale */}
                <p className="text-xs sm:text-sm font-sans text-[#231B12] mb-3">
                  {interp.rationale}
                </p>

                {/* Plan chips */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-mono uppercase text-[#6E6253] mr-1 flex items-center gap-1">
                    <Terminal className="w-3 h-3" strokeWidth={1.5} />
                    <span>Plan:</span>
                  </span>
                  {interp.plan.map((step, sIdx) => (
                    <span
                      key={sIdx}
                      className="px-2 py-0.5 rounded-[4px] bg-surface border border-[#DDD0BA] font-mono text-[10px] text-[#231B12]"
                    >
                      {step.tool}
                    </span>
                  ))}
                </div>

                {/* Effects */}
                <div className="space-y-1 pt-2 border-t border-[#DDD0BA]/60">
                  {interp.effects.map((eff, eIdx) => (
                    <div
                      key={eIdx}
                      className="flex items-center justify-between text-xs text-[#6E6253]"
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
