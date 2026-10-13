"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Globe2,
  Mail,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { ReversibilityBadge } from "@/components/ReversibilityBadge";
import { fetchLiveWorld, resetLiveWorld } from "@/lib/api";
import { useSessionContext } from "@/lib/sessionContext";
import {
  LiveCalendarEvent,
  LiveEmail,
  LiveExpense,
  LiveReservation,
  LiveWorldState,
  Reversibility,
} from "@/lib/types";

export default function WorldPage() {
  const { accumulatedWorldDiff, clearWorld, isMockMode } = useSessionContext();
  const [liveWorld, setLiveWorld] = useState<LiveWorldState | null>(null);
  const [isLoadingLive, setIsLoadingLive] = useState(!isMockMode);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!isMockMode) {
      fetchLiveWorld()
        .then((data) => {
          if (active) setLiveWorld(data as LiveWorldState);
        })
        .catch(() => {
          if (active) setLiveWorld(null);
        })
        .finally(() => {
          if (active) setIsLoadingLive(false);
        });
    } else {
      setIsLoadingLive(false);
    }
    return () => {
      active = false;
    };
  }, [isMockMode]);

  const handleReset = async () => {
    setIsResetting(true);
    if (!isMockMode) {
      try {
        const resetRes = await resetLiveWorld();
        setLiveWorld(resetRes as LiveWorldState);
      } catch (err) {
        console.error("Failed to reset live world:", err);
      }
    }
    clearWorld();
    setIsResetting(false);
  };

  // Determine items based on mode
  const calendarEvents = !isMockMode && liveWorld?.calendar_events
    ? liveWorld.calendar_events
    : [];
  const emails = !isMockMode && liveWorld?.emails ? liveWorld.emails : [];
  const reservations = !isMockMode && liveWorld?.reservations
    ? liveWorld.reservations
    : [];
  const expenses = !isMockMode && liveWorld?.expenses ? liveWorld.expenses : [];

  const mockCalendar = accumulatedWorldDiff.filter((d) =>
    d.entity.toLowerCase().includes("calendar")
  );
  const mockOutbox = accumulatedWorldDiff.filter(
    (d) =>
      d.entity.toLowerCase().includes("email") ||
      d.entity.toLowerCase().includes("outbox") ||
      d.entity.toLowerCase().includes("facilities")
  );
  const mockExpenses = accumulatedWorldDiff.filter(
    (d) =>
      d.entity.toLowerCase().includes("expense") ||
      d.entity.toLowerCase().includes("notes")
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DDD0BA] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#DDD0BA] bg-surface text-xs sm:text-sm font-semibold text-[#231B12] hover:border-[#17494D] transition-colors shadow-sawal-sm"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>Back to Assistant</span>
          </Link>
          <div className="h-5 w-px bg-[#DDD0BA]" />
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-[#17494D]" strokeWidth={1.5} />
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#231B12] tracking-tight">
              The World State
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[#6E6253]">
            {!isMockMode
              ? "Live backend state (GET /v1/world)"
              : "Changes made in this browser session"}
          </span>
          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting || isLoadingLive}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#DDD0BA] bg-surface text-xs font-semibold text-[#231B12] hover:bg-[#EBDFCB] transition-colors cursor-pointer shadow-sawal-sm disabled:opacity-50"
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`}
              strokeWidth={1.5}
            />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {isLoadingLive ? (
        <div className="p-12 text-center rounded-[12px] border border-[#DDD0BA] bg-surface space-y-3">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[#17494D]" strokeWidth={1.5} />
          <p className="text-sm font-mono text-[#6E6253]">
            Fetching live world state from backend...
          </p>
        </div>
      ) : (
        /* 3 Domain Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Domain 1: Calendar */}
          <div className="rounded-[12px] border border-[#DDD0BA] bg-surface p-5 shadow-sawal-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDD0BA] pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#17494D]" strokeWidth={1.5} />
                <h3 className="font-serif font-bold text-base text-[#231B12]">
                  Calendar Sync
                </h3>
              </div>
              <span className="text-xs font-mono text-[#6E6253]">
                {!isMockMode
                  ? `${calendarEvents.length} events`
                  : `${mockCalendar.length} changes`}
              </span>
            </div>

            {!isMockMode ? (
              calendarEvents.length === 0 ? (
                <p className="text-xs text-[#6E6253] font-sans py-4 text-center">
                  No calendar events in world state.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {calendarEvents.map((evt: LiveCalendarEvent, i: number) => (
                    <div
                      key={evt.id || i}
                      className="p-3 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-xs space-y-1"
                    >
                      <div className="font-semibold text-[#231B12]">{evt.title}</div>
                      <div className="text-[11px] font-mono text-[#6E6253]">
                        {evt.start_time ? new Date(evt.start_time).toLocaleString() : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : mockCalendar.length === 0 ? (
              <p className="text-xs text-[#6E6253] font-sans py-4 text-center">
                No calendar events queried or booked yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {mockCalendar.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[10px] uppercase font-bold text-[#17494D]">
                        {item.op}
                      </span>
                      <ReversibilityBadge
                        reversibility={item.reversibility as Reversibility}
                        size="sm"
                      />
                    </div>
                    <p className="font-medium text-[#231B12]">{item.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Domain 2: Outbox */}
          <div className="rounded-[12px] border border-[#DDD0BA] bg-surface p-5 shadow-sawal-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDD0BA] pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#17494D]" strokeWidth={1.5} />
                <h3 className="font-serif font-bold text-base text-[#231B12]">
                  Outbox Dispatches
                </h3>
              </div>
              <span className="text-xs font-mono text-[#6E6253]">
                {!isMockMode
                  ? `${emails.length + reservations.length} records`
                  : `${mockOutbox.length} dispatches`}
              </span>
            </div>

            {!isMockMode ? (
              emails.length === 0 && reservations.length === 0 ? (
                <p className="text-xs text-[#6E6253] font-sans py-4 text-center">
                  No emails or reservations in world state.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {emails.map((em: LiveEmail, i: number) => (
                    <div
                      key={em.id || i}
                      className="p-3 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] font-bold text-[#17494D]">
                          {em.status === "sent" ? "SENT" : "DRAFT"}
                        </span>
                        <ReversibilityBadge
                          reversibility={em.status === "sent" ? "irreversible" : "reversible"}
                          size="sm"
                        />
                      </div>
                      <p className="font-medium text-[#231B12] truncate">
                        {em.to}: {em.subject}
                      </p>
                    </div>
                  ))}
                  {reservations.map((res: LiveReservation, i: number) => (
                    <div
                      key={res.id || i}
                      className="p-3 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] font-bold text-[#734706]">
                          RESERVATION
                        </span>
                        <ReversibilityBadge reversibility="irreversible" size="sm" />
                      </div>
                      <p className="font-medium text-[#231B12]">
                        {res.party_size} guests at {res.restaurant_id}
                      </p>
                    </div>
                  ))}
                </div>
              )
            ) : mockOutbox.length === 0 ? (
              <p className="text-xs text-[#6E6253] font-sans py-4 text-center">
                Outbox is clean. No outbound emails or reservations committed.
              </p>
            ) : (
              <div className="space-y-2.5">
                {mockOutbox.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[10px] uppercase font-bold text-[#17494D]">
                        {item.op}
                      </span>
                      <ReversibilityBadge
                        reversibility={item.reversibility as Reversibility}
                        size="sm"
                      />
                    </div>
                    <p className="font-medium text-[#231B12]">{item.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Domain 3: Expenses Ledger */}
          <div className="rounded-[12px] border border-[#DDD0BA] bg-surface p-5 shadow-sawal-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDD0BA] pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#17494D]" strokeWidth={1.5} />
                <h3 className="font-serif font-bold text-base text-[#231B12]">
                  Expenses Ledger
                </h3>
              </div>
              <span className="text-xs font-mono text-[#6E6253]">
                {!isMockMode
                  ? `${expenses.length} entries`
                  : `${mockExpenses.length} entries`}
              </span>
            </div>

            {!isMockMode ? (
              expenses.length === 0 ? (
                <p className="text-xs text-[#6E6253] font-sans py-4 text-center">
                  No expense records logged in world state.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {expenses.map((exp: LiveExpense, i: number) => (
                    <div
                      key={exp.id || i}
                      className="p-3 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#231B12]">
                          ₹{exp.amount} {exp.currency || "INR"}
                        </span>
                        <ReversibilityBadge reversibility="reversible" size="sm" />
                      </div>
                      <p className="text-[#6E6253]">{exp.description}</p>
                    </div>
                  ))}
                </div>
              )
            ) : mockExpenses.length === 0 ? (
              <p className="text-xs text-[#6E6253] font-sans py-4 text-center">
                Current billing cycle has zero mutation entries.
              </p>
            ) : (
              <div className="space-y-2.5">
                {mockExpenses.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[10px] uppercase font-bold text-[#17494D]">
                        {item.op}
                      </span>
                      <ReversibilityBadge
                        reversibility={item.reversibility as Reversibility}
                        size="sm"
                      />
                    </div>
                    <p className="font-medium text-[#231B12]">{item.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
