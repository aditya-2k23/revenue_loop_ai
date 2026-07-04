import type { CampaignMetrics } from "@/lib/types";

export function isDivergent(m: CampaignMetrics): boolean {
  return m.divergenceScore !== null && m.divergenceScore >= 0.3;
}

export function CampaignTable({ campaigns }: { campaigns: CampaignMetrics[] }) {
  const fmt = (n: number | null) =>
    n !== null
      ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : "—";
  const fmtPct = (n: number | null) => (n !== null ? `${n.toFixed(1)}%` : "—");
  const fmtCurrency = (n: number | null) =>
    n !== null
      ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "—";

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">
        Campaign Metrics
      </h2>
      <div className="overflow-x-auto scrollbar-hide rounded-2xl border border-white/5 bg-zinc-900/20 backdrop-blur-sm">
        <table id="campaign-table" className="w-full text-sm text-left">
          <thead className="bg-zinc-900/60 text-zinc-400 uppercase tracking-wider text-xs font-semibold">
            <tr>
              <th className="px-6 py-4 border-b border-white/5">
                Campaign
              </th>
              <th className="px-6 py-4 border-b border-white/5 text-right">
                Leads
              </th>
              <th className="px-6 py-4 border-b border-white/5 text-right">
                Sales
              </th>
              <th className="px-6 py-4 border-b border-white/5 text-right">
                Revenue
              </th>
              <th className="px-6 py-4 border-b border-white/5 text-right">
                Spend
              </th>
              <th className="px-6 py-4 border-b border-white/5 text-right">
                CPL
              </th>
              <th className="px-6 py-4 border-b border-white/5 text-right">
                CPA
              </th>
              <th className="px-6 py-4 border-b border-white/5 text-right">
                ROAS
              </th>
              <th className="px-6 py-4 border-b border-white/5 text-right">
                Divergence
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {campaigns.map((c, i) => (
              <tr
                key={i}
                className={`transition-colors hover:bg-white/2 ${isDivergent(c) ? "bg-red-950/10" : ""}`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-zinc-200">
                  {c.campaign}
                  {isDivergent(c) && (
                    <span className="ml-3 inline-flex items-center rounded-md bg-red-400/10 px-2 py-1 text-[10px] font-bold text-red-400 ring-1 ring-inset ring-red-400/20">
                      DIVERGENT
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right text-zinc-300 font-mono">
                  {c.totalLeads}
                </td>
                <td className="px-6 py-4 text-right text-zinc-300 font-mono">
                  {c.totalSales}
                </td>
                <td className="px-6 py-4 text-right text-emerald-400/90 font-mono">
                  {fmtCurrency(c.totalRevenue)}
                </td>
                <td className="px-6 py-4 text-right text-zinc-300 font-mono">
                  {fmtCurrency(c.totalSpend)}
                </td>
                <td className="px-6 py-4 text-right text-zinc-300 font-mono">
                  {fmtCurrency(c.costPerLead)}
                </td>
                <td className="px-6 py-4 text-right text-zinc-300 font-mono">
                  {fmtCurrency(c.costPerAcquisition)}
                </td>
                <td className="px-6 py-4 text-right text-blue-400/90 font-mono">
                  {fmt(c.roas)}
                  {c.roas !== null ? "x" : ""}
                </td>
                <td
                  className={`px-6 py-4 text-right font-mono ${isDivergent(c) ? "text-red-400" : "text-zinc-500"}`}
                >
                  {fmtPct(
                    c.divergenceScore !== null
                      ? c.divergenceScore * 100
                      : null,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
