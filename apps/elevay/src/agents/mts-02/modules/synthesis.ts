import type { MtsOutput, SynthesisData } from "../types";

type SynthesisInput = Omit<MtsOutput, "synthesis">;

/** Synthesize all module data into opportunities, threats, and recommendations */
export async function synthesize(_data: SynthesisInput): Promise<SynthesisData> {
  // TODO: call LLM (callLLM from _shared/llm.ts) to synthesize findings
  return {
    opportunities: [],
    threats: [],
    recommendations: [],
  };
}
