"use client";

import React from "react";
import { AlertTriangle, RefreshCw, Repeat } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  onSwitchToReplay: () => void;
}

export function ErrorState({
  message,
  onRetry,
  onSwitchToReplay,
}: ErrorStateProps) {
  return (
    <div className="rounded-[12px] border border-[#A33A2B]/30 bg-[#FBE9E5] p-6 shadow-sawal-sm space-y-4">
      {/* Broken dashes illustration */}
      <div className="flex items-center justify-center py-2 opacity-60">
        <svg width="240" height="24" viewBox="0 0 240 24" fill="none">
          <line
            x1="0"
            y1="12"
            x2="240"
            y2="12"
            stroke="#A33A2B"
            strokeWidth="2"
            strokeDasharray="6 8"
          />
        </svg>
      </div>

      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-white text-[#A33A2B] shrink-0">
          <AlertTriangle className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-serif font-bold text-[#A33A2B]">
            Rehearsal Execution Error
          </h3>
          <p className="text-xs sm:text-sm text-[#1C1B19] font-sans">
            {message}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#A33A2B]/20">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] bg-white text-[#1C1B19] border border-[#E8E2D8] text-xs font-semibold hover:bg-[#F4EFE7] transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Try again</span>
        </button>

        <button
          type="button"
          onClick={onSwitchToReplay}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] bg-[#17494D] text-white text-xs font-semibold hover:bg-[#0F3639] transition-colors cursor-pointer shadow-sawal-sm"
        >
          <Repeat className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Switch to Replay</span>
        </button>
      </div>
    </div>
  );
}
