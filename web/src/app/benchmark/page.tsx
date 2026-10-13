"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertOctagon,
  ArrowLeft,
  BarChart2,
  Database,
  FileQuestion,
  RefreshCw,
} from "lucide-react";
import { BenchmarkChart } from "@/components/BenchmarkChart";
import { fetchBenchmarkData } from "@/lib/api";
import { BenchmarkSummary } from "@/lib/types";

function BenchmarkContent() {
  const searchParams = useSearchParams();
  const sampleParam = searchParams.get("sample") === "1";

  const [benchmarkData, setBenchmarkData] = useState<BenchmarkSummary | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [sourceType, setSourceType] = useState<"live" | "file" | "sample" | "none">("none");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    fetchBenchmarkData(sampleParam)
      .then((res) => {
        if (!isCancelled) {
          setBenchmarkData(res.summary);
          setIsSample(res.isSample);
          setSourceType(res.source);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setBenchmarkData(null);
          setIsSample(false);
          setSourceType("none");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [sampleParam, refreshKey]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DDD0BA] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#DDD0BA] bg-surface text-xs sm:text-sm font-semibold text-[#231B12] hover:border-[#17494D] transition-colors shadow-sawal-sm"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>Back to Assistant</span>
          </Link>
          <div className="h-5 w-px bg-[#DDD0BA]" />
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-[#17494D]" strokeWidth={1.5} />
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#231B12] tracking-tight">
              Sawal Policy Benchmark
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sourceType !== "none" && (
            <span className="text-xs font-mono px-2.5 py-1 rounded-[6px] bg-[#EBDFCB] border border-[#DDD0BA] text-[#6E6253]">
              Source: {sourceType}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setRefreshKey((k) => k + 1);
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#DDD0BA] bg-surface text-xs sm:text-sm font-medium text-[#231B12] hover:bg-[#F4EBDD] transition-colors cursor-pointer shadow-sawal-sm disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
              strokeWidth={1.5}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* SAMPLE DATA BANNER (Prominent Red Warning) */}
      {isSample && (
        <div
          role="alert"
          className="rounded-[12px] border-2 border-[#A33A2B] bg-[#A33A2B] text-surface p-4 sm:p-5 shadow-sawal-md flex items-center gap-3.5"
        >
          <AlertOctagon className="w-7 h-7 shrink-0 text-surface" strokeWidth={1.5} />
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-mono font-black tracking-wide uppercase">
              SAMPLE DATA, NOT A REAL RUN
            </h2>
            <p className="text-xs sm:text-sm text-rose-100 font-sans">
              This benchmark view is displaying synthetic demonstration data loaded from{" "}
              <code className="bg-[#782316] px-1.5 py-0.5 rounded text-surface font-mono">
                public/benchmark_results.sample.json
              </code>
              . These numbers are illustrative placeholders and not experimental results.
            </p>
          </div>
        </div>
      )}

      {/* DETERMINISTIC MOCK PROPOSER BANNER */}
      {benchmarkData?.execution_mode === "deterministic_mock" && (
        <div
          role="alert"
          className="rounded-[12px] border border-[#734706] bg-[#FBF1DC] p-4 sm:p-5 shadow-sawal-md space-y-2 text-[#231B12]"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#734706]" />
            <h2 className="text-sm sm:text-base font-mono font-bold tracking-wide uppercase text-[#734706]">
              Deterministic mock proposer. These numbers test the engine, not a language model
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#6E6253]">
            {benchmarkData.tasks_count !== undefined && (
              <span>
                Tasks: <strong className="text-[#231B12]">{benchmarkData.tasks_count}</strong>
              </span>
            )}
            {benchmarkData.timestamp && (
              <span>
                Timestamp: <strong className="text-[#231B12]">{benchmarkData.timestamp}</strong>
              </span>
            )}
            {benchmarkData.note && (
              <span>
                Note: <strong className="text-[#231B12]">{benchmarkData.note}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content States */}
      {isLoading ? (
        <div className="p-12 text-center rounded-[12px] border border-[#DDD0BA] bg-surface space-y-3">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[#17494D]" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-[#231B12]">
            Checking benchmark data sources (API &rarr; file &rarr; sample)...
          </p>
        </div>
      ) : benchmarkData ? (
        <BenchmarkChart data={benchmarkData} />
      ) : (
        /* Empty State */
        <div className="p-10 sm:p-14 text-center rounded-[12px] border-2 border-dashed border-[#DDD0BA] bg-surface/60 space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#EBDFCB] flex items-center justify-center mx-auto text-[#6E6253]">
            <FileQuestion className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-serif font-bold text-[#231B12]">
              No benchmark run yet
            </h3>
            <p className="text-xs sm:text-sm text-[#6E6253] max-w-md mx-auto">
              Neither the live endpoint (<code>/api/v1/benchmark/summary</code>) nor a real run file (
              <code>public/benchmark_results.json</code>) was found.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/benchmark?sample=1"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#17494D] hover:bg-[#0F3639] text-white text-xs sm:text-sm font-semibold shadow-sawal-sm transition-colors"
            >
              <Database className="w-4 h-4" strokeWidth={1.5} />
              <span>Preview with Sample Data (?sample=1)</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BenchmarkPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs font-mono text-[#6E6253]">
          Loading benchmark view...
        </div>
      }
    >
      <BenchmarkContent />
    </Suspense>
  );
}
