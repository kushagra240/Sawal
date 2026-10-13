"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Globe2,
  Mail,
  RotateCcw,
} from "lucide-react";
import { ReversibilityBadge } from "@/components/ReversibilityBadge";
import { useSessionContext } from "@/lib/sessionContext";
import { Reversibility } from "@/lib/types";

export default function WorldPage() {
  const { accumulatedWorldDiff, clearWorld } = useSessionContext();

  const calendarItems = accumulatedWorldDiff.filter((d) =>
    d.entity.toLowerCase().includes("calendar")
  );
  const outboxItems = accumulatedWorldDiff.filter(
    (d) =>
      d.entity.toLowerCase().includes("email") ||
      d.entity.toLowerCase().includes("outbox") ||
      d.entity.toLowerCase().includes("facilities")
  );
  const expenseItems = accumulatedWorldDiff.filter(
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
            Changes made in this browser session
          </span>
          <button
            type="button"
            onClick={clearWorld}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#DDD0BA] bg-surface text-xs font-semibold text-[#231B12] hover:bg-[#EBDFCB] transition-colors cursor-pointer shadow-sawal-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 3 Domain Cards Grid */}
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
              {calendarItems.length} changes
            </span>
          </div>

          {calendarItems.length === 0 ? (
            <p className="text-xs text-[#6E6253] font-sans py-4 text-center">
              No calendar events queried or booked yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {calendarItems.map((item) => (
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
              {outboxItems.length} committed
            </span>
          </div>

          {outboxItems.length === 0 ? (
            <p className="text-xs text-[#6E6253] font-sans py-4 text-center">
              No outgoing messages or external reservations committed yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {outboxItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[10px] uppercase font-bold text-[#A33A2B]">
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

        {/* Domain 3: Expenses & Notes */}
        <div className="rounded-[12px] border border-[#DDD0BA] bg-surface p-5 shadow-sawal-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#DDD0BA] pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#17494D]" strokeWidth={1.5} />
              <h3 className="font-serif font-bold text-base text-[#231B12]">
                Expenses &amp; Notes
              </h3>
            </div>
            <span className="text-xs font-mono text-[#6E6253]">
              {expenseItems.length} records
            </span>
          </div>

          {expenseItems.length === 0 ? (
            <p className="text-xs text-[#6E6253] font-sans py-4 text-center">
              No notes drafts or expenses recorded yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {expenseItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[10px] uppercase font-bold text-[#8A5A0B]">
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
    </div>
  );
}
