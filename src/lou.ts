import { createCalculator } from "./engine.js";
import type { ScoreConfig, ScoreInput, ScoreResult } from "./types.js";

/** Optional fan/parody presentation. It is not affiliated with or endorsed by any person or organisation. */
export const LOU_DISCLAIMER = "Lou+ is an optional fan/parody presentation only. It is not an official product and implies no endorsement or affiliation.";

export const louPreset: ScoreConfig = {
  schemaVersion: 1,
  name: "lou",
  factors: [
    { key: "energy", label: "Energy", weight: 1, range: { min: 0, max: 10 } },
    { key: "vibe", label: "Vibe", weight: 2, range: { min: 0, max: 10 } },
    { key: "chaos", label: "Chaos", weight: 1, range: { min: 0, max: 10 }, invert: true },
  ],
  grades: [{ name: "LOU+", min: 80 }, { name: "LOU", min: 60 }, { name: "warm-up", min: 0 }],
};

export interface LouResult extends ScoreResult { presentation: { title: string; disclaimer: string }; }
export function calculateLou(input: ScoreInput): LouResult {
  const result = createCalculator(louPreset).calculate(input);
  return { ...result, presentation: { title: `${result.grade} · ${result.score.toFixed(0)}/100`, disclaimer: LOU_DISCLAIMER } };
}
