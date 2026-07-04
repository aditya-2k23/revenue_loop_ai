"use client";

import { useState, useRef, type FormEvent } from "react";
import { FileInput } from "@/components/FileInput";
import { StatCard } from "@/components/StatCard";
import { DivergenceChart } from "@/components/DivergenceChart";
import { CampaignTable } from "@/components/CampaignTable";

import type { ProcessResponse } from "@/lib/types";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProcessResponse | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const leadsRef = useRef<HTMLInputElement>(null);
  const salesRef = useRef<HTMLInputElement>(null);
  const spendRef = useRef<HTMLInputElement>(null);

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
    if (!data?._matchedPairs) return;
    setExporting(platform);
    try {
      const url =
        platform === "google" ? "/api/export/google" : "/api/export/meta";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs: data._matchedPairs }),
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

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 lg:py-20 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <header className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 flex items-center justify-center gap-3">
          <span className="text-blue-500 animate-pulse">⟳</span> RevenueLoop AI
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
          className="w-full bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl py-4 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer"
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

      {data && (
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
              label="Matched Pairs"
              value={data.matchResult.matchedCount}
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
              value={fmtCurrency(data.roasResult.totals.totalRevenue)}
              highlight
            />
            {data.roasResult.totals.overallRoas !== null && (
              <StatCard
                label="Overall ROAS"
                value={`${data.roasResult.totals.overallRoas}x`}
                highlight
              />
            )}
          </div>

          {/* Campaign Table */}
          <CampaignTable campaigns={data.roasResult.campaigns} />

          {/* Divergence Visualization */}
          <DivergenceChart campaigns={data.roasResult.campaigns} />

          {/* Narrative */}
          {data.narrative && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="text-purple-400">✨</span> AI Insights
              </h2>
              <div
                id="narrative-box"
                className="bg-linear-to-br from-zinc-900/80 to-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-zinc-300 leading-relaxed space-y-4 shadow-xl"
              >
                {data.narrative
                  .split("\n")
                  .map((line, i) =>
                    line.trim() ? <p key={i}>{line}</p> : null,
                  )}
              </div>
            </div>
          )}

          {/* Export Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            <button
              onClick={() => handleExport("google")}
              disabled={exporting !== null}
              id="btn-export-google"
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 rounded-xl py-4 font-semibold transition-all duration-300 hover:border-white/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {exporting === "google" ? "Exporting…" : "Export for Google Ads"}
            </button>
            <button
              onClick={() => handleExport("meta")}
              disabled={exporting !== null}
              id="btn-export-meta"
              className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/20 rounded-xl py-4 font-semibold transition-all duration-300 hover:border-blue-500/40 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {exporting === "meta" ? "Exporting…" : "Export for Meta"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
