"use client";

import React from "react";
import { Eye, RotateCcw, ShieldAlert } from "lucide-react";
import { Reversibility } from "@/lib/types";

interface ReversibilityBadgeProps {
  reversibility: Reversibility;
  size?: "sm" | "md";
}

export function ReversibilityBadge({
  reversibility,
  size = "md",
}: ReversibilityBadgeProps) {
  if (reversibility === "readonly") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-md border text-emerald-800 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800 ${
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs sm:text-sm"
        }`}
        title="Safe read-only operation with no persistent world modification"
      >
        <Eye className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span>Read only</span>
      </span>
    );
  }

  if (reversibility === "reversible") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-md border text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/60 dark:border-amber-800 ${
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs sm:text-sm"
        }`}
        title="Reversible action: effects can be rolled back, deleted, or edited"
      >
        <RotateCcw className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span>Can be undone</span>
      </span>
    );
  }

  // irreversible
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-md border text-rose-800 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/70 dark:border-rose-800 animate-pulse ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs sm:text-sm"
      }`}
      title="Irreversible action: external impact cannot be recalled automatically"
    >
      <ShieldAlert className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      <span>Can&apos;t be undone</span>
    </span>
  );
}
