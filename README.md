# Lou Nutri-Score Calculator

`lou-nutriscore` is a small, dependency-free TypeScript/JavaScript package for
building deterministic, explainable weighted scores. It is useful for any
scoring problem; the optional `lou` entry point is only a playful presentation
layer and is not required by the core API.

## Why Lou?

This project was made for fun: its optional **Lou+** easter egg is a playful
fan/parody nod to **Lou Goossens**. The core package remains a genuinely useful,
general-purpose scoring engine; the Lou-related presentation is deliberately
kept separate so it never gets in the way of ordinary use.

It is an unofficial community project. It is not made by, approved by,
endorsed by, or affiliated with Lou Goossens or any associated organisation.
It contains no non-public personal information.

## Install

```bash
npm install lou-nutriscore
```

## Core API

```ts
import { balancedPreset, createCalculator } from "lou-nutriscore";

const calculator = createCalculator(balancedPreset);
const result = calculator.calculate({ quality: 8, value: 6, risk: 2 });
// { score: 75, grade: "B", breakdown: [...], explanation: "..." }
```

Every factor uses a linear range normalized to 0–100, then contributes its
weighted share to the final score. Set `invert: true` for factors where lower
is better, and `clamp: false` when out-of-range values must be retained.

## Your own formula

```ts
import { createCalculator, type ScoreConfig } from "lou-nutriscore";

const formula: ScoreConfig = {
  schemaVersion: 1,
  factors: [
    { key: "speed", weight: 2, range: { min: 0, max: 100 } },
    { key: "errors", weight: 1, range: { min: 0, max: 20 }, invert: true },
  ],
  grades: [{ name: "great", min: 75 }, { name: "okay", min: 45 }, { name: "retry", min: 0 }],
};
const result = createCalculator(formula).calculate({ speed: 80, errors: 4 });
```

`validateConfig` reports invalid factor ranges, weights, duplicate keys and
grade definitions. `exportPreset` and `importPreset` validate a versioned JSON
transport format (`schemaVersion: 1`). Function callbacks intentionally are not
serializable; keep them in code, not a JSON preset.

Use `calculator.explain(input)` as the explicit developer/debug entry point. It
returns the same stable `ScoreResult` shape as `calculate`, including the
human-readable explanation and structured per-factor breakdown.

## Extensions

Factors can have an `evaluate`, `transform` or `normalize` callback. Plugins
may use `beforeCalculate`, `afterCalculate`, and `resolveGrade`. Plugin failures
are isolated and reported in `result.warnings`; they do not bring down a score
calculation.

```ts
import { createCalculator, balancedPreset, type ScorePlugin } from "lou-nutriscore";

const roundScore: ScorePlugin = {
  name: "round-score",
  afterCalculate: (result) => ({ ...result, score: Math.round(result.score) }),
};
const calculator = createCalculator(balancedPreset, { plugins: [roundScore] });
```

## Lou+ (optional)

```ts
import { calculateLou, LOU_DISCLAIMER } from "lou-nutriscore/lou";
const result = calculateLou({ energy: 9, vibe: 9, chaos: 1 });
```

Lou+ is a fan/parody presentation preset, not a nutrition classification and
not an official product, endorsement, or affiliation. Do not use it for health,
medical, dietary, or regulated decisions.
