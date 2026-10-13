"use client";

import React from "react";
import { Calendar, CreditCard, Mail } from "lucide-react";
import { WorldDiffItem } from "@/lib/types";

interface WorldStripProps {
  worldDiff?: WorldDiffItem[];
}

export function WorldStrip({ worldDiff = [] }: WorldStripProps) {
  const hasCalendar = worldDiff.some((d) =>
    d.entity.toLowerCase().includes("calendar")
  );
  const hasOutbox = worldDiff.some(
    (d) =>
      d.entity.toLowerCase().includes("email") ||
      d.entity.toLowerCase().includes("outbox")
  );
  const hasExpenses = worldDiff.some(
    (d) =>
      d.entity.toLowerCase().includes("expense") ||
      d.entity.toLowerCase().includes("notes")
  );

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-[#6E6253]">
        THE WORLD (SESSION STATE PREVIEW)
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
              <span className="px-1 py-0.2 rounded-[4px] bg-[#E7F3EC] text-[#19583D] text-[9px] font-mono font-bold">
                + added
              </span>
            )}
          </div>
          <p
            className={`text-[11px] text-[#6E6253] truncate ${
              hasCalendar
                ? "underline decoration-[#17494D] text-[#231B12] font-medium"
                : ""
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
              <span className="px-1 py-0.2 rounded-[4px] bg-[#E7F3EC] text-[#19583D] text-[9px] font-mono font-bold">
                + added
              </span>
            )}
          </div>
          <p
            className={`text-[11px] text-[#6E6253] truncate ${
              hasOutbox
                ? "underline decoration-[#17494D] text-[#231B12] font-medium"
                : ""
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
              <span className="px-1 py-0.2 rounded-[4px] bg-[#E7F3EC] text-[#19583D] text-[9px] font-mono font-bold">
                + added
              </span>
            )}
          </div>
          <p
            className={`text-[11px] text-[#6E6253] truncate ${
              hasExpenses
                ? "underline decoration-[#17494D] text-[#231B12] font-medium"
                : ""
            }`}
          >
            {hasExpenses
              ? "₹40 logged under Tea / Chai"
              : "Current cycle settled"}
          </p>
        </div>
      </div>
    </div>
  );
}
