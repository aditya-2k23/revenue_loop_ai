"use client";

import { useState, useRef, forwardRef, type FormEvent } from "react";

interface MatchSummary {
  matchedCount: number;
  unmatchedLeadsCount: number;
  unmatchedSalesCount: number;
  matchRatePercent: number;
}

interface CampaignMetrics {
  campaign: string;
  totalLeads: number;
  totalSales: number;
  totalRevenue: number;
  costPerLead: number | null;
  costPerAcquisition: number | null;
  roas: number | null;
  totalSpend: number | null;
  divergenceScore: number | null;
}

interface RoasResult {
  campaigns: CampaignMetrics[];
  totals: {
    totalLeads: number;
    totalSales: number;
    totalRevenue: number;
    totalSpend: number | null;
    overallRoas: number | null;
  };
}

interface ProcessResponse {
  matchResult: MatchSummary;
  roasResult: RoasResult;
  narrative: string;
  warnings: string[];
  _matchedPairs: unknown[];
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isDivergent(m: CampaignMetrics): boolean {
  return m.divergenceScore !== null && m.divergenceScore >= 0.3;
}

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
      const res = await fetch("/api/process", { method: "POST", body: formData });
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
      const url = platform === "google" ? "/api/export/google" : "/api/export/meta";
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
      const filename = platform === "google" ? "google_ads_conversions.csv" : "meta_capi_events.json";
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

