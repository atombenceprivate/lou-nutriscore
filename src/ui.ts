import type { ScoreResult } from "./types.js";
/** Framework-neutral view model; usable from React, Vue, Svelte, or plain DOM. */
export function createScoreViewModel(result: ScoreResult) { return { score: result.score, grade: result.grade, label: result.gradeLabel ?? result.grade, explanation: result.explanation, factors: result.breakdown.map((factor) => ({ ...factor, percentage: factor.normalizedScore })), warnings: result.warnings, ariaLabel: `Score ${result.score.toFixed(1)}, grade ${result.grade}` }; }
