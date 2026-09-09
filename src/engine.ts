import { ScoreConfigError, ScoreInputError } from "./errors.js";
import type {
  CalculatorOptions, FactorBreakdown, GradeDefinition,
  Calculator, CompositeCalculator, CompositeScoreResult, FactorComparison,
  PresetMigrationResult, ScoreComparison, ScoreConfig, ScoreInput, ScorePlugin, ScoreResult,
  SensitivityResult,
} from "./types.js";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function validateConfig(config: ScoreConfig): void {
  if (config.schemaVersion !== 1) throw new ScoreConfigError("Unsupported schemaVersion; expected 1.");
  if (!Array.isArray(config.factors) || config.factors.length === 0) throw new ScoreConfigError("At least one factor is required.");
  if (!Array.isArray(config.grades) || config.grades.length === 0) throw new ScoreConfigError("At least one grade is required.");
  const keys = new Set<string>();
  for (const factor of config.factors) {
    if (!factor.key || keys.has(factor.key)) throw new ScoreConfigError("Factor keys must be unique and non-empty.");
    keys.add(factor.key);
    if (!Number.isFinite(factor.weight) || factor.weight <= 0) throw new ScoreConfigError(`Factor '${factor.key}' needs a positive finite weight.`);
    if (!Number.isFinite(factor.range.min) || !Number.isFinite(factor.range.max) || factor.range.min >= factor.range.max) {
      throw new ScoreConfigError(`Factor '${factor.key}' needs a valid min/max range.`);
    }
  }
  for (const grade of config.grades) {
    if (!grade.name || !Number.isFinite(grade.min)) throw new ScoreConfigError("Every grade needs a name and finite minimum.");
  }
  if (config.minScore !== undefined && config.maxScore !== undefined && config.minScore > config.maxScore) {
    throw new ScoreConfigError("minScore cannot exceed maxScore.");
  }
}

function resolvedGrade(score: number, config: ScoreConfig, plugins: readonly ScorePlugin[], warnings: string[]): GradeDefinition {
  for (const plugin of plugins) {
    if (!plugin.resolveGrade) continue;
    try {
      const grade = requireSync(plugin.resolveGrade(score, config), `Plugin '${plugin.name}' grade resolver`);
      if (grade) return grade;
    } catch (error) { warnings.push(`Plugin '${plugin.name}' grade resolver failed: ${message(error)}`); }
  }
  return [...config.grades].sort((a, b) => b.min - a.min).find((grade) => score >= grade.min) ?? [...config.grades].sort((a, b) => a.min - b.min)[0];
}

const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const isPromise = (value: unknown): value is Promise<unknown> => typeof (value as { then?: unknown })?.then === "function";

function requireSync<T>(value: T | Promise<T>, context: string): T {
  if (isPromise(value)) throw new ScoreInputError(`${context} is asynchronous; use calculateAsync().`);
  return value;
}

