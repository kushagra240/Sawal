"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ChatTurn, Session, ToolMode, WorldDiffItem } from "./types";

interface HistoryEntry { session: Session; timestamp: number }

interface SessionContextValue {
  turns: ChatTurn[];
  activeTurnId: string | null;
  setActiveTurnId: React.Dispatch<React.SetStateAction<string | null>>;
  addTurn: (turn: ChatTurn) => void;
  updateTurn: (id: string, patch: Partial<ChatTurn>) => void;
  activeSession: Session | null;
  setActiveSession: React.Dispatch<React.SetStateAction<Session | null>>;
  history: HistoryEntry[];
  recordSession: (session: Session) => void;
  clearHistory: () => void;
  accumulatedWorldDiff: WorldDiffItem[];
  clearWorld: () => void;
  presenterMode: boolean;
  togglePresenterMode: () => void;
  isMockMode: boolean;
  toolMode: ToolMode;
  setToolMode: React.Dispatch<React.SetStateAction<ToolMode>>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [accumulatedWorldDiff, setAccumulatedWorldDiff] = useState<WorldDiffItem[]>([]);
  const [presenterMode, setPresenterMode] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>("mock");

  useEffect(() => {
    document.documentElement.classList.toggle("presenter-mode", presenterMode);
  }, [presenterMode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input, textarea")) return;
      if (event.key.toLowerCase() === "p") setPresenterMode((value) => !value);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const addTurn = useCallback((turn: ChatTurn) => setTurns((items) => [...items, turn]), []);
  const updateTurn = useCallback((id: string, patch: Partial<ChatTurn>) => {
    setTurns((items) => items.map((turn) => turn.id === id ? { ...turn, ...patch } : turn));
  }, []);
  const recordSession = useCallback((session: Session) => {
    const timestamp = Date.now();
    setHistory((items) => [
      { session, timestamp },
      ...items.filter((entry) => entry.session.session_id !== session.session_id),
    ]);
    if (session.result?.world_diff?.length) {
      setAccumulatedWorldDiff((items) => [...items, ...session.result!.world_diff]);
    }
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    turns,
    activeTurnId,
    setActiveTurnId,
    addTurn,
    updateTurn,
    activeSession,
    setActiveSession,
    history,
    recordSession,
    clearHistory: () => setHistory([]),
    accumulatedWorldDiff,
    clearWorld: () => setAccumulatedWorldDiff([]),
    presenterMode,
    togglePresenterMode: () => setPresenterMode((current) => !current),
    isMockMode: toolMode === "mock",
    toolMode,
    setToolMode,
  }), [turns, activeTurnId, addTurn, updateTurn, activeSession, history, recordSession, accumulatedWorldDiff, presenterMode, toolMode]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSessionContext must be used within SessionProvider");
  return context;
}
