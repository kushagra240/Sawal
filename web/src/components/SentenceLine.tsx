"use client";

import React from "react";
import { Session } from "@/lib/types";

interface SentenceLineProps {
  session: Session | null;
}

export function SentenceLine({ session }: SentenceLineProps) {
  if (!session) return null;

  const totalReadings = session.interpretations.length;
  const numGroups = session.groups.length;
  const isAct = session.decision?.action === "act" || session.status === "completed";
  const isPending = session.status === "awaiting_confirmation" || session.status === "ready" || session.status === "executing";

  // Check if any effect is irreversible
  const hasIrreversible = session.groups.some((g) =>
    g.effects.some((e) => e.reversibility === "irreversible")
  );

  let prefixText = "";
  let underlinedText = "";

  if (isPending) {
    prefixText = `Sawal rehearsed ${totalReadings} readings and prepared one exact live plan, `;
    underlinedText = session.status === "executing" ? "execution is in progress." : "nothing runs until you confirm.";
  } else if (session.status === "cancelled") {
    prefixText = "The proposed live action was cancelled, ";
    underlinedText = "nothing was executed.";
  } else if (session.status === "failed") {
    prefixText = "The live provider did not complete the action, ";
    underlinedText = "no success is being claimed.";
  } else if (isAct) {
    if (numGroups <= 1) {
      prefixText = `All ${totalReadings} readings lead to the same outcome, `;
      underlinedText = "so I'm acting.";
    } else {
      prefixText = `${totalReadings} readings across ${numGroups} outcomes, but all effects can be undone, `;
      underlinedText = "so I'm acting.";
    }
  } else {
    // ASK state
    if (hasIrreversible) {
      prefixText = `${totalReadings} readings, ${numGroups} different outcomes. One of them can't be undone, `;
      underlinedText = "so I'm asking.";
    } else {
      prefixText = `${totalReadings} readings, ${numGroups} different outcomes with divergent side effects, `;
      underlinedText = "so I'm asking.";
    }
  }

  return (
    <div className="py-2">
      <h2 className="text-xl sm:text-2xl font-serif italic text-[#231B12] tracking-tight leading-relaxed">
        &ldquo;{prefixText}
        <span className="underline decoration-2 decoration-[#17494D] underline-offset-4 text-[#17494D]">
          {underlinedText}
        </span>
        &rdquo;
      </h2>
    </div>
  );
}
