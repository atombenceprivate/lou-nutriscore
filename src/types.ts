export type ScoreInput = Record<string, number | undefined>;

export interface Range {
  min: number;
  max: number;
}

export interface FactorDefinition {
  key: string;
  label?: string;
  weight: number;
  /** Input property to read. Defaults to `key`. */
  source?: string;
  range: Range;
  /** Reverse a linear scale: a smaller raw value produces a higher score. */
  invert?: boolean;
  /** Keep normalized factor scores within 0…100. Defaults to true. */
  clamp?: boolean;
  /** Derive a raw value when a property lookup is not enough. */
  evaluate?: (input: Readonly<ScoreInput>) => number;
  /** Transform a raw value before the built-in linear normalizer runs. */
  transform?: (value: number, input: Readonly<ScoreInput>) => number;
  /** Replace the built-in normalizer. Must return a score on the 0…100 scale. */
  normalize?: (value: number, factor: Readonly<FactorDefinition>) => number;
}

export interface GradeDefinition {
  name: string;
  min: number;
  label?: string;
}

export interface ScoreConfig {
  schemaVersion: 1;
  name?: string;
  factors: FactorDefinition[];
  grades: GradeDefinition[];
  minScore?: number;
  maxScore?: number;
}

export interface FactorBreakdown {
  key: string;
  label: string;
  rawValue: number;
  normalizedScore: number;
  weight: number;
  weightedContribution: number;
}

export interface ScoreResult {
  score: number;
  grade: string;
  gradeLabel?: string;
  breakdown: FactorBreakdown[];
  explanation: string;
  warnings: string[];
}

export interface ScorePlugin {
  name: string;
  beforeCalculate?: (input: Readonly<ScoreInput>) => ScoreInput | void;
  afterCalculate?: (result: Readonly<ScoreResult>) => ScoreResult | void;
  resolveGrade?: (score: number, config: Readonly<ScoreConfig>) => GradeDefinition | void;
}

export interface CalculatorOptions {
  plugins?: ScorePlugin[];
}

/** Public calculator contract; `explain` is an explicit developer/debug entry point. */
export interface Calculator {
  readonly config: Readonly<ScoreConfig>;
  calculate(input: ScoreInput): ScoreResult;
  explain(input: ScoreInput): ScoreResult;
}
