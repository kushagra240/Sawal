"use client";

import React from "react";
import { Session } from "@/lib/types";

interface FooterProps {
  session: Session | null;
  onOpenShortcuts: () => void;
}

export function Footer({ session, onOpenShortcuts }: FooterProps) {
  // Compute honest commit status
  let commitStatus = "Nothing committed yet";
  let statusDotColor = "#734706"; // Amber for uncommitted / pending

  if (session?.status === "completed" && session.result?.world_diff) {
    const count = session.result.world_diff.length;
    commitStatus = `${count} change${count === 1 ? "" : "s"} committed`;
    statusDotColor = "#19583D"; // Green for committed
  } else if (!session) {
    commitStatus = "Nothing committed yet";
    statusDotColor = "#6E6253"; // Muted for idle
  }

  return (
    <footer className="border-t border-[#DDD0BA] bg-[#F4EBDD] py-3 mt-8 hide-in-presenter text-xs font-mono text-[#6E6253]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        {/* Left */}
        <div className="flex items-center gap-2">
          <span>Sawal</span>
          <span>·</span>
          <span>Jugaad Labs</span>
          <span>·</span>
          <span>open source</span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusDotColor }}
            />
            <span className="text-[#231B12] font-medium">{commitStatus}</span>
          </div>

          <span>·</span>

          <button
            type="button"
            onClick={onOpenShortcuts}
            className="hover:text-[#231B12] transition-colors cursor-pointer underline underline-offset-2"
          >
            Keyboard shortcuts [? to view]
          </button>
        </div>
      </div>
    </footer>
  );
}
