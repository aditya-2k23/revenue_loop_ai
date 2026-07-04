import type {
  Lead,
  Sale,
  MatchedPair,
  MatchBasis,
  MatchResult,
  SaleTouch,
  SaleTouchGraph,
} from "./types";

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
  const touchGraph: SaleTouchGraph[] = [];
  const usedSaleIndices = new Set<number>();

  const emailToLeads = new Map<string, Lead[]>();
  for (const lead of leads) {
    const email = normalizeEmail(lead.email);
    if (email) {
      const existing = emailToLeads.get(email) || [];
      existing.push(lead);
      emailToLeads.set(email, existing);
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
  const leadOrder = new Map<Lead, number>();
  leads.forEach((lead, index) => leadOrder.set(lead, index));

  for (let si = 0; si < sales.length; si++) {
    const sale = sales[si];
    const candidates = new Map<Lead, Set<"email" | "phone">>();

    const saleEmail = normalizeEmail(sale.email);
    if (saleEmail) {
      const candidateLeads = emailToLeads.get(saleEmail);
      if (candidateLeads) {
        for (const lead of candidateLeads) {
          const basis = candidates.get(lead) || new Set<"email" | "phone">();
          basis.add("email");
          candidates.set(lead, basis);
        }
      }
    }

    const saleNormPhone = normalizePhone(sale.phone);
    if (saleNormPhone) {
      const candidateLeads = phoneToLeads.get(saleNormPhone);
      if (candidateLeads) {
        for (const lead of candidateLeads) {
          const basis = candidates.get(lead) || new Set<"email" | "phone">();
          basis.add("phone");
          candidates.set(lead, basis);
        }
      }
    }

    if (candidates.size === 0) continue;

    const touches: SaleTouch[] = Array.from(candidates.entries())
      .map(([lead, basisSet]) => ({
        lead,
        matchBasis: toMatchBasis(basisSet),
      }))
      .sort((a, b) => {
        const timeDiff =
          parseTimestamp(a.lead.timestamp) - parseTimestamp(b.lead.timestamp);
        if (timeDiff !== 0) return timeDiff;
        return (leadOrder.get(a.lead) ?? 0) - (leadOrder.get(b.lead) ?? 0);
      });

    for (const touch of touches) {
      matchedLeadRefs.add(touch.lead);
    }
    usedSaleIndices.add(si);
    touchGraph.push({ sale, touches });
  }

  const unmatchedLeads = leads.filter((l) => !matchedLeadRefs.has(l));
  const unmatchedSales = sales.filter((_, i) => !usedSaleIndices.has(i));

  const totalLeads = leads.length;
  const matchRatePercent =
    totalLeads > 0
      ? Math.round((matchedLeadRefs.size / totalLeads) * 10000) / 100
      : 0;

  return {
    touchGraph,
    lastTouchPairs: touchGraphToLastTouchPairs(touchGraph),
    unmatchedLeads,
    unmatchedSales,
    matchRatePercent,
  };
}

function normalizeEmail(raw: string | undefined): string | null {
  const normalized = raw?.trim().toLowerCase();
  return normalized || null;
}

function toMatchBasis(basisSet: Set<"email" | "phone">): MatchBasis {
  if (basisSet.has("email") && basisSet.has("phone")) return "email_phone";
  if (basisSet.has("email")) return "email";
  return "phone";
}

function exportMatchBasis(basis: MatchBasis): "email" | "phone" {
  return basis === "phone" ? "phone" : "email";
}

function pickLastTouch(touches: SaleTouch[], sale: Sale): SaleTouch {
  if (touches.length === 1) return touches[0];

  const candidates = touches.map((touch) => touch.lead);
  const pickedLead = pickLastTouchLead(candidates, sale);
  return touches.find((touch) => touch.lead === pickedLead) ?? touches[touches.length - 1];
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

export function touchGraphToLastTouchPairs(
  touchGraph: SaleTouchGraph[],
): MatchedPair[] {
  return touchGraph.map((saleGraph) => {
    const touch = pickLastTouch(saleGraph.touches, saleGraph.sale);
    return {
      lead: touch.lead,
      sale: saleGraph.sale,
      matchBasis: exportMatchBasis(touch.matchBasis),
    };
  });
}

export { normalizePhone };
