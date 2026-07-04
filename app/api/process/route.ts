import { NextRequest, NextResponse } from "next/server";
import { parseLeadsCSV, parseSalesCSV, parseSpendCSV } from "@/lib/csv-parser";
import { matchLeadsToSales } from "@/lib/matcher";
import { computeRoas } from "@/lib/roas-engine";

export const runtime = "nodejs";

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
