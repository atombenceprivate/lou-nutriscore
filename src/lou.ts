import { createCalculator } from "./engine.js";
import type { ScoreInput, ScoreResult } from "./types.js";

/** Optional fan/parody presentation. It is not affiliated with or endorsed by any person or organisation. */
export const LOU_DISCLAIMER = "Lou+ is an optional, unofficial fan/parody presentation only. It is not a real nutrition classification and implies no endorsement or affiliation.";

export type LouLocale = "en" | "hu";
export type LouTone = "default" | "dramatic" | "deadpan";
export const louPreset = {
  schemaVersion: 1 as const,
  name: "lou",
  factors: [
    { key: "energy", label: "Energy", weight: 1, range: { min: 0, max: 10 } },
    { key: "vibe", label: "Vibe", weight: 2, range: { min: 0, max: 10 } },
    { key: "chaos", label: "Chaos", weight: 1, range: { min: 0, max: 10 }, invert: true },
  ],
  grades: [{ name: "MAXIMUM LOU", min: 95 }, { name: "EXTREMELY LOU", min: 85 }, { name: "HIGH LOU", min: 70 }, { name: "LOU+", min: 50 }, { name: "warm-up", min: 0 }],
};

export interface LouBadge { id: string; label: string; emoji: string; }
export interface LouResult extends ScoreResult { presentation: { title: string; disclaimer: string; narrative: string; locale: LouLocale; intensity: number; emoji: string }; badges: LouBadge[]; }
export function getLouBadges(input: ScoreInput, result: ScoreResult): LouBadge[] { const badges: LouBadge[] = []; if (result.score >= 95) badges.push({ id: "maximum", label: "Maximum Lou", emoji: "✨" }); if ((input.vibe ?? 0) >= 9) badges.push({ id: "vibe", label: "Vibe elevation", emoji: "⚡" }); if ((input.chaos ?? 10) <= 1) badges.push({ id: "calm", label: "Chaos tamer", emoji: "🫧" }); return badges; }
export function calculateLou(input: ScoreInput, locale: LouLocale = "en"): LouResult {
  const result = createCalculator(louPreset).calculate(input);
  return { ...result, badges: getLouBadges(input, result), presentation: { title: `${result.grade} · ${result.score.toFixed(0)}/100`, disclaimer: LOU_DISCLAIMER, narrative: `Energy, vibe and chaos combine into ${result.grade}.`, locale, intensity: result.score, emoji: result.score >= 85 ? "✨" : "🌟" } };
}
export function explainLou(input: ScoreInput): LouResult { return calculateLou(input); }
export function getLouReaction(result: LouResult, tone: LouTone = "default"): string { const text = result.score >= 85 ? "Maximum sparkle achieved." : result.score >= 70 ? "Strong Lou energy." : "Warm-up complete."; return tone === "dramatic" ? `✨ ${text.toUpperCase()} ✨` : tone === "deadpan" ? `${text} Not a real classification.` : text; }
export function compareLou(a: ScoreInput, b: ScoreInput) { const first = calculateLou(a), second = calculateLou(b); return { a: first, b: second, winner: second.score > first.score ? "b" : second.score < first.score ? "a" : "tie", delta: second.score - first.score }; }
export function createLouShareCardData(result: LouResult) { return { title: result.presentation.title, caption: "Purely playful scoring energy.", badges: result.badges, disclaimer: LOU_DISCLAIMER, theme: result.presentation }; }
export function generateLouChallenge(input: ScoreInput, locale: LouLocale = "en") { return { prompt: locale === "hu" ? "Emeld a vibe faktort 2 ponttal." : "Raise vibe by 2 points.", target: { key: "vibe", delta: 2 }, basedOn: input.vibe ?? 0 }; }
