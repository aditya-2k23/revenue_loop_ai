import type { AttributionOptions, Lead, Sale } from "./types";

const DEFAULT_HALF_LIFE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseTimestamp(ts: string | undefined): number | null {
  if (!ts) return null;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeWeights(weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return weights.map(() => 1 / weights.length);
  }
  return weights.map((weight) => weight / total);
}

function getReferenceTime(sale: Sale, touches: Lead[]): number | null {
  const saleTime = parseTimestamp(sale.timestamp);
  if (saleTime !== null) return saleTime;

  const leadTimes = touches
    .map((touch) => parseTimestamp(touch.timestamp))
    .filter((time): time is number => time !== null);

  return leadTimes.length > 0 ? Math.max(...leadTimes) : null;
}

export function getAttributionWeights(
  touches: Lead[],
  sale: Sale,
  options: AttributionOptions = { model: "last-touch" },
): number[] {
  const count = touches.length;
  if (count === 0) return [];
  if (count === 1) return [1];

  if (options.model === "first-touch") {
    return touches.map((_, index) => (index === 0 ? 1 : 0));
  }

  if (options.model === "linear") {
    return touches.map(() => 1 / count);
  }

  if (options.model === "position-based") {
    if (count === 2) return [0.5, 0.5];
    const middleWeight = 0.2 / (count - 2);
    return touches.map((_, index) => {
      if (index === 0 || index === count - 1) return 0.4;
      return middleWeight;
    });
  }

  if (options.model === "time-decay") {
    const referenceTime = getReferenceTime(sale, touches);
    if (referenceTime === null) return touches.map(() => 1 / count);

    const halfLifeDays =
      options.halfLifeDays && options.halfLifeDays > 0
        ? options.halfLifeDays
        : DEFAULT_HALF_LIFE_DAYS;
    const halfLifeMs = halfLifeDays * DAY_MS;

    const rawWeights = touches.map((touch) => {
      const touchTime = parseTimestamp(touch.timestamp);
      if (touchTime === null) return 1;
      const ageMs = Math.max(0, referenceTime - touchTime);
      return Math.pow(0.5, ageMs / halfLifeMs);
    });

    return normalizeWeights(rawWeights);
  }

  return touches.map((_, index) => (index === count - 1 ? 1 : 0));
}
