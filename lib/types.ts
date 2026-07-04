export interface SpendByCampaign {
  [campaign: string]: number;
}

export interface CampaignAccumulator {
  campaign: string;
  displayName: string;
  leadCount: number;
  touchedSaleCount: number;
  creditedSaleCount: number;
  totalRevenue: number;
}

export interface NormalizedRow {
  fields: Record<string, string | undefined>;
  _raw: Record<string, string>;
}

export interface ParseResult {
  rows: NormalizedRow[];
  unmappedColumns: string[];
  warnings: string[];
}

export interface Lead {
  email?: string;
  phone?: string;
  campaign?: string;
  creative?: string;
  timestamp?: string;
  _raw: Record<string, string>;
}

export interface Sale {
  email?: string;
  phone?: string;
  value?: number;
  status?: string;
  timestamp?: string;
  _raw: Record<string, string>;
}

export interface SpendRow {
  campaign?: string;
  date?: string;
  spend?: number;
  _raw: Record<string, string>;
}

export interface MatchedPair {
  lead: Lead;
  sale: Sale;
  matchBasis: "email" | "phone";
}

export type MatchBasis = "email" | "phone" | "email_phone";

export interface SaleTouch {
  lead: Lead;
  matchBasis: MatchBasis;
}

export interface SaleTouchGraph {
  sale: Sale;
  touches: SaleTouch[];
}

export interface MatchResult {
  touchGraph: SaleTouchGraph[];
  lastTouchPairs: MatchedPair[];
  unmatchedLeads: Lead[];
  unmatchedSales: Sale[];
  matchRatePercent: number;
}

export type AttributionModel =
  | "last-touch"
  | "first-touch"
  | "linear"
  | "time-decay"
  | "position-based";

export interface AttributionOptions {
  model: AttributionModel;
  halfLifeDays?: number;
}

export interface CampaignMetrics {
  campaign: string;
  totalLeads: number;
  touchedSales: number;
  creditedSales: number;
  totalSales: number;
  totalRevenue: number;
  costPerLead: number | null;
  costPerAcquisition: number | null;
  roas: number | null;
  totalSpend: number | null;
  divergenceScore: number | null;
}

export interface RoasResult {
  campaigns: CampaignMetrics[];
  totals: {
    totalLeads: number;
    totalSales: number;
    totalRevenue: number;
    totalSpend: number | null;
    overallRoas: number | null;
  };
}

export type SynonymMap = Record<string, string[]>;

export interface MatchSummary {
  matchedCount: number;
  matchedSalesCount: number;
  unmatchedLeadsCount: number;
  unmatchedSalesCount: number;
  matchRatePercent: number;
}

export interface ProcessResponse {
  matchResult: MatchSummary;
  roasResult: RoasResult;
  narrative: string;
  warnings: string[];
  touchGraph: SaleTouchGraph[];
  allLeads: Lead[];
  spendRows?: SpendRow[];
  error?: string;
}
