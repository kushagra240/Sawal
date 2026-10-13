"use client";

import React from "react";
import { Calendar, CheckCircle2, Cpu, CreditCard, Mail } from "lucide-react";
import { ExecutionResult, OutcomeGroup, Reversibility } from "@/lib/types";
import { ReversibilityBadge } from "./ReversibilityBadge";

interface CompletedCardProps {
  status: "completed" | "asked" | "failed";
  action: "act" | "ask";
  result: ExecutionResult | null;
  groups: OutcomeGroup[];
  isCommittedAnswer?: boolean;
}

export function CompletedCard({
  action,
  result,
  groups,
  isCommittedAnswer = false,
}: CompletedCardProps) {
  const isActAutonomous = action === "act" && !isCommittedAnswer;
  const stampText = isActAutonomous
    ? `SAME OUTCOME ×${groups[0]?.size || 5}`
    : "COMMITTED";

  // Check which domains were affected
  const diffs = result?.world_diff || [];
  const hasCalendar = diffs.some((d) => d.entity.toLowerCase().includes("calendar"));
  const hasOutbox = diffs.some((d) => d.entity.toLowerCase().includes("email") || d.entity.toLowerCase().includes("outbox"));
  const hasExpenses = diffs.some((d) => d.entity.toLowerCase().includes("expense") || d.entity.toLowerCase().includes("notes"));

  return (
    <div className="space-y-4">
      {/* Primary Result Card */}
      <div className="relative rounded-[12px] border border-[#DDD0BA] bg-surface p-6 shadow-sawal-sm space-y-4 overflow-hidden">
        {/* Header with Title & Thin Double-Ring Stamp */}
        <div className="flex items-start justify-between gap-4 border-b border-[#DDD0BA] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#E7F3EC] flex items-center justify-center text-[#1F6B4A]">
              <CheckCircle2 className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6E6253]">
                EXECUTION STATE
              </span>
              <h3 className="text-xl font-serif font-bold text-[#231B12]">
                {isActAutonomous ? "Acting Autonomously" : "Action Committed"}
              </h3>
            </div>
          </div>

          {/* Thin double-ring stamp rotated -3 degrees */}
          <div
            className="shrink-0 border-2 border-double border-[#17494D] px-3 py-1 rounded-[6px] font-mono font-bold tracking-widest text-[11px] text-[#17494D] -rotate-3 select-none"
            style={{ borderWidth: "3px" }}
          >
            {stampText}
          </div>
        </div>

        {/* Executed Tools */}
        {result?.executed_tools && result.executed_tools.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6E6253] font-mono uppercase text-[10px] font-bold">
              EXECUTED:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {result.executed_tools.map((tool, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-[4px] bg-[#EBDFCB] border border-[#DDD0BA] font-mono text-[11px] text-[#231B12] flex items-center gap-1"
                >
                  <Cpu className="w-3 h-3 text-[#17494D]" strokeWidth={1.5} />
                  <span>{tool}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* World Diff Rows */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#6E6253]">
            APPLIED WORLD DIFF
          </div>
          <div className="space-y-1.5">
            {diffs.map((diff, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-[#DDD0BA] font-mono text-[10px] uppercase font-bold text-[#231B12]">
                    {diff.op}
                  </span>
                  <span className="font-mono text-[#6E6253] text-[11px]">{diff.entity}</span>
                  <span className="font-medium text-[#231B12]">{diff.summary}</span>
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
        </div>
      </div>

      {/* Under It: Compact "The World" Strip of 3 Paper Cards */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-[#6E6253]">
          THE WORLD (SESSION STATE)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {/* Card 1: Calendar Week Strip */}
          <div
            className={`p-3 rounded-[8px] border bg-[#F4EBDD] transition-all shadow-sawal-sm ${
              hasCalendar
                ? "border-[#17494D] ring-1 ring-[#17494D]/20"
                : "border-[#DDD0BA]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#231B12]">
                <Calendar className="w-3.5 h-3.5 text-[#6E6253]" strokeWidth={1.5} />
                <span>Calendar</span>
              </span>
              {hasCalendar && (
                <span className="px-1 py-0.2 rounded-[4px] bg-[#E7F3EC] text-[#1F6B4A] text-[9px] font-mono font-bold">
                  + added
                </span>
              )}
            </div>
            <p
              className={`text-[11px] text-[#6E6253] truncate ${
                hasCalendar ? "underline decoration-[#17494D] text-[#231B12] font-medium" : ""
              }`}
            >
              {hasCalendar
                ? "Tomorrow: 2:00 PM ML Reading Group"
                : "Mon 13 · Tue 14 · Wed 15"}
            </p>
          </div>

          {/* Card 2: Outbox */}
          <div
            className={`p-3 rounded-[8px] border bg-[#F4EBDD] transition-all shadow-sawal-sm ${
              hasOutbox
                ? "border-[#17494D] ring-1 ring-[#17494D]/20"
                : "border-[#DDD0BA]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#231B12]">
                <Mail className="w-3.5 h-3.5 text-[#6E6253]" strokeWidth={1.5} />
                <span>Outbox</span>
              </span>
              {hasOutbox && (
                <span className="px-1 py-0.2 rounded-[4px] bg-[#E7F3EC] text-[#1F6B4A] text-[9px] font-mono font-bold">
                  + added
                </span>
              )}
            </div>
            <p
              className={`text-[11px] text-[#6E6253] truncate ${
                hasOutbox ? "underline decoration-[#17494D] text-[#231B12] font-medium" : ""
              }`}
            >
              {hasOutbox
                ? "Confirmed: Slot notice dispatched"
                : "No pending outgoing drafts"}
            </p>
          </div>

          {/* Card 3: Expenses Ledger */}
          <div
            className={`p-3 rounded-[8px] border bg-[#F4EBDD] transition-all shadow-sawal-sm ${
              hasExpenses
                ? "border-[#17494D] ring-1 ring-[#17494D]/20"
                : "border-[#DDD0BA]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#231B12]">
                <CreditCard className="w-3.5 h-3.5 text-[#6E6253]" strokeWidth={1.5} />
                <span>Expenses Ledger</span>
              </span>
              {hasExpenses && (
                <span className="px-1 py-0.2 rounded-[4px] bg-[#E7F3EC] text-[#1F6B4A] text-[9px] font-mono font-bold">
                  + added
                </span>
              )}
            </div>
            <p
              className={`text-[11px] text-[#6E6253] truncate ${
                hasExpenses ? "underline decoration-[#17494D] text-[#231B12] font-medium" : ""
              }`}
            >
              {hasExpenses
                ? "₹40 logged under Tea / Chai"
                : "Current cycle settled"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
