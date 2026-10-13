import React from "react";
import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FBF8F3]">
      <div className="max-w-md w-full rounded-[12px] border border-[#E8E2D8] bg-white p-8 text-center space-y-4 shadow-sawal-sm">
        <div className="w-12 h-12 rounded-full bg-[#F4EFE7] flex items-center justify-center mx-auto text-[#6B665E]">
          <FileQuestion className="w-6 h-6" strokeWidth={1.5} />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-mono uppercase tracking-wider text-[#17494D] font-bold">
            404 · PAGE NOT FOUND
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#1C1B19]">
            This route does not exist.
          </h1>
          <p className="text-xs sm:text-sm text-[#6B665E] font-sans">
            The requested URL was not found in the Sawal assistant harness.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#17494D] text-white text-xs font-semibold hover:bg-[#0F3639] transition-colors shadow-sawal-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Return to Assistant</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
