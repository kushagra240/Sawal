"use client";

import React from "react";
import { Ban, Check, Loader2, ShieldAlert } from "lucide-react";
import { Session } from "@/lib/types";

interface Props {
  session: Session;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ActionConfirmation({ session, busy, onConfirm, onCancel }: Props) {
  const action = session.action;
  if (!action || session.status !== "awaiting_confirmation") return null;

  return (
    <section className="rounded-[12px] border-2 border-[#A33A2B] bg-surface p-5 shadow-sawal-md space-y-4" aria-label="Action confirmation">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#FBE9E5] text-[#912D1F] flex items-center justify-center shrink-0">
          <ShieldAlert className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div>
          <span className="text-[10px] font-mono font-black tracking-wider text-[#912D1F]">AWAITING EXPLICIT CONFIRMATION</span>
          <h3 className="text-xl font-serif font-bold text-[#231B12]">Review the exact live action</h3>
          <p className="text-xs text-[#6E6253] mt-1">Nothing below has been executed yet.</p>
        </div>
      </div>

      <div className="space-y-2">
        {action.preview.items.map((item) => (
          <div key={`${item.position}-${item.tool}`} className="rounded-[8px] border border-[#DDD0BA] bg-[#F4EBDD] p-3 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-[#17494D]">{item.tool}</span>
              <span className="font-mono text-[10px] text-[#6E6253]">{item.provider || "provider"}</span>
            </div>
            {item.to && <p><span className="text-[#6E6253]">To:</span> {item.to}</p>}
            {item.subject && <p><span className="text-[#6E6253]">Subject:</span> {item.subject}</p>}
            {item.body && <p className="whitespace-pre-wrap"><span className="text-[#6E6253]">Body:</span> {item.body}</p>}
          </div>
        ))}
      </div>

      <p className="text-[11px] font-mono text-[#6E6253]">{action.preview.warning}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" disabled={busy} onClick={onConfirm} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#A33A2B] text-surface text-sm font-bold disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Confirm exact action
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] border border-[#DDD0BA] text-[#231B12] text-sm font-semibold disabled:opacity-50">
          <Ban className="w-4 h-4" /> Cancel
        </button>
      </div>
    </section>
  );
}
