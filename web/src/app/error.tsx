"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors
    console.error("Sawal Runtime Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F4EBDD]">
      <div className="max-w-md w-full rounded-[12px] border border-[#A33A2B]/30 bg-surface p-8 text-center space-y-4 shadow-sawal-md">
        <div className="w-12 h-12 rounded-full bg-[#FBE9E5] flex items-center justify-center mx-auto text-[#A33A2B]">
          <AlertTriangle className="w-6 h-6" strokeWidth={1.5} />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-mono uppercase tracking-wider text-[#A33A2B] font-bold">
            APPLICATION ERROR
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#231B12]">
            Something unexpected occurred.
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6253] font-sans">
            {error.message || "An unhandled client runtime exception was captured."}
          </p>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#17494D] text-white text-xs font-semibold hover:bg-[#0F3639] transition-colors shadow-sawal-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] border border-[#DDD0BA] bg-surface text-xs font-semibold text-[#231B12] hover:bg-[#EBDFCB] transition-colors shadow-sawal-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Back to Assistant</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
