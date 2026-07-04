import { useState } from "react";
import type { CampaignMetrics } from "@/lib/types";

export function isDivergent(m: CampaignMetrics): boolean {
  return m.divergenceScore !== null && m.divergenceScore >= 0.3;
}

type SortColumn =
  | "campaign"
  | "leads"
  | "touchedSales"
  | "creditedSales"
  | "revenue"
  | "spend"
  | "cpl"
  | "cpa"
  | "roas"
  | "divergence";
type SortDirection = "asc" | "desc";

export function CampaignTable({
  campaigns,
  hoveredCampaign,
  onHoverCampaign,
}: {
  campaigns: CampaignMetrics[];
  hoveredCampaign?: string | null;
  onHoverCampaign?: (c: string | null) => void;
}) {
  const [sortCol, setSortCol] = useState<SortColumn>("roas");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const fmt = (n: number | null) =>
    n !== null
      ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : "—";
  const fmtPct = (n: number | null) => (n !== null ? `${n.toFixed(1)}%` : "—");
  const fmtCurrency = (n: number | null) =>
    n !== null
      ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "—";

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    let valA: any = a.campaign;
    let valB: any = b.campaign;
    if (sortCol === "leads") {
      valA = a.totalLeads;
      valB = b.totalLeads;
    } else if (sortCol === "touchedSales") {
      valA = a.touchedSales;
      valB = b.touchedSales;
    } else if (sortCol === "creditedSales") {
      valA = a.creditedSales;
      valB = b.creditedSales;
    } else if (sortCol === "revenue") {
      valA = a.totalRevenue;
      valB = b.totalRevenue;
    } else if (sortCol === "spend") {
      valA = a.totalSpend;
      valB = b.totalSpend;
    } else if (sortCol === "cpl") {
      valA = a.costPerLead;
      valB = b.costPerLead;
    } else if (sortCol === "cpa") {
      valA = a.costPerAcquisition;
      valB = b.costPerAcquisition;
    } else if (sortCol === "roas") {
      valA = a.roas;
      valB = b.roas;
    } else if (sortCol === "divergence") {
      valA = a.divergenceScore;
      valB = b.divergenceScore;
    }

    if (valA === null) return 1;
    if (valB === null) return -1;
    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const maxRevenue = Math.max(...campaigns.map((c) => c.totalRevenue ?? 0));
  const maxRoas = Math.max(...campaigns.map((c) => c.roas ?? 0));

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortCol !== col)
      return <span className="opacity-0 group-hover:opacity-50 ml-1">↕</span>;
    return (
      <span className="ml-1 text-blue-400">
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  const Th = ({
    label,
    col,
    align = "right",
  }: {
    label: string;
    col: SortColumn;
    align?: "left" | "right";
  }) => (
    <th
      className={`px-3 md:px-4 py-3 md:py-4 border-b border-white/5 cursor-pointer hover:text-white transition-colors group select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset ${align === "right" ? "text-right" : ""}`}
      onClick={() => handleSort(col)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSort(col);
        }
      }}
    >
      {label} <SortIcon col={col} />
    </th>
  );

  return (
    <div className="relative">
      <h2 className="text-2xl font-bold text-white mb-6">Campaign Metrics</h2>

      {/* Mobile horizontal scroll shadow hints */}
      <div className="absolute top-16 bottom-0 left-0 w-8 bg-linear-to-r from-zinc-950 to-transparent pointer-events-none md:hidden z-10" />
      <div className="absolute top-16 bottom-0 right-0 w-8 bg-linear-to-l from-zinc-950 to-transparent pointer-events-none md:hidden z-10" />

      <div className="overflow-x-auto scrollbar-hide rounded-2xl border border-white/5 bg-zinc-900/20 backdrop-blur-sm relative z-0">
        <table
          id="campaign-table"
          className="w-full text-sm text-left relative"
        >
          <thead className="bg-zinc-900/60 text-zinc-400 uppercase tracking-wider text-xs font-semibold">
            <tr>
              <Th label="Campaign" col="campaign" align="left" />
              <Th label="Leads" col="leads" />
              <Th label="Touched Sales" col="touchedSales" />
              <Th label="Credited Sales" col="creditedSales" />
              <Th label="Revenue" col="revenue" />
              <Th label="Spend" col="spend" />
              <Th label="CPL" col="cpl" />
              <Th label="CPA" col="cpa" />
              <Th label="ROAS" col="roas" />
              <Th label="Divergence" col="divergence" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedCampaigns.map((c, i) => {
              const revPct =
                maxRevenue > 0 && c.totalRevenue !== null
                  ? (c.totalRevenue / maxRevenue) * 100
                  : 0;
              const roasPct =
                maxRoas > 0 && c.roas !== null ? (c.roas / maxRoas) * 100 : 0;
              const isHovered = hoveredCampaign === c.campaign;

              return (
                <tr
                  key={i}
                  onMouseEnter={() => onHoverCampaign?.(c.campaign)}
                  onMouseLeave={() => onHoverCampaign?.(null)}
                  className={`transition-colors ${isDivergent(c) ? "bg-amber-950/10" : ""} ${isHovered ? "bg-white/5" : "hover:bg-white/5"}`}
                >
                  <td className="px-3 md:px-4 py-3 md:py-4 whitespace-nowrap text-zinc-200">
                    {c.campaign}
                    {isDivergent(c) && (
                      <span className="ml-3 inline-flex items-center rounded-md bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-500 ring-1 ring-inset ring-amber-400/20">
                        DIVERGENT
                      </span>
                    )}
                  </td>
                  <td className="px-3 md:px-4 py-3 md:py-4 text-right text-zinc-300 font-mono">
                    {c.totalLeads}
                  </td>
                  <td className="px-3 md:px-4 py-3 md:py-4 text-right text-zinc-300 font-mono">
                    {c.touchedSales}
                  </td>
                  <td className="px-3 md:px-4 py-3 md:py-4 text-right text-zinc-300 font-mono">
                    {fmt(c.creditedSales)}
                  </td>
                  <td className="px-3 md:px-4 py-3 md:py-4 text-right text-emerald-400/90 font-mono relative z-0">
                    <div
                      className="absolute inset-y-0 right-0 bg-emerald-500/5 -z-10 border-l-2 border-emerald-500/20 transition-all duration-500"
                      style={{ width: `${revPct}%` }}
                    />
                    {fmtCurrency(c.totalRevenue)}
                  </td>
                  <td className="px-3 md:px-4 py-3 md:py-4 text-right text-zinc-300 font-mono">
                    {fmtCurrency(c.totalSpend)}
                  </td>
                  <td className="px-3 md:px-4 py-3 md:py-4 text-right text-zinc-300 font-mono">
                    {fmtCurrency(c.costPerLead)}
                  </td>
                  <td className="px-3 md:px-4 py-3 md:py-4 text-right text-zinc-300 font-mono">
                    {fmtCurrency(c.costPerAcquisition)}
                  </td>
                  <td className="px-3 md:px-4 py-3 md:py-4 text-right text-blue-400/90 font-mono relative z-0">
                    <div
                      className="absolute inset-y-0 right-0 bg-blue-500/5 -z-10 border-l-2 border-blue-500/20 transition-all duration-500"
                      style={{ width: `${roasPct}%` }}
                    />
                    {fmt(c.roas)}
                    {c.roas !== null ? "x" : ""}
                  </td>
                  <td
                    className={`px-3 md:px-4 py-3 md:py-4 text-right font-mono ${isDivergent(c) ? "text-amber-500" : "text-zinc-500"}`}
                  >
                    {fmtPct(
                      c.divergenceScore !== null
                        ? c.divergenceScore * 100
                        : null,
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
