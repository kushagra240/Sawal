"use client";

import React from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BenchmarkSummary, PolicyName } from "@/lib/types";

interface BenchmarkChartProps {
  data: BenchmarkSummary;
}

const POLICY_LABELS: Record<PolicyName, string> = {
  always_act: "Always Act (0 Questions)",
  always_ask: "Always Ask (100% Interruption)",
  ask_if_model_unsure: "Ask if Model Unsure (Confidence Threshold)",
  sawal: "Sawal (Regret-Optimal Rehearsal)",
};

const POLICY_COLORS: Record<PolicyName, string> = {
  always_act: "#dc2626", // Red
  always_ask: "#d97706", // Amber
  ask_if_model_unsure: "#8b5cf6", // Purple
  sawal: "#10b981", // Emerald / Green
};

export function BenchmarkChart({ data }: BenchmarkChartProps) {
  // Sort sweep data by questions_per_task ascending for smooth curve
  const sweepCurve = [...data.sweep].sort(
    (a, b) => a.questions_per_task - b.questions_per_task
  );

  // Discrete policy points for scatter overlay
  const policyPoints = data.policies.map((p) => ({
    name: POLICY_LABELS[p.name] || p.name,
    policyKey: p.name,
    questions_per_task: p.questions_per_task,
    wrong_action_rate: p.wrong_action_rate,
    unnecessary_question_rate: p.unnecessary_question_rate,
    irreversible_error_rate: p.irreversible_error_rate,
  }));

  return (
    <div className="space-y-6">
      {/* Chart container */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-6 shadow-xs">
        <div className="mb-4">
          <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
            Pareto Frontier: Questions Asked vs. Wrong Action Rate
          </h3>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
            Lower is better on both axes. Sawal traces the regret frontier as threshold τ is swept.
          </p>
        </div>

        <div className="w-full h-80 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis
                type="number"
                dataKey="questions_per_task"
                name="Questions per Task"
                domain={[0, 1.05]}
                tickCount={6}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                label={{
                  value: "Questions per Task (Interruption Burden →)",
                  position: "insideBottom",
                  offset: -15,
                  fontSize: 12,
                  fill: "#6b7280",
                }}
              />
              <YAxis
                type="number"
                dataKey="wrong_action_rate"
                name="Wrong Action Rate"
                domain={[0, 0.5]}
                tickCount={6}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                label={{
                  value: "Wrong Action Rate (Error Rate ↑)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 0,
                  fontSize: 12,
                  fill: "#6b7280",
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 shadow-lg text-xs space-y-1">
                      <div className="font-bold text-neutral-900 dark:text-white">
                        {item.name || `Sawal Sweep (τ = ${item.tau ?? "N/A"})`}
                      </div>
                      <div className="text-neutral-600 dark:text-neutral-400">
                        Questions / Task:{" "}
                        <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                          {(item.questions_per_task * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-neutral-600 dark:text-neutral-400">
                        Wrong Action Rate:{" "}
                        <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                          {(item.wrong_action_rate * 100).toFixed(1)}%
                        </span>
                      </div>
                      {item.irreversible_error_rate !== undefined && (
                        <div className="text-neutral-600 dark:text-neutral-400">
                          Irreversible Error Rate:{" "}
                          <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                            {(item.irreversible_error_rate * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />

              {/* Sawal Sweep Curve */}
              <Line
                data={sweepCurve}
                dataKey="wrong_action_rate"
                type="monotone"
                stroke="#10b981"
                strokeWidth={3}
                name="Sawal Tau Sweep (Pareto Curve)"
                dot={{ r: 4, fill: "#10b981" }}
                activeDot={{ r: 6 }}
              />

              {/* Discrete Baseline Points */}
              <Scatter
                data={policyPoints}
                name="Evaluated Policies"
                fill="#6366f1"
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  const color =
                    POLICY_COLORS[payload.policyKey as PolicyName] || "#6366f1";
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={7}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Metrics Table */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <h4 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
            Policy Evaluation Metrics Summary
          </h4>
          <span className="text-xs text-neutral-500 font-medium">
            Evaluated across {data.meta.n_tasks} tasks ({data.meta.model})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-semibold text-[11px] bg-neutral-50 dark:bg-neutral-850">
                <th className="py-3 px-4">Policy</th>
                <th className="py-3 px-4 text-right">Questions / Task</th>
                <th className="py-3 px-4 text-right">Wrong Action Rate</th>
                <th className="py-3 px-4 text-right">Unnecessary Question Rate</th>
                <th className="py-3 px-4 text-right">Irreversible Error Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {data.policies.map((p) => {
                const isSawal = p.name === "sawal";
                return (
                  <tr
                    key={p.name}
                    className={`transition-colors ${
                      isSawal
                        ? "bg-emerald-50/50 dark:bg-emerald-950/20 font-medium"
                        : "hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30"
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: POLICY_COLORS[p.name] }}
                        />
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {POLICY_LABELS[p.name] || p.name}
                        </span>
                        {isSawal && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white uppercase">
                            Target
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {(p.questions_per_task * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {(p.wrong_action_rate * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {(p.unnecessary_question_rate * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 dark:text-rose-400 font-bold">
                      {(p.irreversible_error_rate * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
