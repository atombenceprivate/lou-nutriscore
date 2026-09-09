import { createCalculator, validateConfig } from "./engine.js";
import { ScoreConfigError } from "./errors.js";
import type { AuditEntry, Calculator, Constraint, ConstraintResult, DatasetNormalizationStrategy, RankedResult, ScoreConfig, ScoreInput, ScoreResult, ScoreStatistics, WeightSimulation } from "./types.js";

const average = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
export function rank(calculator: Calculator, dataset: readonly ScoreInput[]): RankedResult[] {
  const ordered = dataset.map((input, index) => ({ input, result: calculator.calculate(input), index })).sort((a, b) => b.result.score - a.result.score || a.index - b.index);
  let previousScore: number | undefined, previousRank = 0;
  return ordered.map((item, index) => { const itemRank = item.result.score === previousScore ? previousRank : index + 1; previousScore = item.result.score; previousRank = itemRank; return { input: item.input, result: item.result, rank: itemRank, percentile: ordered.length <= 1 ? 100 : ((ordered.length - index - 1) / (ordered.length - 1)) * 100 }; });
}
export function top(calculator: Calculator, dataset: readonly ScoreInput[], count: number): RankedResult[] { return rank(calculator, dataset).slice(0, Math.max(0, count)); }
export function statistics(results: readonly ScoreResult[]): ScoreStatistics {
  if (!results.length) throw new ScoreConfigError("Statistics need at least one result.");
  const scores = results.map((r) => r.score).sort((a, b) => a - b), mean = average(scores), mid = Math.floor(scores.length / 2);
  const grades: Record<string, number> = {}, distribution: Record<string, number> = {};
  for (const r of results) { grades[r.grade] = (grades[r.grade] ?? 0) + 1; const bucket = `${Math.floor(r.score / 10) * 10}-${Math.floor(r.score / 10) * 10 + 9}`; distribution[bucket] = (distribution[bucket] ?? 0) + 1; }
  return { count: scores.length, mean, median: scores.length % 2 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2, min: scores[0], max: scores.at(-1)!, standardDeviation: Math.sqrt(average(scores.map((x) => (x - mean) ** 2))), grades, distribution };
}
export function normalizeDataset(dataset: readonly ScoreInput[], keys: readonly string[], strategy: DatasetNormalizationStrategy): ScoreInput[] {
  const values = Object.fromEntries(keys.map((key) => [key, dataset.map((row) => row[key]).filter(Number.isFinite) as number[]]));
  return dataset.map((row) => ({ ...row, ...Object.fromEntries(keys.map((key) => { const xs = values[key], value = row[key]; if (!Number.isFinite(value) || !xs.length) return [key, value]; const min = Math.min(...xs), max = Math.max(...xs), mean = average(xs), sd = Math.sqrt(average(xs.map((x) => (x - mean) ** 2))); const sorted = [...xs].sort((a,b)=>a-b); const normalized = strategy === "minMax" ? (max === min ? 50 : ((value! - min) / (max - min)) * 100) : strategy === "zScore" ? (sd === 0 ? 0 : (value! - mean) / sd) : (sorted.findIndex((x) => x >= value!) / Math.max(1, sorted.length - 1)) * 100; return [key, normalized]; })) }));
}
export function evaluateConstraints(input: ScoreInput, result: ScoreResult, constraints: readonly Constraint[]): ConstraintResult[] { return constraints.map((rule) => ({ name: rule.name, passed: !rule.when(input, result), message: rule.when(input, result) ? rule.message ?? "Constraint triggered." : undefined })); }
export function confidence(input: ScoreInput, requiredKeys: readonly string[]): number { return requiredKeys.length ? requiredKeys.filter((key) => Number.isFinite(input[key])).length / requiredKeys.length : 1; }
export function createAuditTrail(result: ScoreResult, constraints: readonly ConstraintResult[] = []): AuditEntry[] { return [...result.breakdown.map((item) => ({ step: "factor" as const, data: { ...item } })), { step: "score" as const, data: { score: result.score } }, { step: "grade" as const, data: { grade: result.grade } }, ...constraints.map((item) => ({ step: "constraint" as const, data: { ...item } }))]; }
export function simulateWeights(config: ScoreConfig, dataset: readonly ScoreInput[], variants: readonly Record<string, number>[]): WeightSimulation[] { return variants.map((weights) => { const candidate: ScoreConfig = { ...config, factors: config.factors.map((factor) => ({ ...factor, weight: weights[factor.key] ?? factor.weight })) }; validateConfig(candidate); const calculator = createCalculator(candidate), results = calculator.calculateMany(dataset); return { weights, results, ranking: rank(calculator, dataset) }; }); }
export async function* scoreStream(calculator: Calculator, input: AsyncIterable<ScoreInput>): AsyncGenerator<ScoreResult> { for await (const row of input) yield calculator.calculateAsync(row); }
export function generateConfigSchema(): Record<string, unknown> { return { type: "object", required: ["schemaVersion", "factors", "grades"], properties: { schemaVersion: { const: 1 }, factors: { type: "array", minItems: 1 }, grades: { type: "array", minItems: 1 } } }; }
export function generateInputSchema(config: ScoreConfig): Record<string, unknown> { return { type: "object", properties: Object.fromEntries(config.factors.filter((f) => !f.evaluate).map((f) => [f.source ?? f.key, { type: "number" }])) }; }
const presets = new Map<string, ScoreConfig>();
export function registerPreset(name: string, config: ScoreConfig): void { if (!name) throw new ScoreConfigError("Preset name is required."); validateConfig(config); presets.set(name, config); }
export function createCalculatorFromPreset(name: string): Calculator { const config = presets.get(name); if (!config) throw new ScoreConfigError(`Unknown preset '${name}'.`); return createCalculator(config); }
export function listPresets(): string[] { return [...presets.keys()].sort(); }
