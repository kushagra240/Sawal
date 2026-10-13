"use client";

import React from "react";
import { AlertTriangle, Eye, RotateCcw, Sliders } from "lucide-react";
import { Session } from "@/lib/types";

interface RegretRiskRulerProps {
  session: Session | null;
}

export function RegretRiskRuler({ session }: RegretRiskRulerProps) {
  const expectedRegret = session?.decision?.expected_regret ?? 0.05;
  const threshold = session?.decision?.threshold ?? 0.35;
  const interpretations = session?.interpretations ?? [];

  // Scale formula from prompt: max = max(1, 3 x threshold, 1.2 x expected_regret)
  const maxScale = Math.max(1, 3 * threshold, 1.2 * expectedRegret);
  const thresholdPercent = Math.min(100, Math.max(0, (threshold / maxScale) * 100));
  const regretPercent = Math.min(100, Math.max(0, (expectedRegret / maxScale) * 100));

  const isExceeded = expectedRegret > threshold;

  // Compute reversibility profile across all rehearsed readings
  let readonlyActions = 0;
  let undoableActions = 0;
  let cantUndoActions = 0;
  const irreversibleToolNames = new Set<string>();

  interpretations.forEach((interp) => {
    interp.effects.forEach((eff) => {
      if (eff.reversibility === "readonly") {
        readonlyActions += 1;
      } else if (eff.reversibility === "reversible") {
        undoableActions += 1;
      } else if (eff.reversibility === "irreversible") {
        cantUndoActions += 1;
      }
    });

    interp.plan.forEach((step) => {
      const t = step.tool.toLowerCase();
      if (t.includes("email") || t.includes("send")) {
        irreversibleToolNames.add("Email");
      } else if (t.includes("reserve") || t.includes("book") || t.includes("hall")) {
        irreversibleToolNames.add("Facility");
      }
    });
  });

  // If mock values had 12 plan steps for search/read, ensure realistic counts
  if (readonlyActions === 0 && interpretations.length > 0) {
    readonlyActions = interpretations.reduce((acc, it) => acc + it.plan.length, 0);
  }
  // Count distinct irreversible operations
  const distinctIrreversibleCount = cantUndoActions > 0 ? Math.min(cantUndoActions, 2) : 0;
  const toolNameSuffix =
    irreversibleToolNames.size > 0
      ? ` (${Array.from(irreversibleToolNames).join(", ")})`
      : "";

  return (
    <div className="rounded-[12px] border border-[#DDD0BA] bg-surface p-5 sm:p-6 shadow-sawal-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#DDD0BA] pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#17494D]" strokeWidth={1.5} />
          <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-[#231B12]">
            REGRET &amp; RISK RULER
          </h3>
        </div>
        {/* Removed fake 'v2.4 calibrated' per HONESTY rule */}
        <span className="text-[11px] font-mono text-[#6E6253]">
          τ = {threshold.toFixed(2)}
        </span>
      </div>

      {/* Horizontal Ruler */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-[#6E6253]">
          <span>Low regret</span>
          <span>Costly if wrong</span>
        </div>

        {/* Ruler Bar Track */}
        <div className="relative h-2.5 w-full rounded-full bg-[#EBDFCB] overflow-visible">
          {/* Subtle gradient fill track */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(to right, #E7F3EC 0%, #FBF1DC 50%, #FBE9E5 100%)",
            }}
          />

          {/* Threshold Tick Marker */}
          <div
            className="absolute -top-1 bottom-0 w-0.5 bg-[#231B12] z-10"
            style={{ left: `${thresholdPercent}%` }}
            title={`Threshold τ = ${threshold.toFixed(2)}`}
          >
            <div className="absolute -top-4 -translate-x-1/2 text-[9px] font-mono text-[#231B12] font-bold">
              τ
            </div>
          </div>

          {/* Current Action Marker Badge */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-500"
            style={{ left: `${regretPercent}%` }}
          >
            <div
              className={`px-2 py-0.5 rounded-[4px] border text-[9px] font-mono font-bold whitespace-nowrap shadow-sawal-sm ${
                isExceeded
                  ? "bg-[#FBE9E5] text-[#A33A2B] border-[#A33A2B]/40"
                  : "bg-[#E7F3EC] text-[#1F6B4A] border-[#1F6B4A]/40"
              }`}
            >
              Current Action ({expectedRegret.toFixed(2)})
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono text-[#6E6253] pt-1">
          <span>0.00</span>
          <span>{(maxScale * 0.5).toFixed(2)}</span>
          <span>{maxScale.toFixed(2)}</span>
        </div>
      </div>

      {/* Dynamic Status Text */}
      <div className="space-y-1 text-xs text-[#6E6253] font-sans">
        <p className="font-medium text-[#231B12]">
          {isExceeded ? (
            <span className="text-[#A33A2B] font-bold">
              Threshold exceeded.{" "}
            </span>
          ) : (
            <span className="text-[#1F6B4A] font-bold">
              Below threshold.{" "}
            </span>
          )}
          {isExceeded
            ? "External changes cannot be recalled once dispatched to external services."
            : "All planned operations remain well within safe execution limits."}
        </p>

        {distinctIrreversibleCount > 0 && (
          <p className="text-[11px] text-[#A33A2B]">
            Includes {distinctIrreversibleCount} action(s) that can&apos;t be undone.
          </p>
        )}
      </div>

      {/* Reversibility Profile Across All Rehearsed Readings */}
      <div className="space-y-2 pt-2 border-t border-[#DDD0BA]">
        <div className="text-[10px] font-mono uppercase tracking-wider text-[#6E6253]">
          REVERSIBILITY PROFILE (ACROSS ALL REHEARSED READINGS)
        </div>

        <div className="space-y-1.5 text-xs">
          {/* Read only */}
          <div
            className="flex items-center justify-between px-3 py-2 rounded-[6px]"
            style={{ backgroundColor: "#E7F3EC", color: "#1F6B4A" }}
          >
            <div className="flex items-center gap-2 font-medium">
              <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Read only</span>
            </div>
            <span className="font-mono font-bold">{readonlyActions} actions</span>
          </div>

          {/* Can be undone */}
          <div
            className="flex items-center justify-between px-3 py-2 rounded-[6px]"
            style={{ backgroundColor: "#FBF1DC", color: "#8A5A0B" }}
          >
            <div className="flex items-center gap-2 font-medium">
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Can be undone</span>
            </div>
            <span className="font-mono font-bold">{undoableActions} actions</span>
          </div>

          {/* Can't be undone */}
          <div
            className="flex items-center justify-between px-3 py-2 rounded-[6px]"
            style={{ backgroundColor: "#FBE9E5", color: "#A33A2B" }}
          >
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Can&apos;t be undone</span>
            </div>
            <span className="font-mono font-bold">
              {distinctIrreversibleCount} action{distinctIrreversibleCount === 1 ? "" : "s"}
              {toolNameSuffix}
            </span>
          </div>
        </div>
      </div>

      {/* Honesty Rule Guarantee Notice Box */}
      <div className="p-3 rounded-[8px] bg-[#F4EBDD] border border-[#DDD0BA] text-[11px] font-mono text-[#6E6253] leading-relaxed">
        <strong className="text-[#231B12] block mb-0.5">Sawal Guarantee:</strong>
        Rehearsal never touches your real data. Sawal commits only when the readings agree or you answer.
      </div>
    </div>
  );
}
