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
    const hasSpendData = roasResult.totals.totalSpend !== null;

    const prompt = `You are a marketing analyst. Below is a JSON object containing per-campaign metrics from a lead-to-sale attribution analysis.

    Schema notes:
    - costPerLead / costPerAcquisition / roas / totalSpend are null when no spend data was provided for that campaign. Never invent or estimate these — treat null as "unknown," not zero.
    - divergenceScore (0 to 1) measures how much a campaign's cost-per-lead rank disagrees with its cost-per-acquisition rank (or, when no spend data exists, how much its lead-volume rank disagrees with its revenue rank). Higher = bigger disagreement between the two rankings.

    Write a concise narrative (3-5 paragraphs) in plain business language. Focus on:

    1. Which campaigns have the highest true ROAS and which have the lowest. ${hasSpendData ? "" : "NOTE: No spend data was provided, so ROAS/CPL/CPA are all null for every campaign — skip this point entirely rather than guessing."}
    2. Where the divergence score is highest. Explain what that means in practical terms (e.g. "Campaign X looks cheap per lead but is actually expensive per real sale").
    3. Any campaigns generating lots of leads but very few sales (poor conversion).
    4. Actionable takeaways.

    Rules:
    - DO NOT perform any calculations. Only narrate numbers already present in the data below.
    - Every number you cite must appear verbatim in the data — no rounding, no estimating, no averaging.
    - Be specific — reference campaign names and exact numbers.
    - If a section has no supporting data (e.g. all spend fields are null), omit that section instead of speculating.

    Data:
    ${JSON.stringify(roasResult, null, 2)}`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
      reasoning_effort: "high",
      reasoning_format: "hidden",
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
      matchResult.touchGraph,
      leadsResult.leads,
      spendRows,
    );

    const narrative = await generateNarrative(roasResult);

    const matchSummary = {
      matchedCount:
        leadsResult.leads.length - matchResult.unmatchedLeads.length,
      matchedSalesCount: matchResult.touchGraph.length,
      unmatchedLeadsCount: matchResult.unmatchedLeads.length,
      unmatchedSalesCount: matchResult.unmatchedSales.length,
      matchRatePercent: matchResult.matchRatePercent,
    };

    return NextResponse.json({
      matchResult: matchSummary,
      roasResult,
      narrative,
      warnings: allWarnings,
      touchGraph: matchResult.touchGraph,
      allLeads: leadsResult.leads,
      spendRows,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unknown error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
