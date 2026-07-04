import Papa from "papaparse";
import type {
  NormalizedRow,
  ParseResult,
  Lead,
  Sale,
  SpendRow,
  SynonymMap,
} from "./types";

const DEFAULT_SYNONYMS: SynonymMap = {
  email: [
    "email",
    "email_address",
    "emailaddress",
    "contact_email",
    "contactemail",
    "e-mail",
    "e_mail",
    "mail",
    "user_email",
    "useremail",
    "lead_email",
    "leademail",
    "customer_email",
    "customeremail",
  ],
  phone: [
    "phone",
    "phone_number",
    "phonenumber",
    "phone_no",
    "phoneno",
    "contact_phone",
    "contactphone",
    "mobile",
    "mobile_number",
    "mobilenumber",
    "tel",
    "telephone",
    "cell",
    "cell_phone",
    "cellphone",
    "contact_number",
    "contactnumber",
  ],
  campaign: [
    "campaign",
    "campaign_name",
    "campaignname",
    "utm_campaign",
    "utmcampaign",
    "campaign_id",
    "campaignid",
    "ad_campaign",
    "adcampaign",
  ],
  creative: [
    "creative",
    "creative_name",
    "creativename",
    "ad_name",
    "adname",
    "ad",
    "ad_creative",
    "adcreative",
    "ad_set",
    "adset",
    "ad_set_name",
    "adsetname",
    "ad_group",
    "adgroup",
  ],
  timestamp: [
    "timestamp",
    "date",
    "datetime",
    "date_time",
    "created_at",
    "createdat",
    "created",
    "created_date",
    "createddate",
    "lead_date",
    "leaddate",
    "conversion_date",
    "conversiondate",
    "conversion_time",
    "conversiontime",
    "sale_date",
    "saledate",
    "close_date",
    "closedate",
    "closed_at",
    "closedat",
    "time",
    "event_time",
    "eventtime",
  ],
  value: [
    "value",
    "deal_value",
    "dealvalue",
    "sale_value",
    "salevalue",
    "revenue",
    "amount",
    "deal_amount",
    "dealamount",
    "sale_amount",
    "saleamount",
    "total",
    "total_value",
    "totalvalue",
    "price",
    "order_value",
    "ordervalue",
    "conversion_value",
    "conversionvalue",
  ],
  status: [
    "status",
    "deal_status",
    "dealstatus",
    "stage",
    "deal_stage",
    "dealstage",
    "won",
    "is_won",
    "iswon",
    "converted",
    "is_converted",
    "isconverted",
    "closed_won",
    "closedwon",
    "outcome",
    "result",
  ],
  spend: [
    "spend",
    "cost",
    "amount_spent",
    "amountspent",
    "ad_spend",
    "adspend",
    "total_spend",
    "totalspend",
    "budget",
    "daily_spend",
    "dailyspend",
    "media_cost",
    "mediacost",
    "total_cost",
    "totalcost",
  ],
};