export function createCalculator(config: ScoreConfig, options: CalculatorOptions = {}): Calculator {
  validateConfig(config);
  const plugins = options.plugins ?? [];
  return Object.freeze({
    // Keep callbacks usable: `structuredClone` would reject formula functions.
    config,
    calculate(input: ScoreInput): ScoreResult {
      let effectiveInput: ScoreInput = { ...input };
      const warnings: string[] = [];
      for (const plugin of plugins) {
        if (!plugin.beforeCalculate) continue;
        try { effectiveInput = { ...effectiveInput, ...(requireSync(plugin.beforeCalculate(effectiveInput), `Plugin '${plugin.name}' before hook`) ?? {}) }; }
        catch (error) { warnings.push(`Plugin '${plugin.name}' before hook failed: ${message(error)}`); }
      }
      const breakdown: FactorBreakdown[] = config.factors.map((factor) => {
        const raw = factor.evaluate ? requireSync(factor.evaluate(effectiveInput), `Factor '${factor.key}' evaluator`) : effectiveInput[factor.source ?? factor.key];
        if (!Number.isFinite(raw)) throw new ScoreInputError(`Factor '${factor.key}' needs a finite numeric value.`);
        const transformed = factor.transform ? requireSync(factor.transform(raw as number, effectiveInput), `Factor '${factor.key}' transform`) : raw as number;
        const score = factor.normalize
          ? requireSync(factor.normalize(transformed, factor), `Factor '${factor.key}' normalizer`)
          : (factor.invert ? 100 - ((transformed - factor.range.min) / (factor.range.max - factor.range.min)) * 100 : ((transformed - factor.range.min) / (factor.range.max - factor.range.min)) * 100);
        const normalizedScore = factor.clamp === false ? score : clamp(score, 0, 100);
        if (!Number.isFinite(normalizedScore)) throw new ScoreInputError(`Factor '${factor.key}' normalizer returned a non-finite score.`);
        return { key: factor.key, label: factor.label ?? factor.key, rawValue: raw as number, normalizedScore, weight: factor.weight, weightedContribution: normalizedScore * factor.weight };
      });
      const weight = breakdown.reduce((total, item) => total + item.weight, 0);
      let score = breakdown.reduce((total, item) => total + item.weightedContribution, 0) / weight;
      score = clamp(score, config.minScore ?? 0, config.maxScore ?? 100);
      const grade = resolvedGrade(score, config, plugins, warnings);
      let result: ScoreResult = { score, grade: grade.name, gradeLabel: grade.label, breakdown, explanation: breakdown.map((item) => `${item.label}: ${item.normalizedScore.toFixed(1)}/100 (×${item.weight})`).join("; "), warnings };
      for (const plugin of plugins) {
        if (!plugin.afterCalculate) continue;
        try { result = requireSync(plugin.afterCalculate(result), `Plugin '${plugin.name}' after hook`) ?? result; }
        catch (error) { result = { ...result, warnings: [...result.warnings, `Plugin '${plugin.name}' after hook failed: ${message(error)}`] }; }
      }
      return result;
    },
    explain(input: ScoreInput): ScoreResult {
      return this.calculate(input);
    },
    calculateMany(inputs: readonly ScoreInput[]): ScoreResult[] { return inputs.map((input) => this.calculate(input)); },
    async calculateAsync(input: ScoreInput): Promise<ScoreResult> {
      let effectiveInput: ScoreInput = { ...input };
      const warnings: string[] = [];
      for (const plugin of plugins) {
        if (!plugin.beforeCalculate) continue;
        try { effectiveInput = { ...effectiveInput, ...(await plugin.beforeCalculate(effectiveInput) ?? {}) }; }
        catch (error) { warnings.push(`Plugin '${plugin.name}' before hook failed: ${message(error)}`); }
      }
      const breakdown = [] as FactorBreakdown[];
      for (const factor of config.factors) {
        const raw = factor.evaluate ? await factor.evaluate(effectiveInput) : effectiveInput[factor.source ?? factor.key];
        if (!Number.isFinite(raw)) throw new ScoreInputError(`Factor '${factor.key}' needs a finite numeric value.`);
        const transformed = factor.transform ? await factor.transform(raw as number, effectiveInput) : raw as number;
        const score = factor.normalize ? await factor.normalize(transformed, factor) : (factor.invert ? 100 - ((transformed - factor.range.min) / (factor.range.max - factor.range.min)) * 100 : ((transformed - factor.range.min) / (factor.range.max - factor.range.min)) * 100);
        const normalizedScore = factor.clamp === false ? score : clamp(score, 0, 100);
        if (!Number.isFinite(normalizedScore)) throw new ScoreInputError(`Factor '${factor.key}' normalizer returned a non-finite score.`);
        breakdown.push({ key: factor.key, label: factor.label ?? factor.key, rawValue: raw as number, normalizedScore, weight: factor.weight, weightedContribution: normalizedScore * factor.weight });
      }
      const weight = breakdown.reduce((total, item) => total + item.weight, 0);
      let score = breakdown.reduce((total, item) => total + item.weightedContribution, 0) / weight;
      score = clamp(score, config.minScore ?? 0, config.maxScore ?? 100);
      let grade: GradeDefinition | undefined;
      for (const plugin of plugins) {
        if (!plugin.resolveGrade) continue;
        try { grade = await plugin.resolveGrade(score, config) ?? grade; if (grade) break; }
        catch (error) { warnings.push(`Plugin '${plugin.name}' grade resolver failed: ${message(error)}`); }
      }
      grade ??= [...config.grades].sort((a, b) => b.min - a.min).find((item) => score >= item.min) ?? [...config.grades].sort((a, b) => a.min - b.min)[0];
      let result: ScoreResult = { score, grade: grade.name, gradeLabel: grade.label, breakdown, explanation: breakdown.map((item) => `${item.label}: ${item.normalizedScore.toFixed(1)}/100 (×${item.weight})`).join("; "), warnings };
      for (const plugin of plugins) {
        if (!plugin.afterCalculate) continue;
        try { result = await plugin.afterCalculate(result) ?? result; }
        catch (error) { result = { ...result, warnings: [...result.warnings, `Plugin '${plugin.name}' after hook failed: ${message(error)}`] }; }
      }
      return result;
    },
    async calculateManyAsync(inputs: readonly ScoreInput[]): Promise<ScoreResult[]> { return Promise.all(inputs.map((input) => this.calculateAsync(input))); },
    compare(a: ScoreInput, b: ScoreInput): ScoreComparison {
      const first = this.calculate(a), second = this.calculate(b);
      const aFactors = new Map(first.breakdown.map((item) => [item.key, item.normalizedScore]));
      const bFactors = new Map(second.breakdown.map((item) => [item.key, item.normalizedScore]));
      const factors: FactorComparison[] = [...new Set([...aFactors.keys(), ...bFactors.keys()])].map((key) => ({ key, a: aFactors.get(key), b: bFactors.get(key), delta: (bFactors.get(key) ?? 0) - (aFactors.get(key) ?? 0) }));
      return { a: first, b: second, scoreDelta: second.score - first.score, winner: second.score === first.score ? "tie" : second.score > first.score ? "b" : "a", factors };
    },
    sensitivity(input: ScoreInput, step = 1): SensitivityResult {
      if (!Number.isFinite(step) || step <= 0) throw new ScoreInputError("Sensitivity step must be a positive finite number.");
      const baseline = this.calculate(input);
      return { baseline, factors: config.factors.map((factor) => {
        if (factor.evaluate) return { key: factor.key, step, baseline: baseline.score, unavailableReason: "Derived factors cannot be perturbed automatically." };
        const source = factor.source ?? factor.key, value = input[source];
        if (!Number.isFinite(value)) return { key: factor.key, step, baseline: baseline.score, unavailableReason: "Input value is missing." };
        const increasedScore = this.calculate({ ...input, [source]: (value as number) + step }).score;
        const decreasedScore = this.calculate({ ...input, [source]: (value as number) - step }).score;
        return { key: factor.key, step, baseline: baseline.score, increasedScore, decreasedScore, increaseDelta: increasedScore - baseline.score, decreaseDelta: decreasedScore - baseline.score };
      }) };
    },
    analyze(input: ScoreInput, step = 1): SensitivityResult { return this.sensitivity(input, step); },
  });
}

export function createCompositeCalculator(config: ScoreConfig, children: Record<string, Calculator>): CompositeCalculator {
  const parent = createCalculator(config);
  const calculate = (input: ScoreInput, childInputs: Record<string, ScoreInput>): CompositeScoreResult => {
    const results: Record<string, ScoreResult> = {};
    for (const [key, calculator] of Object.entries(children)) results[key] = calculator.calculate(childInputs[key] ?? {});
    return { children: results, result: parent.calculate({ ...input, ...Object.fromEntries(Object.entries(results).map(([key, result]) => [key, result.score])) }) };
  };
  return { calculate, async calculateAsync(input, childInputs) {
    const entries = await Promise.all(Object.entries(children).map(async ([key, calculator]) => [key, await calculator.calculateAsync(childInputs[key] ?? {})] as const));
    const results = Object.fromEntries(entries) as Record<string, ScoreResult>;
    return { children: results, result: await parent.calculateAsync({ ...input, ...Object.fromEntries(Object.entries(results).map(([key, result]) => [key, result.score])) }) };
  } };
}
