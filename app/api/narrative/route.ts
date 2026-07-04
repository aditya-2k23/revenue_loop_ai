import { NextRequest, NextResponse } from "next/server";
import { generateNarrative } from "@/lib/narrative";
import type { AttributionOptions, RoasResult } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const roasResult = body.roasResult as RoasResult | undefined;
    const attribution = body.attribution as AttributionOptions | undefined;

    if (!roasResult) {
      return NextResponse.json(
        { error: "RoasResult is required." },
        { status: 400 },
      );
    }

    if (!attribution?.model) {
      return NextResponse.json(
        { error: "Attribution model is required." },
        { status: 400 },
      );
    }

    const narrative = await generateNarrative(roasResult, attribution);

    return NextResponse.json({ narrative });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unknown error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
