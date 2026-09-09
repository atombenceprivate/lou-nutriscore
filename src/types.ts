export type ScoreInput = Record<string, number | undefined>;
export type MaybePromise<T> = T | Promise<T>;

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
  evaluate?: (input: Readonly<ScoreInput>) => MaybePromise<number>;
  /** Transform a raw value before the built-in linear normalizer runs. */
  transform?: (value: number, input: Readonly<ScoreInput>) => MaybePromise<number>;
  /** Replace the built-in normalizer. Must return a score on the 0…100 scale. */
  normalize?: (value: number, factor: Readonly<FactorDefinition>) => MaybePromise<number>;
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
  beforeCalculate?: (input: Readonly<ScoreInput>) => MaybePromise<ScoreInput | void>;
  afterCalculate?: (result: Readonly<ScoreResult>) => MaybePromise<ScoreResult | void>;
  resolveGrade?: (score: number, config: Readonly<ScoreConfig>) => MaybePromise<GradeDefinition | void>;
}

export interface CalculatorOptions {
  plugins?: ScorePlugin[];
}

/** Public calculator contract; `explain` is an explicit developer/debug entry point. */
export interface Calculator {
  readonly config: Readonly<ScoreConfig>;
  calculate(input: ScoreInput): ScoreResult;
  explain(input: ScoreInput): ScoreResult;
  calculateMany(inputs: readonly ScoreInput[]): ScoreResult[];
  calculateAsync(input: ScoreInput): Promise<ScoreResult>;
  calculateManyAsync(inputs: readonly ScoreInput[]): Promise<ScoreResult[]>;
  compare(a: ScoreInput, b: ScoreInput): ScoreComparison;
  sensitivity(input: ScoreInput, step?: number): SensitivityResult;
  analyze(input: ScoreInput, step?: number): SensitivityResult;
}

export interface FactorComparison {
  key: string;
  a: number | undefined;
  b: number | undefined;
  delta: number;
}

export interface ScoreComparison {
  a: ScoreResult;
  b: ScoreResult;
  scoreDelta: number;
  winner: "a" | "b" | "tie";
  factors: FactorComparison[];
}

export interface SensitivityItem {
  key: string;
  step: number;
  baseline: number;
  increasedScore?: number;
  decreasedScore?: number;
  increaseDelta?: number;
  decreaseDelta?: number;
  unavailableReason?: string;
}

export interface SensitivityResult {
  baseline: ScoreResult;
  factors: SensitivityItem[];
}

export interface CompositeCalculator {
  calculate(input: ScoreInput, childInputs: Record<string, ScoreInput>): CompositeScoreResult;
  calculateAsync(input: ScoreInput, childInputs: Record<string, ScoreInput>): Promise<CompositeScoreResult>;
}

export interface CompositeScoreResult {
  result: ScoreResult;
  children: Record<string, ScoreResult>;
}

export interface PresetMigrationResult {
  config: ScoreConfig;
  fromVersion: number | undefined;
  toVersion: 1;
  migrated: boolean;
}
