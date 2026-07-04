import { createHash } from "crypto";
import type { MatchedPair } from "./types";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeAndHashEmail(email: string | undefined): string {
  if (!email) return "";
  const normalized = email.trim().toLowerCase();
  return sha256(normalized);
}

function normalizeAndHashPhone(phone: string | undefined): string {
  if (!phone) return "";
  let digits = phone.replace(/[\s\-\(\)\.\+]/g, "").replace(/[^0-9]/g, "");
  if (digits.length === 10) {
    digits = "1" + digits;
  }
  return sha256(digits);
}

function formatTimestampGoogle(ts: string | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function toUnixTimestamp(ts: string | undefined): number {
  if (!ts) return 0;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return 0;
  return Math.floor(d.getTime() / 1000);
}

function escapeCSVField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function toCSVString(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCSVField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCSVField).join(","));
  }
  return lines.join("\n");
}

/**
 * Google Ads enhanced conversions for leads — uses SHA-256 hashed email/phone
 * since GCLID is unavailable from CRM-only data.
 *
 * Fields per Google Ads Data Manager / enhanced conversion upload schema:
 * - Parameters.ConversionName
 * - Parameters.ConversionTime (YYYY-MM-DD HH:MM:SS)
 * - Parameters.ConversionValue
 * - Parameters.ConversionCurrency
 * - Parameters.HashedEmail (SHA-256, lowercased, trimmed)
 * - Parameters.HashedPhoneNumber (SHA-256, with country code, digits only)
 */
export function toGoogleAdsOfflineConversionCSV(
  pairs: MatchedPair[],
  options: {
    conversionName?: string;
    currency?: string;
  } = {}
): string {
  const conversionName = options.conversionName ?? "Offline Sale";
  const currency = options.currency ?? "USD";

  const headers = [
    "Parameters.ConversionName",
    "Parameters.ConversionTime",
    "Parameters.ConversionValue",
    "Parameters.ConversionCurrency",
    "Parameters.HashedEmail",
    "Parameters.HashedPhoneNumber",
  ];

  const rows: string[][] = [];

  for (const pair of pairs) {
    const hashedEmail = normalizeAndHashEmail(
      pair.sale.email ?? pair.lead.email
    );
    const hashedPhone = normalizeAndHashPhone(
      pair.sale.phone ?? pair.lead.phone
    );

    if (!hashedEmail && !hashedPhone) continue;

    rows.push([
      conversionName,
      formatTimestampGoogle(pair.sale.timestamp),
      String(pair.sale.value ?? 0),
      currency,
      hashedEmail,
      hashedPhone,
    ]);
  }

  return toCSVString(headers, rows);
}

/**
 * Meta Conversions API offline events schema.
 *
 * Fields per Meta CAPI:
 * - event_name: "Purchase" (or configurable)
 * - event_time: Unix timestamp (seconds)
 * - event_source_url: empty for offline
 * - action_source: "system_generated" for CRM-originated events
 * - user_data.em: SHA-256 hashed email (lowercased, trimmed)
 * - user_data.ph: SHA-256 hashed phone (digits with country code)
 * - custom_data.value: numeric conversion value
 * - custom_data.currency: ISO 4217 currency code
 * - event_id: dedup key (generated from hash of pair data)
 */
export function toMetaOfflineConversionCSV(
  pairs: MatchedPair[],
  options: {
    eventName?: string;
    currency?: string;
  } = {}
): string {
  const eventName = options.eventName ?? "Purchase";
  const currency = options.currency ?? "USD";

  const headers = [
    "event_name",
    "event_time",
    "action_source",
    "user_data.em",
    "user_data.ph",
    "custom_data.value",
    "custom_data.currency",
    "event_id",
  ];

  const rows: string[][] = [];

  for (const pair of pairs) {
    const email = pair.sale.email ?? pair.lead.email;
    const phone = pair.sale.phone ?? pair.lead.phone;
    const hashedEmail = normalizeAndHashEmail(email);
    const hashedPhone = normalizeAndHashPhone(phone);

    if (!hashedEmail && !hashedPhone) continue;

    const eventTime = toUnixTimestamp(pair.sale.timestamp);
    const value = String(pair.sale.value ?? 0);

    const dedupSource = `${email ?? ""}|${phone ?? ""}|${pair.sale.timestamp ?? ""}|${value}`;
    const eventId = sha256(dedupSource);

    rows.push([
      eventName,
      String(eventTime),
      "system_generated",
      hashedEmail,
      hashedPhone,
      value,
      currency,
      eventId,
    ]);
  }

  return toCSVString(headers, rows);
}
