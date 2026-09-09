import { ScoreConfigError, ScoreInputError } from "./errors.js";
import type {
  CalculatorOptions, FactorBreakdown, GradeDefinition,
  Calculator, ScoreConfig, ScoreInput, ScorePlugin, ScoreResult,
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
      const grade = plugin.resolveGrade(score, config);
      if (grade) return grade;
    } catch (error) { warnings.push(`Plugin '${plugin.name}' grade resolver failed: ${message(error)}`); }
  }
  return [...config.grades].sort((a, b) => b.min - a.min).find((grade) => score >= grade.min) ?? [...config.grades].sort((a, b) => a.min - b.min)[0];
}

const message = (error: unknown) => error instanceof Error ? error.message : String(error);

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
        try { effectiveInput = { ...effectiveInput, ...(plugin.beforeCalculate(effectiveInput) ?? {}) }; }
        catch (error) { warnings.push(`Plugin '${plugin.name}' before hook failed: ${message(error)}`); }
      }
      const breakdown: FactorBreakdown[] = config.factors.map((factor) => {
        const raw = factor.evaluate ? factor.evaluate(effectiveInput) : effectiveInput[factor.source ?? factor.key];
        if (!Number.isFinite(raw)) throw new ScoreInputError(`Factor '${factor.key}' needs a finite numeric value.`);
        const transformed = factor.transform ? factor.transform(raw as number, effectiveInput) : raw as number;
        const score = factor.normalize
          ? factor.normalize(transformed, factor)
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
        try { result = plugin.afterCalculate(result) ?? result; }
        catch (error) { result = { ...result, warnings: [...result.warnings, `Plugin '${plugin.name}' after hook failed: ${message(error)}`] }; }
      }
      return result;
    },
    explain(input: ScoreInput): ScoreResult {
      return this.calculate(input);
    },
  });
}