  const fmt = (n: number | null) => (n !== null ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—");
  const fmtPct = (n: number | null) => (n !== null ? `${n.toFixed(1)}%` : "—");
  const fmtCurrency = (n: number | null) => (n !== null ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—");

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>
          <span style={styles.logo}>⟳</span> RevenueLoop AI
        </h1>
        <p style={styles.subtitle}>True ROAS from lead-to-sale matching</p>
      </header>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.fileRow}>
          <FileInput label="Leads CSV *" ref={leadsRef} accept=".csv" id="input-leads" />
          <FileInput label="Sales CSV *" ref={salesRef} accept=".csv" id="input-sales" />
          <FileInput label="Spend CSV (optional)" ref={spendRef} accept=".csv" id="input-spend" />
        </div>
        <button type="submit" disabled={loading} style={styles.submitBtn} id="btn-process">
          {loading ? "Processing…" : "Analyze"}
        </button>
      </form>

      {error && <div style={styles.errorBox} id="error-box">{error}</div>}

      {loading && (
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <span>Parsing CSVs, matching leads to sales, computing ROAS…</span>
        </div>
      )}

      {data && (
        <div style={styles.results}>
          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div style={styles.warningsBox} id="warnings-box">
              <strong>⚠ Parser Warnings:</strong>
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
                {data.warnings.map((w, i) => (
                  <li key={i} style={{ marginBottom: "0.25rem" }}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Match Summary */}
          <div style={styles.summaryRow}>
            <StatCard label="Matched Pairs" value={data.matchResult.matchedCount} />
            <StatCard label="Match Rate" value={`${data.matchResult.matchRatePercent}%`} />
            <StatCard label="Unmatched Leads" value={data.matchResult.unmatchedLeadsCount} />
            <StatCard label="Unmatched Sales" value={data.matchResult.unmatchedSalesCount} />
            <StatCard label="Total Revenue" value={fmtCurrency(data.roasResult.totals.totalRevenue)} />
            {data.roasResult.totals.overallRoas !== null && (
              <StatCard label="Overall ROAS" value={`${data.roasResult.totals.overallRoas}x`} />
            )}
          </div>

          {/* Campaign Table */}
          <h2 style={styles.sectionTitle}>Campaign Metrics</h2>
          <div style={styles.tableWrap}>
            <table style={styles.table} id="campaign-table">
              <thead>
                <tr>
                  <th style={styles.th}>Campaign</th>
                  <th style={styles.thR}>Leads</th>
                  <th style={styles.thR}>Sales</th>
                  <th style={styles.thR}>Revenue</th>
                  <th style={styles.thR}>Spend</th>
                  <th style={styles.thR}>CPL</th>
                  <th style={styles.thR}>CPA</th>
                  <th style={styles.thR}>ROAS</th>
                  <th style={styles.thR}>Divergence</th>
                </tr>
              </thead>
              <tbody>
                {data.roasResult.campaigns.map((c, i) => (
                  <tr key={i} style={isDivergent(c) ? styles.divergentRow : undefined}>
                    <td style={styles.td}>
                      {c.campaign}
                      {isDivergent(c) && <span style={styles.badge}>DIVERGENT</span>}
                    </td>
                    <td style={styles.tdR}>{c.totalLeads}</td>
                    <td style={styles.tdR}>{c.totalSales}</td>
                    <td style={styles.tdR}>{fmtCurrency(c.totalRevenue)}</td>
                    <td style={styles.tdR}>{fmtCurrency(c.totalSpend)}</td>
                    <td style={styles.tdR}>{fmtCurrency(c.costPerLead)}</td>
                    <td style={styles.tdR}>{fmtCurrency(c.costPerAcquisition)}</td>
                    <td style={styles.tdR}>{fmt(c.roas)}{c.roas !== null ? "x" : ""}</td>
                    <td style={styles.tdR}>{fmtPct(c.divergenceScore !== null ? c.divergenceScore * 100 : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Divergence Visualization */}
          <DivergenceChart campaigns={data.roasResult.campaigns} />

          {/* Narrative */}
          {data.narrative && (
            <>
              <h2 style={styles.sectionTitle}>AI Analysis</h2>
              <div style={styles.narrativeBox} id="narrative-box">
                {data.narrative.split("\n").map((line, i) =>
                  line.trim() ? <p key={i} style={{ margin: "0.5rem 0" }}>{line}</p> : null
                )}
              </div>
            </>
          )}

          {/* Export Buttons */}
          <div style={styles.exportRow}>
            <button
              onClick={() => handleExport("google")}
              disabled={exporting !== null}
              style={styles.exportBtn}
              id="btn-export-google"
            >
              {exporting === "google" ? "Exporting…" : "Export for Google Ads"}
            </button>
            <button
              onClick={() => handleExport("meta")}
              disabled={exporting !== null}
              style={{ ...styles.exportBtn, background: "#1877f2" }}
              id="btn-export-meta"
            >
              {exporting === "meta" ? "Exporting…" : "Export for Meta"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

const FileInput = forwardRef<HTMLInputElement, { label: string; accept: string; id: string }>(
  function FileInput({ label, accept, id }, ref) {
    return (
      <label style={styles.fileLabel}>
        <span style={styles.fileLabelText}>{label}</span>
        <input type="file" accept={accept} ref={ref} style={styles.fileInput} id={id} />
      </label>
    );
  }
);

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function DivergenceChart({ campaigns }: { campaigns: CampaignMetrics[] }) {
  const withDivergence = campaigns
    .filter((c) => c.divergenceScore !== null && c.divergenceScore > 0)
    .sort((a, b) => (b.divergenceScore ?? 0) - (a.divergenceScore ?? 0));

  if (withDivergence.length === 0) return null;

  const maxScore = Math.max(...withDivergence.map((c) => c.divergenceScore ?? 0));

  return (
    <>
      <h2 style={styles.sectionTitle}>CPL vs CPA Rank Divergence</h2>
      <p style={{ color: "#999", margin: "0 0 1rem", fontSize: "0.85rem" }}>
        Higher bars = bigger gap between how cheap a campaign looks (CPL) vs. how expensive it truly is (CPA).
      </p>
      <div style={styles.chartContainer} id="divergence-chart">
        {withDivergence.map((c, i) => {
          const pct = maxScore > 0 ? ((c.divergenceScore ?? 0) / maxScore) * 100 : 0;
          const isHigh = (c.divergenceScore ?? 0) >= 0.3;
          return (
            <div key={i} style={styles.chartRow}>
              <div style={styles.chartLabel} title={c.campaign}>
                {c.campaign.length > 24 ? c.campaign.slice(0, 22) + "…" : c.campaign}
              </div>
              <div style={styles.chartBarTrack}>
                <div
                  style={{
                    ...styles.chartBar,
                    width: `${Math.max(pct, 4)}%`,
                    background: isHigh
                      ? "linear-gradient(90deg, #ff4444, #ff6b6b)"
                      : "linear-gradient(90deg, #4a9eff, #6bb5ff)",
                  }}
                />
              </div>
              <div style={styles.chartValue}>
                {((c.divergenceScore ?? 0) * 100).toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "2rem 1.5rem 4rem",
  },
  header: {
    textAlign: "center",
    marginBottom: "2rem",
  },
  title: {
    fontSize: "2rem",
    fontWeight: 700,
    margin: 0,
    letterSpacing: "-0.02em",
  },
  logo: {
    display: "inline-block",
    marginRight: "0.3rem",
    color: "#4a9eff",
  },
  subtitle: {
    color: "#888",
    margin: "0.25rem 0 0",
    fontSize: "0.95rem",
  },
  form: {
    background: "#141414",
    borderRadius: "12px",
    padding: "1.5rem",
    border: "1px solid #2a2a2a",
  },
  fileRow: {
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap" as const,
    marginBottom: "1rem",
  },
  fileLabel: {
    flex: "1 1 200px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.4rem",
  },
  fileLabelText: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#aaa",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  fileInput: {
    background: "#1e1e1e",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "0.6rem",
    color: "#ddd",
    fontSize: "0.85rem",
  },
  submitBtn: {
    background: "#4a9eff",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "0.7rem 2rem",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  },
  errorBox: {
    background: "#3a1515",
    border: "1px solid #6b2020",
    borderRadius: "8px",
    padding: "0.8rem 1rem",
    color: "#ff8888",
    marginTop: "1rem",
    fontSize: "0.9rem",
  },
  loadingBox: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    justifyContent: "center",
    padding: "2rem",
    color: "#aaa",
  },
  spinner: {
    width: 20,
    height: 20,
    border: "2px solid #333",
    borderTop: "2px solid #4a9eff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  results: {
    marginTop: "1.5rem",
  },
  warningsBox: {
    background: "#2a2510",
    border: "1px solid #5a4a10",
    borderRadius: "8px",
    padding: "0.8rem 1rem",
    color: "#eec844",
    marginBottom: "1.5rem",
    fontSize: "0.85rem",
  },
  summaryRow: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap" as const,
    marginBottom: "1.5rem",
  },
  statCard: {
    flex: "1 1 120px",
    background: "#141414",
    border: "1px solid #2a2a2a",
    borderRadius: "10px",
    padding: "1rem",
    textAlign: "center" as const,
  },
  statValue: {
    fontSize: "1.4rem",
    fontWeight: 700,
    color: "#fff",
  },
  statLabel: {
    fontSize: "0.75rem",
    color: "#888",
    marginTop: "0.25rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  sectionTitle: {
    fontSize: "1.15rem",
    fontWeight: 600,
    margin: "1.5rem 0 0.75rem",
    color: "#ddd",
  },
  tableWrap: {
    overflowX: "auto" as const,
    borderRadius: "10px",
    border: "1px solid #2a2a2a",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.85rem",
  },
  th: {
    textAlign: "left" as const,
    padding: "0.7rem 0.8rem",
    background: "#1a1a1a",
    color: "#888",
    fontWeight: 600,
    fontSize: "0.75rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    borderBottom: "1px solid #2a2a2a",
  },
  thR: {
    textAlign: "right" as const,
    padding: "0.7rem 0.8rem",
    background: "#1a1a1a",
    color: "#888",
    fontWeight: 600,
    fontSize: "0.75rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    borderBottom: "1px solid #2a2a2a",
  },
  td: {
    padding: "0.6rem 0.8rem",
    borderBottom: "1px solid #1e1e1e",
    color: "#ddd",
  },
  tdR: {
    padding: "0.6rem 0.8rem",
    borderBottom: "1px solid #1e1e1e",
    color: "#ddd",
    textAlign: "right" as const,
    fontVariantNumeric: "tabular-nums",
  },
  divergentRow: {
    background: "#1a1010",
  },
  badge: {
    display: "inline-block",
    marginLeft: "0.5rem",
    background: "#6b2020",
    color: "#ff8888",
    fontSize: "0.65rem",
    fontWeight: 700,
    padding: "0.15rem 0.4rem",
    borderRadius: "4px",
    verticalAlign: "middle",
  },
  chartContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.4rem",
    background: "#141414",
    borderRadius: "10px",
    border: "1px solid #2a2a2a",
    padding: "1rem",
  },
  chartRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  chartLabel: {
    width: 160,
    flexShrink: 0,
    fontSize: "0.8rem",
    color: "#bbb",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  chartBarTrack: {
    flex: 1,
    height: 20,
    background: "#1e1e1e",
    borderRadius: "4px",
    overflow: "hidden",
  },
  chartBar: {
    height: "100%",
    borderRadius: "4px",
    transition: "width 0.3s ease",
  },
  chartValue: {
    width: 40,
    fontSize: "0.8rem",
    color: "#aaa",
    textAlign: "right" as const,
  },
  narrativeBox: {
    background: "#141414",
    border: "1px solid #2a2a2a",
    borderRadius: "10px",
    padding: "1.2rem 1.5rem",
    fontSize: "0.9rem",
    lineHeight: 1.7,
    color: "#ccc",
  },
  exportRow: {
    display: "flex",
    gap: "1rem",
    marginTop: "1.5rem",
    flexWrap: "wrap" as const,
  },
  exportBtn: {
    flex: "1 1 200px",
    padding: "0.7rem 1.5rem",
    borderRadius: "8px",
    border: "none",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    color: "#fff",
    background: "#1a8a1a",
  },
};
