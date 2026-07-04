import type { CampaignMetrics } from "@/lib/types";

export function DivergenceChart({ 
  campaigns,
  hoveredCampaign
}: { 
  campaigns: CampaignMetrics[];
  hoveredCampaign?: string | null;
}) {
  const withDivergence = campaigns
    .filter((c) => c.divergenceScore !== null && c.divergenceScore > 0)
    .sort((a, b) => (b.divergenceScore ?? 0) - (a.divergenceScore ?? 0));

  if (withDivergence.length === 0) return null;

  const maxScore = Math.max(
    ...withDivergence.map((c) => c.divergenceScore ?? 0),
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">
        CPL vs CPA Rank Divergence
      </h2>
      <p className="text-zinc-400 text-sm mb-6">
        Higher bars indicate a larger gap between front-end CPL performance and
        true backend CPA efficiency.
      </p>
      <div
        id="divergence-chart"
        className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 md:p-8 space-y-2"
      >
        {withDivergence.map((c, i) => {
          const pct =
            maxScore > 0 ? ((c.divergenceScore ?? 0) / maxScore) * 100 : 0;
          const isHigh = (c.divergenceScore ?? 0) >= 0.3;
          const isHovered = hoveredCampaign === c.campaign;

          return (
            <div 
              key={i} 
              className={`flex items-center gap-4 transition-all duration-300 rounded-xl px-2 py-2 ${
                isHovered ? "bg-white/10 scale-[1.01]" : "hover:bg-white/5"
              }`}
            >
              <div
                className={`w-32 md:w-48 shrink-0 text-sm truncate transition-colors ${
                  isHovered ? "text-white font-semibold" : "text-zinc-300"
                }`}
                title={c.campaign}
              >
                {c.campaign}
              </div>
              <div className="flex-1 h-3 bg-zinc-950/50 rounded-full overflow-hidden flex items-center">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    isHigh
                      ? "bg-linear-to-r from-amber-500/80 to-amber-400"
                      : "bg-linear-to-r from-blue-600/80 to-blue-400"
                  }`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <div className={`w-12 text-right text-sm font-mono transition-colors ${
                isHovered ? "text-zinc-300 font-semibold" : "text-zinc-400"
              }`}>
                {((c.divergenceScore ?? 0) * 100).toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
