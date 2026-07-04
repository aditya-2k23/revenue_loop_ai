"use client";

import { useMemo, useState, useRef, type FormEvent } from "react";
import { FileInput } from "@/components/FileInput";
import { StatCard } from "@/components/StatCard";
import { DivergenceChart } from "@/components/DivergenceChart";
import { CampaignTable } from "@/components/CampaignTable";
import { computeRoas } from "@/lib/roas-engine";

import type { AttributionModel, ProcessResponse } from "@/lib/types";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProcessResponse | null>(null);
  const [attributionModel, setAttributionModel] =
    useState<AttributionModel>("last-touch");
  const [halfLifeDays, setHalfLifeDays] = useState(7);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [showFormatHint, setShowFormatHint] = useState(false);
  const [hoveredCampaign, setHoveredCampaign] = useState<string | null>(null);

  const leadsRef = useRef<HTMLInputElement>(null);
  const salesRef = useRef<HTMLInputElement>(null);
  const spendRef = useRef<HTMLInputElement>(null);

  const activeRoasResult = useMemo(() => {
    if (!data) return null;
    return computeRoas(data.touchGraph, data.allLeads, data.spendRows, {
      model: attributionModel,
      halfLifeDays,
    });
  }, [attributionModel, data, halfLifeDays]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setData(null);

    const leadsFile = leadsRef.current?.files?.[0];
    const salesFile = salesRef.current?.files?.[0];
    const spendFile = spendRef.current?.files?.[0];

    if (!leadsFile || !salesFile) {
      setError("Please select both a Leads CSV and a Sales CSV.");
      return;
    }

    const formData = new FormData();
    formData.append("leadsFile", leadsFile);
    formData.append("salesFile", salesFile);
    if (spendFile) formData.append("spendFile", spendFile);

    setLoading(true);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });
      const json: ProcessResponse = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Server error (${res.status})`);
        return;
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(platform: "google" | "meta") {
    if (!data?.touchGraph) return;
    setExporting(platform);
    try {
      const url =
        platform === "google" ? "/api/export/google" : "/api/export/meta";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ touchGraph: data.touchGraph }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Export failed");
        return;
      }
      const blob = await res.blob();
      const filename =
        platform === "google"
          ? "google_ads_conversions.csv"
          : "meta_capi_events.json";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      setExportSuccess(platform);
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const fmtCurrency = (n: number | null) =>
    n !== null
      ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "—";

  const highlightCampaigns = (text: string) => {
    if (!activeRoasResult) return text;
    let result = text.replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="text-white font-semibold">$1</strong>',
    );
    activeRoasResult.campaigns.forEach((c) => {
      if (!c.campaign) return;
      const name = c.campaign.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b(${name})\\b(?![^<]*>)`, "gi"); // negative lookahead to avoid replacing inside existing tags
      result = result.replace(
        regex,
        '<strong class="text-white font-semibold">$1</strong>',
      );
    });
    return result;
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 lg:py-20 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <header className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 flex items-center justify-center gap-3">
          <span className="text-blue-500">⟳</span> RevenueLoop AI
        </h1>
        <p className="text-zinc-400 text-lg max-w-xl mx-auto">
          True ROAS attribution through precision lead-to-sale matching.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 md:p-10 shadow-2xl max-w-4xl mx-auto mb-16"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <FileInput
            label="Leads CSV *"
            ref={leadsRef}
            accept=".csv"
            id="input-leads"
          />
          <FileInput
            label="Sales CSV *"
            ref={salesRef}
            accept=".csv"
            id="input-sales"
          />
          <FileInput
            label="Spend CSV (Optional)"
            ref={spendRef}
            accept=".csv"
            id="input-spend"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          id="btn-process"
          className="w-full bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl py-4 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Analyzing Data…
            </span>
          ) : (
            "Analyze Campaigns"
          )}
        </button>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShowFormatHint(!showFormatHint)}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1 cursor-pointer"
          >
            {showFormatHint ? "Hide Expected Format" : "View Expected Format"}
          </button>

          {showFormatHint && (
            <div className="mt-4 text-left bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-xl p-6 text-sm text-zinc-400 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 fade-in duration-300">
              <div>
                <h4 className="text-white font-semibold mb-2">Leads CSV</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Email or Phone</li>
                  <li>Campaign (Name/ID)</li>
                  <li>Timestamp</li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">Sales CSV</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Email or Phone</li>
                  <li>Value / Revenue</li>
                  <li>Status</li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">
                  Spend CSV (Optional)
                </h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Campaign (Name/ID)</li>
                  <li>Date</li>
                  <li>Spend Amount</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </form>

      {error && (
        <div
          id="error-box"
          className="bg-red-950/50 border border-red-500/20 text-red-400 rounded-xl p-5 mb-12 max-w-4xl mx-auto flex items-start gap-3"
        >
          <span className="text-lg">⚠</span>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {loading && !data && (
        <div className="space-y-12 animate-in fade-in duration-700 mt-12 opacity-50 pointer-events-none">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-zinc-900/60 border border-white/5 rounded-2xl h-[104px] animate-pulse"
              />
            ))}
          </div>
          <div className="space-y-6">
            <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl h-64 animate-pulse" />
          </div>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div
              id="warnings-box"
              className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-6 max-w-4xl mx-auto"
            >
              <strong className="text-amber-500 flex items-center gap-2 mb-3">
                <span>⚠</span> Parser Warnings
              </strong>
              <ul className="list-disc list-inside text-amber-200/70 space-y-1.5 text-sm ml-2">
                {data.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Match Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              label="Matched Leads"
              value={data.matchResult.matchedCount}
            />
            <StatCard
              label="Matched Sales"
              value={data.matchResult.matchedSalesCount}
            />
            <StatCard
              label="Match Rate"
              value={`${data.matchResult.matchRatePercent}%`}
              highlight={data.matchResult.matchRatePercent > 70}
            />
            <StatCard
              label="Unmatched Leads"
              value={data.matchResult.unmatchedLeadsCount}
            />
            <StatCard
              label="Unmatched Sales"
              value={data.matchResult.unmatchedSalesCount}
            />
            <StatCard
              label="Total Revenue"
              value={fmtCurrency(activeRoasResult?.totals.totalRevenue ?? null)}
              highlight
            />
            {activeRoasResult?.totals.overallRoas !== null &&
              activeRoasResult?.totals.overallRoas !== undefined && (
              <StatCard
                label="Overall ROAS"
                value={`${activeRoasResult.totals.overallRoas}x`}
                highlight
              />
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 rounded-2xl border border-white/5 bg-zinc-900/30 p-5">
            <div>
              <label
                htmlFor="attribution-model"
                className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-2"
              >
                Attribution Model
              </label>
              <select
                id="attribution-model"
                value={attributionModel}
                onChange={(e) =>
                  setAttributionModel(e.target.value as AttributionModel)
                }
                className="w-full md:w-64 rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="last-touch">Last-touch</option>
                <option value="first-touch">First-touch</option>
                <option value="linear">Linear</option>
                <option value="time-decay">Time-decay</option>
                <option value="position-based">Position-based</option>
              </select>
            </div>

            {attributionModel === "time-decay" && (
              <div>
                <label
                  htmlFor="half-life-days"
                  className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-2"
                >
                  Half-life Days
                </label>
                <input
                  id="half-life-days"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={halfLifeDays}
                  onChange={(e) =>
                    setHalfLifeDays(Math.max(0.1, Number(e.target.value) || 7))
                  }
                  className="w-full md:w-40 rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Campaign Table */}
          {activeRoasResult && (
            <CampaignTable
              campaigns={activeRoasResult.campaigns}
              hoveredCampaign={hoveredCampaign}
              onHoverCampaign={setHoveredCampaign}
            />
          )}

          {/* Divergence Visualization */}
          {activeRoasResult && (
            <DivergenceChart
              campaigns={activeRoasResult.campaigns}
              hoveredCampaign={hoveredCampaign}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
            {/* AI Insights */}
            {data.narrative && (
              <div className="lg:col-span-2 space-y-6">
                <h2 className="text-2xl font-bold text-white">AI Insights</h2>
                <div
                  id="narrative-box"
                  className="relative bg-zinc-900/60 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 shadow-2xl overflow-hidden group hover:border-purple-500/40 transition-colors"
                >
                  <div className="absolute -top-32 -right-32 w-64 h-64 bg-purple-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-all" />

                  <div className="relative text-zinc-300 leading-relaxed space-y-5 text-sm md:text-base">
                    {data.narrative ? (
                      data.narrative.split("\n").map((line, i) =>
                        line.trim() ? (
                          <div key={i} className="flex gap-4 items-start">
                            <span className="text-purple-400/50 shrink-0 mt-1">
                              ✦
                            </span>
                            <p
                              dangerouslySetInnerHTML={{
                                __html: highlightCampaigns(line),
                              }}
                            />
                          </div>
                        ) : null,
                      )
                    ) : (
                      <div className="flex items-center gap-3 text-zinc-500 italic py-4">
                        <span className="text-xl">🤖</span> AI summary currently
                        unavailable.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Export Options */}
            <div
              className={`space-y-6 ${!data.narrative ? "lg:col-span-3" : ""}`}
            >
              <h2 className="text-2xl font-bold text-white">Export & Sync</h2>
              <div
                className={`grid grid-cols-1 ${!data.narrative ? "md:grid-cols-2" : ""} gap-4`}
              >
                {/* Google Ads */}
                <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:border-blue-500/30 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-blue-400"
                        >
                          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          <path d="M10 7v3" />
                          <path d="M8 9h4" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">Google Ads</h3>
                        <p className="text-xs text-zinc-400">
                          Offline Conversions
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-500 mb-2">
                      Upload this CSV to Google Ads to feed true ROAS data back
                      into your bidding algorithms.
                    </p>
                    <p className="text-[11px] text-zinc-600 mb-6 italic">
                      * Uses "Offline Sale" as conversion name.
                    </p>
                  </div>
                  <button
                    onClick={() => handleExport("google")}
                    disabled={exporting !== null}
                    className="w-full bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl py-3 text-sm font-semibold transition-all hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] disabled:opacity-50 disabled:hover:shadow-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {exportSuccess === "google" ? (
                      <span className="flex items-center justify-center gap-2 text-emerald-400">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Downloaded
                      </span>
                    ) : exporting === "google" ? (
                      "Generating..."
                    ) : (
                      "Download CSV"
                    )}
                  </button>
                </div>

                {/* Meta Ads */}
                <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:border-emerald-500/30 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-emerald-400"
                        >
                          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">Meta Ads</h3>
                        <p className="text-xs text-zinc-400">Conversions API</p>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-500 mb-2">
                      Push this payload to the Conversions API to recover lost
                      signal and optimize delivery.
                    </p>
                    <p className="text-[11px] text-zinc-600 mb-6 italic">
                      * Uses "Purchase" event and "USD" currency.
                    </p>
                  </div>
                  <button
                    onClick={() => handleExport("meta")}
                    disabled={exporting !== null}
                    className="w-full bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl py-3 text-sm font-semibold transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] disabled:opacity-50 disabled:hover:shadow-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    {exportSuccess === "meta" ? (
                      <span className="flex items-center justify-center gap-2 text-emerald-400">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Downloaded
                      </span>
                    ) : exporting === "meta" ? (
                      "Generating..."
                    ) : (
                      "Download JSON"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
