import { NextRequest, NextResponse } from "next/server";
import { toGoogleAdsOfflineConversionCSV } from "@/lib/offline-conversion-export";
import type { MatchedPair } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pairs: MatchedPair[] = body.pairs;
    const options = {
      conversionName: body.conversionName,
      currency: body.currency,
    };

    if (!pairs || !Array.isArray(pairs) || pairs.length === 0) {
      return NextResponse.json(
        { error: "No matched pairs provided." },
        { status: 400 },
      );
    }

    const csv = toGoogleAdsOfflineConversionCSV(pairs, options);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition":
          'attachment; filename="google_ads_conversions.csv"',
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unknown error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
