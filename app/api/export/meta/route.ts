import { NextRequest, NextResponse } from "next/server";
import { toMetaOfflineConversionPayload } from "@/lib/offline-conversion-export";
import type { MatchedPair } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pairs: MatchedPair[] = body.pairs;
    const options = {
      eventName: body.eventName,
      currency: body.currency,
    };

    if (!pairs || !Array.isArray(pairs) || pairs.length === 0) {
      return NextResponse.json(
        { error: "No matched pairs provided." },
        { status: 400 }
      );
    }

    const events = toMetaOfflineConversionPayload(pairs, options);
    const payload = JSON.stringify({ data: events }, null, 2);

    return new NextResponse(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="meta_capi_events.json"',
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unknown error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
