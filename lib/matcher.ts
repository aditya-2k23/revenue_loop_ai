import type { Lead, Sale, MatchedPair, MatchResult } from "./types";

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[\s\-\(\)\.\+]/g, "");
  digits = digits.replace(/[^0-9]/g, "");
  if (digits.length === 0) return null;

  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.substring(1);
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.substring(2);
  }
  if (digits.length === 13 && digits.startsWith("011")) {
    digits = digits.substring(3);
  }

  if (digits.length < 7) return null;

  return digits;
}

function parseTimestamp(ts: string | undefined): number {
  if (!ts) return 0;
  const parsed = Date.parse(ts);
  return isNaN(parsed) ? 0 : parsed;
}

export function matchLeadsToSales(leads: Lead[], sales: Sale[]): MatchResult {
  const matched: MatchedPair[] = [];
  const usedSaleIndices = new Set<number>();

  const emailToLeads = new Map<string, Lead[]>();
  for (const lead of leads) {
    if (lead.email) {
      const existing = emailToLeads.get(lead.email) || [];
      existing.push(lead);
      emailToLeads.set(lead.email, existing);
    }
  }

  const phoneToLeads = new Map<string, Lead[]>();
  for (const lead of leads) {
    const normPhone = normalizePhone(lead.phone);
    if (normPhone) {
      const existing = phoneToLeads.get(normPhone) || [];
      existing.push(lead);
      phoneToLeads.set(normPhone, existing);
    }
  }

  const matchedLeadRefs = new Set<Lead>();

  for (let si = 0; si < sales.length; si++) {
    const sale = sales[si];

    if (sale.email) {
      const candidateLeads = emailToLeads.get(sale.email);
      if (candidateLeads && candidateLeads.length > 0) {
        const bestLead = pickLastTouchLead(candidateLeads, sale);
        matched.push({ lead: bestLead, sale, matchBasis: "email" });
        usedSaleIndices.add(si);
        matchedLeadRefs.add(bestLead);
        continue;
      }
    }

    const saleNormPhone = normalizePhone(sale.phone);
    if (saleNormPhone) {
      const candidateLeads = phoneToLeads.get(saleNormPhone);
      if (candidateLeads && candidateLeads.length > 0) {
        const bestLead = pickLastTouchLead(candidateLeads, sale);
        matched.push({ lead: bestLead, sale, matchBasis: "phone" });
        usedSaleIndices.add(si);
        matchedLeadRefs.add(bestLead);
        continue;
      }
    }
  }

  const unmatchedLeads = leads.filter((l) => !matchedLeadRefs.has(l));
  const unmatchedSales = sales.filter((_, i) => !usedSaleIndices.has(i));

  const totalLeads = leads.length;
  const matchRatePercent =
    totalLeads > 0
      ? Math.round((matchedLeadRefs.size / totalLeads) * 10000) / 100
      : 0;

  return { matched, unmatchedLeads, unmatchedSales, matchRatePercent };
}

function pickLastTouchLead(candidates: Lead[], sale: Sale): Lead {
  if (candidates.length === 1) return candidates[0];

  const saleTime = parseTimestamp(sale.timestamp);

  // If sale timestamp is missing/unparseable, pick the lead with the
  // latest timestamp (best approximation of "last touch").
  if (saleTime === 0) {
    let bestLead = candidates[0];
    let bestTime = parseTimestamp(candidates[0].timestamp);
    for (let i = 1; i < candidates.length; i++) {
      const lt = parseTimestamp(candidates[i].timestamp);
      if (lt > bestTime) {
        bestTime = lt;
        bestLead = candidates[i];
      }
    }
    return bestLead;
  }

  // Normal case: pick the lead whose timestamp is closest to (but not
  // after) the sale timestamp — i.e. smallest positive (saleTime - leadTime).
  let bestLead = candidates[0];
  let bestDiff = Infinity;

  for (const lead of candidates) {
    const leadTime = parseTimestamp(lead.timestamp);
    if (leadTime <= saleTime) {
      const diff = saleTime - leadTime;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestLead = lead;
      }
    }
  }

  // If no candidate preceded the sale, fall back to absolute closest.
  if (bestDiff === Infinity) {
    let closestDiff = Infinity;
    for (const lead of candidates) {
      const leadTime = parseTimestamp(lead.timestamp);
      const diff = Math.abs(leadTime - saleTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        bestLead = lead;
      }
    }
  }

  return bestLead;
}

export { normalizePhone };
