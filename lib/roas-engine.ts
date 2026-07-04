import type {
  MatchedPair,
  Lead,
  SpendRow,
  CampaignMetrics,
  RoasResult,
  SpendByCampaign,
  CampaignAccumulator,
} from "./types";



function aggregateSpend(spendRows: SpendRow[]): SpendByCampaign {
  const result: SpendByCampaign = {};
  for (const row of spendRows) {
    const campaign = row.campaign?.trim().toLowerCase();
    if (!campaign || row.spend === undefined || isNaN(row.spend)) continue;
    result[campaign] = (result[campaign] || 0) + row.spend;
  }
  return result;
}

function normalizeCampaignKey(raw: string | undefined): string {
  return (raw ?? "unknown").trim().toLowerCase();
}



export function computeRoas(
  matchedPairs: MatchedPair[],
  allLeads: Lead[],
  spendRows?: SpendRow[],
): RoasResult {
  const campaignMap = new Map<string, CampaignAccumulator>();

  const ensureCampaign = (key: string, displayName: string) => {
    if (!campaignMap.has(key)) {
      campaignMap.set(key, {
        campaign: key,
        displayName,
        leadCount: 0,
        saleCount: 0,
        totalRevenue: 0,
      });
    }
  };

  for (const lead of allLeads) {
    const key = normalizeCampaignKey(lead.campaign);
    ensureCampaign(key, lead.campaign ?? "Unknown");
    campaignMap.get(key)!.leadCount++;
  }

  for (const pair of matchedPairs) {
    const key = normalizeCampaignKey(pair.lead.campaign);
    ensureCampaign(key, pair.lead.campaign ?? "Unknown");
    const acc = campaignMap.get(key)!;
    acc.saleCount++;
    acc.totalRevenue += pair.sale.value ?? 0;
  }

  const spendByCampaign = spendRows ? aggregateSpend(spendRows) : null;

  if (spendByCampaign) {
    for (const key of Object.keys(spendByCampaign)) {
      ensureCampaign(key, key);
    }
  }

  const metricsArray: CampaignMetrics[] = [];

  for (const acc of campaignMap.values()) {
    const spend =
      spendByCampaign && acc.campaign in spendByCampaign
        ? spendByCampaign[acc.campaign]
        : null;

    const cpl =
      spend !== null && acc.leadCount > 0 ? round(spend / acc.leadCount) : null;

    const cpa =
      spend !== null && acc.saleCount > 0 ? round(spend / acc.saleCount) : null;

    const roas =
      spend !== null && spend > 0 ? round(acc.totalRevenue / spend) : null;

    metricsArray.push({
      campaign: acc.displayName,
      totalLeads: acc.leadCount,
      totalSales: acc.saleCount,
      totalRevenue: round(acc.totalRevenue),
      costPerLead: cpl,
      costPerAcquisition: cpa,
      roas,
      totalSpend: spend !== null ? round(spend) : null,
      divergenceScore: null,
    });
  }

  computeDivergenceScores(metricsArray);

  metricsArray.sort((a, b) => {
    if (b.roas !== null && a.roas !== null) return b.roas - a.roas;
    if (b.roas !== null) return 1;
    if (a.roas !== null) return -1;
    return b.totalRevenue - a.totalRevenue;
  });

  let totalSpendSum: number | null = null;
  if (spendByCampaign) {
    totalSpendSum = Object.values(spendByCampaign).reduce((s, v) => s + v, 0);
  }
  const totalRevenue = metricsArray.reduce((s, m) => s + m.totalRevenue, 0);

  return {
    campaigns: metricsArray,
    totals: {
      totalLeads: allLeads.length,
      totalSales: matchedPairs.length,
      totalRevenue: round(totalRevenue),
      totalSpend: totalSpendSum !== null ? round(totalSpendSum) : null,
      overallRoas:
        totalSpendSum !== null && totalSpendSum > 0
          ? round(totalRevenue / totalSpendSum)
          : null,
    },
  };
}

function computeDivergenceScores(metrics: CampaignMetrics[]): void {
  const campaignsWithData = metrics.filter(
    (m) => m.totalLeads > 0 || m.totalSales > 0,
  );

  if (campaignsWithData.length < 2) return;

  const hasSpend = campaignsWithData.some((m) => m.costPerLead !== null);

  if (hasSpend) {
    const withCPL = campaignsWithData.filter((m) => m.costPerLead !== null);
    if (withCPL.length < 2) return;

    const cplSorted = [...withCPL].sort(
      (a, b) => (a.costPerLead ?? Infinity) - (b.costPerLead ?? Infinity),
    );
    const cplRank = new Map<string, number>();
    cplSorted.forEach((m, i) =>
      cplRank.set(normalizeCampaignKey(m.campaign), i + 1),
    );

    const cpaSorted = [...withCPL].sort(
      (a, b) =>
        (a.costPerAcquisition ?? Infinity) - (b.costPerAcquisition ?? Infinity),
    );
    const cpaRank = new Map<string, number>();
    cpaSorted.forEach((m, i) =>
      cpaRank.set(normalizeCampaignKey(m.campaign), i + 1),
    );

    const maxDivergence = withCPL.length - 1;

    for (const m of metrics) {
      const key = normalizeCampaignKey(m.campaign);
      const cr = cplRank.get(key);
      const ar = cpaRank.get(key);
      if (cr !== undefined && ar !== undefined && maxDivergence > 0) {
        m.divergenceScore = round(Math.abs(cr - ar) / maxDivergence);
      }
    }
  } else {
    const leadSorted = [...campaignsWithData].sort(
      (a, b) => b.totalLeads - a.totalLeads,
    );
    const leadRank = new Map<string, number>();
    leadSorted.forEach((m, i) =>
      leadRank.set(normalizeCampaignKey(m.campaign), i + 1),
    );

    const revSorted = [...campaignsWithData].sort(
      (a, b) => b.totalRevenue - a.totalRevenue,
    );
    const revRank = new Map<string, number>();
    revSorted.forEach((m, i) =>
      revRank.set(normalizeCampaignKey(m.campaign), i + 1),
    );

    const maxDivergence = campaignsWithData.length - 1;

    for (const m of metrics) {
      const key = normalizeCampaignKey(m.campaign);
      const lr = leadRank.get(key);
      const rr = revRank.get(key);
      if (lr !== undefined && rr !== undefined && maxDivergence > 0) {
        m.divergenceScore = round(Math.abs(lr - rr) / maxDivergence);
      }
    }
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
