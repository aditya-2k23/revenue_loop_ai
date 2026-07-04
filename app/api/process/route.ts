import { NextRequest, NextResponse } from "next/server";
import { parseLeadsCSV, parseSalesCSV, parseSpendCSV } from "@/lib/csv-parser";
import { matchLeadsToSales } from "@/lib/matcher";
import { computeRoas } from "@/lib/roas-engine";
import type { RoasResult } from "@/lib/types";
import Groq from "groq-sdk";

export const runtime = "nodejs";

async function generateNarrative(roasResult: RoasResult): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return "";

  try {
    const groq = new Groq({ apiKey });

    const prompt = `You are a marketing analyst. Below is a JSON object containing per-campaign metrics from a lead-to-sale attribution analysis. Your job is to write a concise narrative (3–5 paragraphs) in plain business language. Focus on:

    1. Which campaigns have the highest true ROAS and which have the lowest.
    2. Where the divergence score is highest — these are campaigns where cost-per-lead ranking and true cost-per-acquisition ranking disagree most. Explain what that means in practical terms (e.g. "Campaign X looks cheap per lead but is actually expensive per real sale").
    3. Any campaigns generating lots of leads but very few sales (poor conversion).
    4. Actionable takeaways.

    DO NOT perform any calculations. Only narrate the numbers you are given. Be specific — reference campaign names and numbers.

    Data:
    ${JSON.stringify(roasResult, null, 2)}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    });

    return completion.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const leadsFile = formData.get("leadsFile") as File | null;
    const salesFile = formData.get("salesFile") as File | null;
    const spendFile = formData.get("spendFile") as File | null;

    if (!leadsFile) {
      return NextResponse.json(
        { error: "Leads CSV file is required." },
        { status: 400 },
      );
    }
    if (!salesFile) {
      return NextResponse.json(
        { error: "Sales CSV file is required." },
        { status: 400 },
      );
    }

    const allWarnings: string[] = [];

    const leadsText = await leadsFile.text();
    if (!leadsText.trim()) {
      return NextResponse.json(
        { error: "Leads CSV file is empty." },
        { status: 400 },
      );
    }
    const leadsResult = parseLeadsCSV(leadsText);
    allWarnings.push(...leadsResult.warnings);
    if (leadsResult.leads.length === 0) {
      return NextResponse.json(
        { error: "Leads CSV produced no rows. Check file format." },
        { status: 400 },
      );
    }

    const salesText = await salesFile.text();
    if (!salesText.trim()) {
      return NextResponse.json(
        { error: "Sales CSV file is empty." },
        { status: 400 },
      );
    }
    const salesResult = parseSalesCSV(salesText);
    allWarnings.push(...salesResult.warnings);
    if (salesResult.sales.length === 0) {
      return NextResponse.json(
        {
          error:
            "Sales CSV produced no rows (no won/converted deals found). Check file format and status column values.",
        },
        { status: 400 },
      );
    }

    let spendRows;
    if (spendFile) {
      const spendText = await spendFile.text();
      if (spendText.trim()) {
        const spendResult = parseSpendCSV(spendText);
        allWarnings.push(...spendResult.warnings);
        spendRows = spendResult.spend;
      }
    }

    const matchResult = matchLeadsToSales(leadsResult.leads, salesResult.sales);
    const roasResult = computeRoas(
      matchResult.matched,
      leadsResult.leads,
      spendRows,
    );

    const narrative = await generateNarrative(roasResult);

    const matchSummary = {
      matchedCount: matchResult.matched.length,
      unmatchedLeadsCount: matchResult.unmatchedLeads.length,
      unmatchedSalesCount: matchResult.unmatchedSales.length,
      matchRatePercent: matchResult.matchRatePercent,
    };

    return NextResponse.json({
      matchResult: matchSummary,
      roasResult,
      narrative,
      warnings: allWarnings,
      _matchedPairs: matchResult.matched,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unknown error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
