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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Assistant</span>
          </Link>
          <div className="h-5 w-px bg-neutral-300 dark:bg-neutral-700" />
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl sm:text-2xl font-black text-neutral-950 dark:text-white tracking-tight">
              Sawal Policy Benchmark
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sourceType !== "none" && (
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* SAMPLE DATA BANNER (Prominent Red Warning) */}
      {isSample && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-rose-600 bg-rose-600 text-white p-4 sm:p-5 shadow-lg flex items-center gap-3 animate-in fade-in"
        >
          <AlertOctagon className="w-7 h-7 shrink-0 text-white animate-bounce" />
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-black tracking-wide uppercase">
              SAMPLE DATA, NOT A REAL RUN
            </h2>
            <p className="text-xs sm:text-sm text-rose-100">
              This benchmark view is displaying synthetic demonstration data loaded from{" "}
              <code className="bg-rose-800 px-1 py-0.5 rounded text-white font-mono">
                public/benchmark_results.sample.json
              </code>
              . These numbers are illustrative placeholders and not experimental results.
            </p>
          </div>
        </div>
      )}

      {/* Content States */}
      {isLoading ? (
        <div className="p-12 text-center rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Checking benchmark data sources (API &rarr; file &rarr; sample)...
          </p>
        </div>
      ) : benchmarkData ? (
        <BenchmarkChart data={benchmarkData} />
      ) : (
        /* Empty State */
        <div className="p-10 sm:p-14 text-center rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/60 space-y-4">
          <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
            <FileQuestion className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              No benchmark run yet
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
              Neither the live endpoint (<code>/api/v1/benchmark/summary</code>) nor a real run file (
              <code>public/benchmark_results.json</code>) was found.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/benchmark?sample=1"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors"
            >
              <Database className="w-4 h-4" />
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
        <div className="p-12 text-center text-sm text-neutral-500">
          Loading benchmark view...
        </div>
      }
    >
      <BenchmarkContent />
    </Suspense>
  );
}
