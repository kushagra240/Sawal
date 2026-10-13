"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: "P", desc: "Toggle Presenter mode (scale 1.25x, hide secondary chrome)" },
    { key: "/", desc: "Focus natural language request input" },
    { key: "1 – 5", desc: "Run example prompt chip or choose option in Ask card" },
    { key: "R", desc: "Replay rehearsal thread animation" },
    { key: "Enter", desc: "Confirm action or run request" },
    { key: "?", desc: "Open this keyboard shortcuts list" },
    { key: "Esc", desc: "Close modal / dialog" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-50 bg-[#1C1B19]/30 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-[12px] bg-white border border-[#E8E2D8] p-6 shadow-sawal-md space-y-4">
        <div className="flex items-center justify-between border-b border-[#E8E2D8] pb-3">
          <h3
            id="shortcuts-title"
            className="text-base font-bold font-serif text-[#1C1B19]"
          >
            Keyboard Shortcuts
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#6B665E] hover:text-[#1C1B19] p-1 rounded-[6px] hover:bg-[#F4EFE7] transition-colors cursor-pointer"
            aria-label="Close shortcuts"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="divide-y divide-[#E8E2D8] text-xs">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
              <span className="text-[#6B665E] font-medium">{s.desc}</span>
              <kbd className="px-2 py-1 rounded-[6px] bg-[#F4EFE7] border border-[#E8E2D8] font-mono text-[11px] font-bold text-[#1C1B19] shrink-0">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-[8px] bg-[#17494D] text-white hover:bg-[#0F3639] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
