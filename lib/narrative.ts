import Groq from "groq-sdk";
import type { AttributionOptions, RoasResult } from "./types";

const GROQ_NARRATIVE_MODEL = "openai/gpt-oss-120b";

function describeAttribution(options: AttributionOptions): string {
  if (options.model === "time-decay") {
    return `time-decay attribution with ${options.halfLifeDays ?? 7} day half-life`;
  }
  return `${options.model} attribution`;
}

export async function generateNarrative(
  roasResult: RoasResult,
  attributionOptions: AttributionOptions,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is not set.");
    return "";
  }

  try {
    const groq = new Groq({ apiKey });
    const hasSpendData = roasResult.totals.totalSpend !== null;

    // Prevent rate limits by capping the number of campaigns passed to the LLM (e.g., Groq's 8k TPM limit).
    let campaignsToInclude = roasResult.campaigns;
    if (campaignsToInclude.length > 12) {
      const topRoas = [...campaignsToInclude].sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0)).slice(0, 3);
      const bottomRoas = [...campaignsToInclude].sort((a, b) => (a.roas ?? 0) - (b.roas ?? 0)).slice(0, 3);
      const topDivergence = [...campaignsToInclude].sort((a, b) => (b.divergenceScore ?? 0) - (a.divergenceScore ?? 0)).slice(0, 3);
      const topLeads = [...campaignsToInclude].sort((a, b) => b.totalLeads - a.totalLeads).slice(0, 3);

      const combined = new Set([...topRoas, ...bottomRoas, ...topDivergence, ...topLeads]);
      campaignsToInclude = Array.from(combined);
    }

    const promptPayload = {
      totals: roasResult.totals,
      campaigns: campaignsToInclude,
      note: campaignsToInclude.length < roasResult.campaigns.length 
        ? `Data truncated to top/bottom ${campaignsToInclude.length} significant campaigns to fit context.` 
        : undefined
    };

    const prompt = `You are a marketing analyst. Below is a JSON object containing per-campaign metrics from a lead-to-sale attribution analysis.

    Attribution context:
    - These metrics were computed using ${describeAttribution(attributionOptions)}.

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
    ${JSON.stringify(promptPayload)}`;

    const completion = await groq.chat.completions.create({
      model: GROQ_NARRATIVE_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    });

    return completion.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    console.error("Error generating narrative:", error);
    return "";
  }
}
