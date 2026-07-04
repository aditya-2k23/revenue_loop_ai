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

export interface MatchResult {
  matched: MatchedPair[];
  unmatchedLeads: Lead[];
  unmatchedSales: Sale[];
  matchRatePercent: number;
}

export interface CampaignMetrics {
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
