"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Link2, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { connectGoogle, disconnectGoogle, fetchConnections } from "@/lib/api";
import { ConnectionStatus, ToolMode } from "@/lib/types";

interface Props {
  toolMode: ToolMode;
  onToolModeChange: (mode: ToolMode) => void;
  disabled?: boolean;
}

export function ConnectedAccountsPanel({ toolMode, onToolModeChange, disabled }: Props) {
  const [google, setGoogle] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchConnections()
      .then((connections) => {
        if (!active) return;
        setGoogle(connections.find((item) => item.provider === "google") || null);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load connections.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const disconnect = async () => {
    setLoading(true);
    try {
      await disconnectGoogle();
      onToolModeChange("mock");
      const connections = await fetchConnections();
      setGoogle(connections.find((item) => item.provider === "google") || null);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect Google.");
      setLoading(false);
    }
  };

  return (
    <section className="mb-5 rounded-[12px] border border-[#DDD0BA] bg-surface px-4 py-3 shadow-sawal-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-[8px] bg-[#DCE9E6] text-[#17494D] flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#231B12]">Connected accounts</h2>
            {google?.connected && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#19583D]">
                <CheckCircle2 className="w-3 h-3" /> CONNECTED
              </span>
            )}
          </div>
          <p className="text-xs text-[#6E6253] truncate">
            {google?.connected ? google.account_email || "Google account authorized" : "Google is required for live Gmail, Contacts, and Calendar actions."}
          </p>
          {error && <p className="text-[11px] text-[#912D1F] mt-1">{error}</p>}
          {google?.connected && google.credential_storage_persistent === false && (
            <p className="text-[11px] text-[#912D1F] mt-1">Set SAWAL_TOKEN_ENCRYPTION_KEY before production use.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-[8px] border border-[#DDD0BA] bg-[#F4EBDD] p-0.5" role="group" aria-label="Tool execution mode">
          {(["mock", "live"] as ToolMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={disabled || (mode === "live" && !google?.connected)}
              onClick={() => onToolModeChange(mode)}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-mono font-semibold uppercase transition-colors disabled:opacity-40 ${toolMode === mode ? "bg-[#17494D] text-surface" : "text-[#6E6253]"}`}
            >
              {mode}
            </button>
          ))}
        </div>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#6E6253]" />
        ) : google?.connected ? (
          <button type="button" onClick={disconnect} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#DDD0BA] text-xs font-semibold text-[#912D1F] hover:bg-[#FBE9E5]">
            <LogOut className="w-3.5 h-3.5" /> Disconnect
          </button>
        ) : (
          <button type="button" onClick={() => void connectGoogle().catch((err) => setError(err instanceof Error ? err.message : "Could not start Google OAuth."))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#17494D] text-surface text-xs font-semibold hover:bg-[#0F3639]">
            <Link2 className="w-3.5 h-3.5" /> Connect Google
          </button>
        )}
      </div>
    </section>
  );
}
