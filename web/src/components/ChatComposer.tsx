"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";

export const EXAMPLE_PROMPTS = [
  "Check my calendar for tomorrow afternoon.",
  "Find a quiet spot for team lunch near campus.",
  "Send an email to Priya confirming the lab slot.",
  "Draft a note to the study group and log forty rupees for tea.",
  "Book the seminar hall for a group meeting.",
];

interface ChatComposerProps {
  onSendMessage: (text: string) => void;
  onSendAnswerText?: (text: string) => void;
  isQuestionPending?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ChatComposer({
  onSendMessage,
  onSendAnswerText,
  isQuestionPending = false,
  isLoading = false,
  disabled = false,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const [isExamplesOpen, setIsExamplesOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autofocus on load
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Global '/' keyboard shortcut to focus composer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        Math.max(textareaRef.current.scrollHeight, 44),
        160
      )}px`;
    }
  }, [text]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isLoading || disabled) return;

    if (isQuestionPending && onSendAnswerText) {
      onSendAnswerText(trimmed);
    } else {
      onSendMessage(trimmed);
    }
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectChip = (prompt: string) => {
    if (isLoading || disabled) return;
    onSendMessage(prompt);
    setIsExamplesOpen(false);
  };

  const placeholder = isQuestionPending
    ? "Answer Sawal, or type your own..."
    : "Message Sawal... e.g. Send an email to Priya confirming the lab slot";

  return (
    <div className="w-full bg-paper pt-2 pb-3 px-3 border-t border-[#DDD0BA]/70">
      {/* Collapsible 'Try an example' row */}
      <div className="mb-2">
        <button
          type="button"
          onClick={() => setIsExamplesOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#6E6253] hover:text-[#231B12] transition-colors focus:outline-none focus:ring-1 focus:ring-[#17494D] rounded px-1.5 py-0.5"
          aria-expanded={isExamplesOpen}
        >
          <Lightbulb className="w-3 h-3 text-[#17494D]" />
          <span>Try an example</span>
          {isExamplesOpen ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>

        {isExamplesOpen && (
          <div className="mt-2 p-2 rounded-[8px] bg-sunken/60 border border-[#DDD0BA] flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {EXAMPLE_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectChip(prompt)}
                disabled={isLoading || disabled}
                className="text-left text-xs font-sans text-[#231B12] bg-surface hover:bg-[#DCE9E6] hover:border-[#17494D]/30 border border-[#DDD0BA] rounded-[8px] px-2.5 py-1.5 transition-all shadow-sawal-sm leading-snug cursor-pointer disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Composer Box */}
      <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
        <div className="relative flex-1 rounded-[16px] border border-[#DDD0BA] bg-surface shadow-sawal-sm focus-within:border-[#17494D] focus-within:ring-1 focus-within:ring-[#17494D] transition-all">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled || isLoading}
            className="w-full resize-none bg-transparent px-4 py-3 text-sm font-sans text-[#231B12] placeholder-[#6E6253]/70 focus:outline-none leading-relaxed min-h-[46px] max-h-[160px] block"
          />

          <div className="flex items-center justify-between px-3 pb-2 pt-0 text-[10px] font-mono text-[#6E6253]">
            <span className="hidden sm:inline">
              <kbd className="px-1 py-0.5 bg-sunken rounded border border-[#DDD0BA]">/</kbd> focus · <kbd className="px-1 py-0.5 bg-sunken rounded border border-[#DDD0BA]">Enter</kbd> send · <kbd className="px-1 py-0.5 bg-sunken rounded border border-[#DDD0BA]">Shift+Enter</kbd> line
            </span>
            <span className="sm:hidden">
              <kbd className="px-1 py-0.5 bg-sunken rounded border border-[#DDD0BA]">Enter</kbd> send
            </span>
          </div>
        </div>

        {/* Round Primary Send Button */}
        <button
          type="submit"
          disabled={!text.trim() || isLoading || disabled}
          aria-label="Send message"
          className="w-11 h-11 shrink-0 rounded-full bg-[#17494D] hover:bg-[#0F3639] disabled:opacity-40 disabled:cursor-not-allowed text-surface flex items-center justify-center transition-all shadow-sawal-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#17494D] focus:ring-offset-2"
        >
          <ArrowUp className="w-5 h-5 stroke-[2]" />
        </button>
      </form>
    </div>
  );
}
