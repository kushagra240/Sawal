"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Question } from "@/lib/types";

interface QuestionNoteProps {
  question: Question;
  isAnswering: boolean;
  onAnswer: (answer: { option_id?: string; free_text?: string }) => void;
  onOptionHover?: (groupId: string | null) => void;
  onOptionSelect?: (groupId: string | null) => void;
  optionGroupMap?: Record<string, string>; // option_id -> group_id
  hasIrreversibleInGroup?: (groupId: string) => boolean;
}

export function QuestionNote({
  question,
  isAnswering,
  onAnswer,
  onOptionHover,
  onOptionSelect,
  optionGroupMap = {},
  hasIrreversibleInGroup,
}: QuestionNoteProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    question.options[0]?.id || null
  );
  const [customText, setCustomText] = useState("");

  const activeOption = question.options.find((o) => o.id === selectedOptionId);
  const activeGroupId = activeOption ? optionGroupMap[activeOption.id] : null;
  const isIrreversible = activeGroupId && hasIrreversibleInGroup
    ? hasIrreversibleInGroup(activeGroupId)
    : true; // Default to requiring confirmation for high stakes

  // Notify parent of initial selection
  useEffect(() => {
    if (activeGroupId && onOptionSelect) {
      onOptionSelect(activeGroupId);
    }
  }, [activeGroupId, onOptionSelect]);

  // Keys 1 and 2 to select options, Enter to confirm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;

      if (e.key === "1" && question.options[0]) {
        e.preventDefault();
        handleSelectOption(question.options[0].id);
      } else if (e.key === "2" && question.options[1]) {
        e.preventDefault();
        handleSelectOption(question.options[1].id);
      } else if (e.key === "Enter" && selectedOptionId && !isAnswering) {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [question.options, selectedOptionId, isAnswering]);

  const handleSelectOption = (optionId: string) => {
    setSelectedOptionId(optionId);
    const gid = optionGroupMap[optionId] || null;
    if (onOptionSelect) onOptionSelect(gid);
  };

  const handleConfirm = () => {
    if (!selectedOptionId || isAnswering) return;
    onAnswer({ option_id: selectedOptionId });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim() || isAnswering) return;
    onAnswer({ free_text: customText.trim() });
  };

  return (
    <div className="folded-corner rounded-[12px] border border-[#E8E2D8] bg-white p-6 shadow-sawal-sm space-y-5 transition-all">
      {/* Top Header Tag */}
      <div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#1C1B19] text-[#FBF8F3] text-[10px] font-mono tracking-wider uppercase font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#17494D]" />
          <span>CLARIFICATION NEEDED</span>
        </span>
      </div>

      {/* Main Question in Fraunces */}
      <div className="space-y-1">
        <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#1C1B19] leading-tight">
          {question.text}
        </h3>
        <p className="text-xs sm:text-sm text-[#6B665E] font-sans">
          You have multiple candidate records matching this request in your workspace history.
        </p>
      </div>

      {/* Option Cards */}
      <div className="space-y-3" role="radiogroup" aria-label={question.text}>
        {question.options.map((opt) => {
          const isSelected = selectedOptionId === opt.id;
          const optGroupId = optionGroupMap[opt.id] || null;

          return (
            <div
              key={opt.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => handleSelectOption(opt.id)}
              onMouseEnter={() => onOptionHover && onOptionHover(optGroupId)}
              onMouseLeave={() => onOptionHover && onOptionHover(null)}
              onFocus={() => onOptionHover && onOptionHover(optGroupId)}
              onBlur={() => onOptionHover && onOptionHover(null)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  handleSelectOption(opt.id);
                }
              }}
              className={`p-4 rounded-[12px] border transition-all cursor-pointer relative ${
                isSelected
                  ? "border-[#17494D] bg-[#FBF8F3] ring-2 ring-[#17494D]/20 shadow-sawal-sm"
                  : "border-[#E8E2D8] bg-white hover:border-[#6B665E] hover:bg-[#FBF8F3]/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  {/* Matched readings pill */}
                  {opt.matched !== undefined && (
                    <span className="inline-block text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-[#F4EFE7] text-[#1C1B19] font-medium mb-1">
                      {opt.matched} readings matched
                    </span>
                  )}

                  {/* Label in bold */}
                  <h4 className="text-base font-bold font-sans text-[#1C1B19]">
                    {opt.label}
                  </h4>

                  {/* Description */}
                  {opt.description && (
                    <p className="text-xs text-[#6B665E] font-sans">
                      {opt.description}
                    </p>
                  )}

                  {/* Meta items */}
                  {opt.meta && opt.meta.length > 0 && (
                    <div className="pt-1 space-y-0.5 text-[11px] font-mono text-[#6B665E]">
                      {opt.meta.map((m, mIdx) => (
                        <div key={mIdx}>{m}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Radio indicator */}
                <div className="shrink-0 pt-1">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "border-[#17494D] bg-white"
                        : "border-[#E8E2D8] bg-transparent"
                    }`}
                  >
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-[#17494D]" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explicit Confirm & Act Button (for irreversible options) */}
      {selectedOptionId && (
        <div className="pt-1">
          <button
            type="button"
            disabled={isAnswering}
            onClick={handleConfirm}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[8px] bg-[#17494D] hover:bg-[#0F3639] text-white text-sm font-semibold shadow-sawal-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isAnswering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                <span>Committing action...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" strokeWidth={1.5} />
                <span>
                  {isIrreversible ? "Confirm and act" : "Select and proceed"}
                </span>
                <span className="text-[11px] font-mono opacity-70 ml-1">(Enter)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Or Specify Input */}
      <form onSubmit={handleCustomSubmit} className="pt-3 border-t border-[#E8E2D8]">
        <label
          htmlFor="specify-input"
          className="block text-[11px] font-mono uppercase tracking-wider text-[#6B665E] mb-1.5"
        >
          or specify:
        </label>
        <div className="relative flex items-center">
          <input
            id="specify-input"
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Type another recipient or clarify instruction..."
            disabled={isAnswering}
            className="w-full rounded-[8px] border border-[#E8E2D8] bg-white px-3.5 py-2.5 pr-12 text-xs sm:text-sm text-[#1C1B19] placeholder-[#6B665E]/60 shadow-sawal-sm focus:border-[#17494D] focus:outline-none focus:ring-1 focus:ring-[#17494D]"
          />
          <button
            type="submit"
            disabled={isAnswering || !customText.trim()}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-2.5 bg-[#F4EFE7] hover:bg-[#E8E2D8] text-[#1C1B19] rounded-[6px] text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
            aria-label="Submit specific instruction"
          >
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </form>
    </div>
  );
}
