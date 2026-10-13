"use client";

import React from "react";
import { Bug, X } from "lucide-react";
import { mockAnswerSession, mockCreateSession } from "@/lib/mock";
import { Session } from "@/lib/types";

interface DebugPanelProps {
  onLoadSession: (session: Session | null) => void;
  onSetLoading: (loading: boolean) => void;
  onSetError: (msg: string | null) => void;
}

export function DebugPanel({
  onLoadSession,
  onSetLoading,
  onSetError,
}: DebugPanelProps) {
  const [isOpen, setIsOpen] = React.useState(true);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 p-2 rounded-full bg-[#17494D] text-white shadow-sawal-md hover:bg-[#0F3639] transition-all cursor-pointer"
        title="Open Debug Panel (?debug=1)"
      >
        <Bug className="w-4 h-4" strokeWidth={1.5} />
      </button>
    );
  }

  const loadCanned = async (key: string) => {
    onSetError(null);
    onSetLoading(false);

    if (key === "empty") {
      onLoadSession(null);
      return;
    }

    if (key === "rehearsing") {
      onSetLoading(true);
      return;
    }

    if (key === "error") {
      const err = await mockCreateSession({ request_text: "trigger error", llm_mode: "live" });
      onLoadSession(err);
      onSetError(err.error?.message || "Execution engine aborted");
      return;
    }

    if (key === "priya") {
      const sess = await mockCreateSession({
        request_text: "Send an email to Priya confirming the lab slot.",
        llm_mode: "live",
      });
      onLoadSession(sess);
      return;
    }

    if (key === "seminar") {
      const sess = await mockCreateSession({
        request_text: "Book the seminar hall for a group meeting.",
        llm_mode: "live",
      });
      onLoadSession(sess);
      return;
    }

    if (key === "calendar") {
      const sess = await mockCreateSession({
        request_text: "Check my calendar for tomorrow afternoon.",
        llm_mode: "live",
      });
      onLoadSession(sess);
      return;
    }

    if (key === "lunch") {
      const sess = await mockCreateSession({
        request_text: "Find a quiet spot for team lunch near campus.",
        llm_mode: "live",
      });
      onLoadSession(sess);
      return;
    }

    if (key === "note_tea") {
      const sess = await mockCreateSession({
        request_text: "Draft a note to the study group and log forty rupees for tea.",
        llm_mode: "live",
      });
      onLoadSession(sess);
      return;
    }

    if (key === "committed") {
      const base = await mockCreateSession({
        request_text: "Send an email to Priya confirming the lab slot.",
        llm_mode: "live",
      });
      const committed = await mockAnswerSession(base.session_id, {
        option_id: "opt-sharma",
      });
      onLoadSession(committed);
      return;
    }

    if (key === "low_diversity") {
      const sess = await mockCreateSession({
        request_text: "trigger diversity blindspot meeting",
        llm_mode: "live",
      });
      onLoadSession(sess);
      return;
    }
  };

  const states = [
    { key: "empty", label: "Empty" },
    { key: "rehearsing", label: "Rehearsing" },
    { key: "priya", label: "Ask (Priya)" },
    { key: "seminar", label: "Ask (Seminar)" },
    { key: "calendar", label: "Act (Calendar)" },
    { key: "lunch", label: "Act (Lunch)" },
    { key: "note_tea", label: "Act (Note & Tea)" },
    { key: "committed", label: "Committed" },
    { key: "low_diversity", label: "Low Diversity" },
    { key: "error", label: "Error" },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-[12px] bg-white border border-[#17494D] p-3 shadow-sawal-md text-xs space-y-2 max-w-xs">
      <div className="flex items-center justify-between border-b border-[#E8E2D8] pb-1.5">
        <span className="font-mono font-bold text-[#17494D] uppercase tracking-wider text-[11px] flex items-center gap-1">
          <Bug className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Debug State Jumper</span>
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-[#6B665E] hover:text-[#1C1B19] p-0.5 rounded cursor-pointer"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-1">
        {states.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => loadCanned(s.key)}
            className="px-2 py-1 rounded-[4px] bg-[#F4EFE7] hover:bg-[#E6EFEE] hover:text-[#17494D] text-[#1C1B19] font-mono text-[10px] text-left transition-colors cursor-pointer"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
