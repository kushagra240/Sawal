"use client";

import React, { useEffect, useState } from "react";
import { Calendar, CreditCard, Mail } from "lucide-react";
import { fetchLiveWorld } from "@/lib/api";
import { useSessionContext } from "@/lib/sessionContext";
import { LiveWorldState, WorldDiffItem } from "@/lib/types";

interface WorldStripProps {
  worldDiff?: WorldDiffItem[];
}

export function WorldStrip({ worldDiff = [] }: WorldStripProps) {
  const { isMockMode } = useSessionContext();
  const [liveWorld, setLiveWorld] = useState<LiveWorldState | null>(null);

  useEffect(() => {
    if (isMockMode) return;
    fetchLiveWorld()
      .then((data) => setLiveWorld(data as LiveWorldState))
      .catch(() => setLiveWorld(null));
  }, [isMockMode, worldDiff]);

  const diffCalendar = worldDiff.some((d) =>
    d.entity.toLowerCase().includes("calendar")
  );
  const diffOutbox = worldDiff.some(
    (d) =>
      d.entity.toLowerCase().includes("email") ||
      d.entity.toLowerCase().includes("outbox")
  );
  const diffExpenses = worldDiff.some(
    (d) =>
      d.entity.toLowerCase().includes("expense") ||
      d.entity.toLowerCase().includes("notes")
  );

  const hasCalendar = !isMockMode
    ? Boolean(liveWorld?.calendar_events && liveWorld.calendar_events.length > 0) || diffCalendar
    : diffCalendar;

  const hasOutbox = !isMockMode
    ? Boolean(
        (liveWorld?.emails && liveWorld.emails.length > 0) ||
        (liveWorld?.reservations && liveWorld.reservations.length > 0)
      ) || diffOutbox
    : diffOutbox;

  const hasExpenses = !isMockMode
    ? Boolean(liveWorld?.expenses && liveWorld.expenses.length > 0) || diffExpenses
    : diffExpenses;

  // Contextual labels
  const calendarText = !isMockMode && liveWorld?.calendar_events?.[0]
    ? `${liveWorld.calendar_events[0].title || "Event"}`
    : hasCalendar
    ? "Tomorrow: 2:00 PM ML Reading Group"
    : "Mon 13 · Tue 14 · Wed 15";

  const outboxText = !isMockMode && liveWorld?.emails?.[0]
    ? `${liveWorld.emails[0].to}: ${liveWorld.emails[0].subject || "Dispatched"}`
    : hasOutbox
    ? "Confirmed: Slot notice dispatched"
    : "No pending outgoing drafts";

  const expensesText = !isMockMode && liveWorld?.expenses?.[0]
    ? `₹${liveWorld.expenses[0].amount} logged (${liveWorld.expenses[0].description || "expense"})`
    : hasExpenses
    ? "₹40 logged under Tea / Chai"
    : "Current cycle settled";

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-[#6E6253]">
        THE WORLD ({!isMockMode ? "LIVE BACKEND STATE" : "SESSION STATE PREVIEW"})
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
                + {!isMockMode ? "live" : "added"}
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
            {calendarText}
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
                + {!isMockMode ? "live" : "added"}
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
            {outboxText}
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
                + {!isMockMode ? "live" : "added"}
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
            {expensesText}
          </p>
        </div>
      </div>
    </div>
  );
}
