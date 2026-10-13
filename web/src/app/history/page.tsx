"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, History, Trash2 } from "lucide-react";
import { useSessionContext } from "@/lib/sessionContext";
import { Session } from "@/lib/types";

export default function HistoryPage() {
  const router = useRouter();
  const { history, clearHistory, setActiveSession } = useSessionContext();

  const handleOpenSession = (sess: Session) => {
    setActiveSession(sess);
    router.push("/");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
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
            <History className="w-5 h-5 text-[#17494D]" strokeWidth={1.5} />
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#231B12] tracking-tight">
              Session History
            </h1>
          </div>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#DDD0BA] bg-surface text-xs font-semibold text-[#A33A2B] hover:bg-[#FBE9E5] transition-colors cursor-pointer shadow-sawal-sm"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Clear history</span>
          </button>
        )}
      </div>

      {/* History List or Empty State */}
      {history.length === 0 ? (
        <div className="p-12 text-center rounded-[12px] border-2 border-dashed border-[#DDD0BA] bg-surface/60 space-y-3">
          <Clock className="w-8 h-8 mx-auto text-[#6E6253]" strokeWidth={1.5} />
          <h3 className="text-base font-serif font-bold text-[#231B12]">
            No session history yet
          </h3>
          <p className="text-xs sm:text-sm text-[#6E6253] max-w-sm mx-auto">
            Run requests on the main assistant screen to see them recorded in this browser session.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#17494D] text-white text-xs font-semibold hover:bg-[#0F3639] transition-colors"
            >
              Try an example request
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-[12px] border border-[#DDD0BA] bg-surface divide-y divide-[#DDD0BA] shadow-sawal-sm overflow-hidden">
          {history.map(({ session, timestamp }) => {
            const isAct = session.decision?.action === "act" || session.status === "completed";
            const dateStr = new Date(timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            return (
              <div
                key={session.session_id}
                onClick={() => handleOpenSession(session)}
                className="p-4 sm:p-5 hover:bg-[#F4EBDD] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-[4px] font-mono text-[10px] uppercase font-bold tracking-wider ${
                        isAct
                          ? "bg-[#E7F3EC] text-[#1F6B4A]"
                          : "bg-[#FBF1DC] text-[#8A5A0B]"
                      }`}
                    >
                      {isAct ? "ACT" : "ASK"}
                    </span>
                    <span className="text-[11px] font-mono text-[#6E6253]">
                      {session.interpretations.length} readings · {session.groups.length}{" "}
                      {session.groups.length === 1 ? "outcome" : "outcomes"}
                    </span>
                    <span className="text-[11px] font-mono text-[#6E6253]">
                      · {dateStr}
                    </span>
                  </div>

                  <p className="text-sm sm:text-base font-serif font-bold text-[#231B12] group-hover:text-[#17494D] transition-colors">
                    {session.request_text}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2 text-xs font-mono text-[#17494D] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Reopen &rarr;</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
