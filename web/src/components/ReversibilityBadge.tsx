"use client";

import React from "react";
import { AlertTriangle, Eye, RotateCcw } from "lucide-react";
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
        style={{ color: "#1F6B4A", backgroundColor: "#E7F3EC" }}
        className={`inline-flex items-center gap-1.5 font-medium rounded-[8px] transition-colors ${
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
        }`}
        title="Safe read-only operation"
      >
        <Eye className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} strokeWidth={1.5} />
        <span>Read only</span>
      </span>
    );
  }

  if (reversibility === "reversible") {
    return (
      <span
        style={{ color: "#8A5A0B", backgroundColor: "#FBF1DC" }}
        className={`inline-flex items-center gap-1.5 font-medium rounded-[8px] transition-colors ${
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
        }`}
        title="Can be undone: effects can be rolled back"
      >
        <RotateCcw className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} strokeWidth={1.5} />
        <span>Can be undone</span>
      </span>
    );
  }

  // irreversible
  return (
    <span
      style={{ color: "#A33A2B", backgroundColor: "#FBE9E5" }}
      className={`inline-flex items-center gap-1.5 font-semibold rounded-[8px] transition-colors ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      }`}
      title="Can't be undone: permanent external impact"
    >
      <AlertTriangle className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} strokeWidth={1.5} />
      <span>Can&apos;t be undone</span>
    </span>
  );
}
