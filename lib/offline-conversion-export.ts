/**
 * Offline conversion export module.
 *
 * GOOGLE ADS: Produces a CSV matching the Google Ads Data Manager column
 * structure for "Enhanced Conversions for Leads" file uploads. Uses SHA-256
 * pre-hashed email/phone since GCLID is unavailable from CRM-only data.
 *
 * META: The Conversions API (CAPI) is a JSON POST to
 * https://graph.facebook.com/<version>/<DATASET_ID>/events — there is no
 * native CSV import. This module provides:
 *   - toMetaOfflineConversionCSV(): an intermediate/reference CSV that a
 *     backend can read and POST row-by-row to the CAPI. This is NOT a
 *     literal upload file that Meta accepts directly.
 *   - toMetaOfflineConversionPayload(): the actual JSON array structure
 *     ready to POST to the Conversions API endpoint.
 */

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
  if (digits.length === 0) return "";
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

function generateOrderId(pair: MatchedPair): string {
  const email = pair.sale.email ?? pair.lead.email ?? "";
  const phone = pair.sale.phone ?? pair.lead.phone ?? "";
  const ts = pair.sale.timestamp ?? "";
  const val = String(pair.sale.value ?? 0);
  return sha256(`${email}|${phone}|${ts}|${val}`).substring(0, 32);
}

// ---------------------------------------------------------------------------
// GOOGLE ADS — Data Manager CSV for Enhanced Conversions for Leads
// ---------------------------------------------------------------------------

/**
 * Produces a CSV matching the Google Ads Data Manager file upload schema
 * for "Enhanced Conversions for Leads."
 *
 * Column headers per the Data Manager template:
 *   Conversion Name  — must exactly match the conversion action name in Google Ads
 *   Conversion Time  — YYYY-MM-DD HH:MM:SS
 *   Conversion Value — numeric
 *   Conversion Currency — ISO 4217 (e.g. USD)
 *   Order ID         — dedup key to prevent duplicate conversions
 *   Hashed Email     — SHA-256, lowercased & trimmed before hashing
 *   Hashed Phone Number — SHA-256, digits with country code, no symbols
 *
 * GCLID/GBRAID columns are omitted because this pipeline works from
 * CRM-only data where click IDs are unavailable.
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
    "Conversion Name",
    "Conversion Time",
    "Conversion Value",
    "Conversion Currency",
    "Order ID",
    "Hashed Email",
    "Hashed Phone Number",
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
      generateOrderId(pair),
      hashedEmail,
      hashedPhone,
    ]);
  }

  return toCSVString(headers, rows);
}

// ---------------------------------------------------------------------------
// META — Intermediate reference CSV (NOT a direct Meta upload format)
// ---------------------------------------------------------------------------

/**
 * Produces an intermediate/reference CSV that mirrors the Meta Conversions
 * API event schema. This is a staging format a backend can read and POST
 * row-by-row to the CAPI — Meta does NOT accept CSV uploads directly.
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

// ---------------------------------------------------------------------------
// META — Actual Conversions API JSON payload
// ---------------------------------------------------------------------------

export interface MetaCAPIEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "system_generated";
  user_data: {
    em?: string[];
    ph?: string[];
  };
  custom_data: {
    value: number;
    currency: string;
  };
}

/**
 * Returns the JSON array of event objects ready to POST to the Meta
 * Conversions API endpoint:
 *   POST https://graph.facebook.com/v<version>/<DATASET_ID>/events
 *   Body: { "data": <returned array> }
 *
 * Each event follows Meta CAPI spec:
 *   - event_name: "Purchase" (or configurable)
 *   - event_time: Unix timestamp in seconds
 *   - event_id: deterministic dedup key
 *   - action_source: "system_generated" (CRM-originated offline events)
 *   - user_data.em: array of SHA-256 hashed emails (lowercased, trimmed)
 *   - user_data.ph: array of SHA-256 hashed phones (digits with country code)
 *   - custom_data.value: numeric conversion value
 *   - custom_data.currency: ISO 4217 currency code (lowercase per Meta convention)
 */
export function toMetaOfflineConversionPayload(
  pairs: MatchedPair[],
  options: {
    eventName?: string;
    currency?: string;
  } = {}
): MetaCAPIEvent[] {
  const eventName = options.eventName ?? "Purchase";
  const currency = (options.currency ?? "USD").toLowerCase();

  const events: MetaCAPIEvent[] = [];

  for (const pair of pairs) {
    const email = pair.sale.email ?? pair.lead.email;
    const phone = pair.sale.phone ?? pair.lead.phone;
    const hashedEmail = normalizeAndHashEmail(email);
    const hashedPhone = normalizeAndHashPhone(phone);

    if (!hashedEmail && !hashedPhone) continue;

    const eventTime = toUnixTimestamp(pair.sale.timestamp);
    const value = pair.sale.value ?? 0;

    const dedupSource = `${email ?? ""}|${phone ?? ""}|${pair.sale.timestamp ?? ""}|${value}`;
    const eventId = sha256(dedupSource);

    const userData: MetaCAPIEvent["user_data"] = {};
    if (hashedEmail) userData.em = [hashedEmail];
    if (hashedPhone) userData.ph = [hashedPhone];

    events.push({
      event_name: eventName,
      event_time: eventTime,
      event_id: eventId,
      action_source: "system_generated",
      user_data: userData,
      custom_data: {
        value,
        currency,
      },
    });
  }

  return events;
}