function normalizeHeaderForMatching(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildColumnMapping(
  rawHeaders: string[],
  synonyms: SynonymMap
): { mapping: Record<string, string>; unmapped: string[] } {
  const mapping: Record<string, string> = {};
  const unmapped: string[] = [];
  const normalizedSynonyms: Record<string, string[]> = {};

  for (const [canonical, syns] of Object.entries(synonyms)) {
    normalizedSynonyms[canonical] = syns.map(normalizeHeaderForMatching);
  }

  for (const rawHeader of rawHeaders) {
    const normalized = normalizeHeaderForMatching(rawHeader);
    let matched = false;

    for (const [canonical, normalizedSyns] of Object.entries(
      normalizedSynonyms
    )) {
      if (normalizedSyns.includes(normalized)) {
        if (!(canonical in mapping)) {
          mapping[canonical] = rawHeader;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      unmapped.push(rawHeader);
    }
  }

  return { mapping, unmapped };
}

export function parseCSV(
  csvText: string,
  synonyms: SynonymMap = DEFAULT_SYNONYMS
): ParseResult {
  const warnings: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    for (const err of parsed.errors) {
      warnings.push(
        `CSV parse warning at row ${err.row ?? "?"}: ${err.message}`
      );
    }
  }

  if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
    return { rows: [], unmappedColumns: [], warnings: ["No headers found in CSV."] };
  }

  const { mapping, unmapped } = buildColumnMapping(
    parsed.meta.fields,
    synonyms
  );

  const rows: NormalizedRow[] = parsed.data.map((rawRow) => {
    const fields: Record<string, string | undefined> = {};

    for (const [canonical, rawHeader] of Object.entries(mapping)) {
      const val = rawRow[rawHeader];
      fields[canonical] = val !== undefined && val !== "" ? val.trim() : undefined;
    }

    return { fields, _raw: { ...rawRow } };
  });

  return { rows, unmappedColumns: unmapped, warnings };
}

function isWonStatus(raw: string | undefined): boolean {
  if (!raw) return false;
  const lower = raw.trim().toLowerCase();
  return [
    "won",
    "closed won",
    "closedwon",
    "closed-won",
    "converted",
    "yes",
    "true",
    "1",
    "sale",
    "paid",
    "completed",
  ].includes(lower);
}

export function parseLeadsCSV(
  csvText: string,
  synonyms: SynonymMap = DEFAULT_SYNONYMS
): { leads: Lead[]; unmappedColumns: string[]; warnings: string[] } {
  const result = parseCSV(csvText, synonyms);
  const warnings = [...result.warnings];

  const hasEmail = result.rows.some((r) => r.fields.email);
  const hasPhone = result.rows.some((r) => r.fields.phone);
  if (!hasEmail && !hasPhone) {
    warnings.push(
      "No email or phone column detected in leads CSV. Matching will not be possible."
    );
  }
  if (!result.rows.some((r) => r.fields.campaign)) {
    warnings.push("No campaign column detected in leads CSV.");
  }
  if (!result.rows.some((r) => r.fields.timestamp)) {
    warnings.push("No timestamp column detected in leads CSV.");
  }

  const leads: Lead[] = result.rows.map((row) => ({
    email: row.fields.email?.toLowerCase(),
    phone: row.fields.phone,
    campaign: row.fields.campaign,
    creative: row.fields.creative,
    timestamp: row.fields.timestamp,
    _raw: row._raw,
  }));

  return { leads, unmappedColumns: result.unmappedColumns, warnings };
}

export function parseSalesCSV(
  csvText: string,
  synonyms: SynonymMap = DEFAULT_SYNONYMS
): { sales: Sale[]; unmappedColumns: string[]; warnings: string[] } {
  const result = parseCSV(csvText, synonyms);
  const warnings = [...result.warnings];

  const hasEmail = result.rows.some((r) => r.fields.email);
  const hasPhone = result.rows.some((r) => r.fields.phone);
  if (!hasEmail && !hasPhone) {
    warnings.push(
      "No email or phone column detected in sales CSV. Matching will not be possible."
    );
  }
  if (!result.rows.some((r) => r.fields.value)) {
    warnings.push("No value/revenue column detected in sales CSV.");
  }
  if (!result.rows.some((r) => r.fields.status)) {
    warnings.push(
      "No status column detected in sales CSV. All rows will be treated as conversions."
    );
  }

  const sales: Sale[] = result.rows
    .filter((row) => {
      if (row.fields.status !== undefined) {
        return isWonStatus(row.fields.status);
      }
      return true;
    })
    .map((row) => ({
      email: row.fields.email?.toLowerCase(),
      phone: row.fields.phone,
      value: row.fields.value ? parseFloat(row.fields.value) : undefined,
      status: row.fields.status,
      timestamp: row.fields.timestamp,
      _raw: row._raw,
    }));

  return { sales, unmappedColumns: result.unmappedColumns, warnings };
}

export function parseSpendCSV(
  csvText: string,
  synonyms: SynonymMap = DEFAULT_SYNONYMS
): { spend: SpendRow[]; unmappedColumns: string[]; warnings: string[] } {
  const result = parseCSV(csvText, synonyms);
  const warnings = [...result.warnings];

  if (!result.rows.some((r) => r.fields.campaign)) {
    warnings.push("No campaign column detected in spend CSV.");
  }
  if (!result.rows.some((r) => r.fields.spend)) {
    warnings.push("No spend/cost column detected in spend CSV.");
  }

  const spend: SpendRow[] = result.rows.map((row) => ({
    campaign: row.fields.campaign,
    date: row.fields.timestamp,
    spend: row.fields.spend ? parseFloat(row.fields.spend) : undefined,
    _raw: row._raw,
  }));

  return { spend, unmappedColumns: result.unmappedColumns, warnings };
}

export { DEFAULT_SYNONYMS };
