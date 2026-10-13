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
  always_act: "#A33A2B", // Red / Can't be undone
  always_ask: "#8A5A0B", // Amber / Can be undone
  ask_if_model_unsure: "#6B665E", // Muted Ink
  sawal: "#17494D", // Accent Teal
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
      <div className="rounded-[12px] border border-[#E8E2D8] bg-white p-5 sm:p-6 shadow-sawal-sm">
        <div className="mb-4">
          <h3 className="text-base sm:text-lg font-serif font-bold text-[#1C1B19]">
            Pareto Frontier: Questions Asked vs. Wrong Action Rate
          </h3>
          <p className="text-xs sm:text-sm text-[#6B665E] font-sans">
            Lower is better on both axes. Sawal traces the regret frontier as threshold &tau; is swept.
          </p>
        </div>

        <div className="w-full h-80 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D8" opacity={0.6} />
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
                  fill: "#6B665E",
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
                  fill: "#6B665E",
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="rounded-[8px] border border-[#E8E2D8] bg-white p-3 shadow-sawal-md text-xs space-y-1">
                      <div className="font-bold text-[#1C1B19] font-serif">
                        {item.name || `Sawal Sweep (τ = ${item.tau ?? "N/A"})`}
                      </div>
                      <div className="text-[#6B665E]">
                        Questions / Task:{" "}
                        <span className="font-mono font-semibold text-[#1C1B19]">
                          {(item.questions_per_task * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-[#6B665E]">
                        Wrong Action Rate:{" "}
                        <span className="font-mono font-semibold text-[#1C1B19]">
                          {(item.wrong_action_rate * 100).toFixed(1)}%
                        </span>
                      </div>
                      {item.irreversible_error_rate !== undefined && (
                        <div className="text-[#6B665E]">
                          Irreversible Error Rate:{" "}
                          <span className="font-mono font-semibold text-[#A33A2B]">
                            {(item.irreversible_error_rate * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />

              {/* Sawal Sweep Curve in Accent Teal */}
              <Line
                data={sweepCurve}
                dataKey="wrong_action_rate"
                type="monotone"
                stroke="#17494D"
                strokeWidth={2.5}
                name="Sawal Tau Sweep (Pareto Curve)"
                dot={{ r: 4, fill: "#17494D" }}
                activeDot={{ r: 6 }}
              />

              {/* Discrete Baseline Points */}
              <Scatter
                data={policyPoints}
                name="Evaluated Policies"
                fill="#17494D"
                shape={(props: { cx?: number; cy?: number; payload?: unknown }) => {
                  const { cx, cy, payload } = props;
                  const pointData = payload as { policyKey?: PolicyName } | undefined;
                  const color =
                    (pointData?.policyKey && POLICY_COLORS[pointData.policyKey]) || "#17494D";
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={7}
                      fill={color}
                      stroke="#FFFFFF"
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
      <div className="rounded-[12px] border border-[#E8E2D8] bg-white overflow-hidden shadow-sawal-sm">
        <div className="px-5 py-4 border-b border-[#E8E2D8] flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm sm:text-base font-serif font-bold text-[#1C1B19]">
            Policy Evaluation Metrics Summary
          </h4>
          <span className="text-xs font-mono text-[#6B665E]">
            Evaluated across {data.meta.n_tasks} tasks ({data.meta.model})
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#E8E2D8] text-[#6B665E] uppercase tracking-wider font-mono font-semibold text-[11px] bg-[#FBF8F3]">
                <th className="py-3 px-4">Policy</th>
                <th className="py-3 px-4 text-right">Questions / Task</th>
                <th className="py-3 px-4 text-right">Wrong Action Rate</th>
                <th className="py-3 px-4 text-right">Unnecessary Question Rate</th>
                <th className="py-3 px-4 text-right">Irreversible Error Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E2D8]">
              {data.policies.map((p) => {
                const isSawal = p.name === "sawal";
                return (
                  <tr
                    key={p.name}
                    className={`transition-colors ${
                      isSawal ? "bg-[#E6EFEE]/50 font-medium" : "hover:bg-[#FBF8F3]"
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: POLICY_COLORS[p.name] }}
                        />
                        <span className="font-semibold text-[#1C1B19]">
                          {POLICY_LABELS[p.name] || p.name}
                        </span>
                        {isSawal && (
                          <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-bold bg-[#17494D] text-white uppercase">
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
                    <td className="py-3 px-4 text-right font-mono text-[#A33A2B] font-bold">
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
