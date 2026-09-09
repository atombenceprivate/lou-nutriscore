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

## Batch, comparison and sensitivity

```ts
const results = calculator.calculateMany(dataset);
const comparison = calculator.compare(candidateA, candidateB);
// comparison.scoreDelta and comparison.factors explain what changed.

const analysis = calculator.sensitivity(candidateA, 1);
// Per source factor: score after +1 / -1, plus deltas from the baseline.
```

`analyze(input, step)` is an alias for `sensitivity(input, step)`. Derived
factors created with an `evaluate` callback are reported as unavailable for
automatic perturbation, rather than producing a misleading result.

## Async and composite models

Use `calculateAsync` when a factor or plugin retrieves data asynchronously:

```ts
const calculator = createCalculator({
  schemaVersion: 1,
  factors: [{ key: "remote", weight: 1, range: { min: 0, max: 10 }, evaluate: async () => 8 }],
  grades: [{ name: "good", min: 50 }, { name: "low", min: 0 }],
});
const result = await calculator.calculateAsync({});
```

`createCompositeCalculator` makes a child score available as a numeric parent
factor, enabling deterministic nested models:

```ts
import { createCalculator, createCompositeCalculator } from "lou-nutriscore";

const child = createCalculator(balancedPreset);
const parent = createCompositeCalculator(parentConfig, { child });
const result = parent.calculate({}, { child: { quality: 8, value: 6, risk: 2 } });
// result.children.child.score is automatically supplied as the parent `child` factor.
```

## Preset migration

`migratePreset` upgrades known legacy JSON shapes to the current schema and
returns migration metadata. `importPreset` calls it automatically. Presets
using the historic `version: 1` field are accepted and converted to
`schemaVersion: 1`.

## CLI

The package includes a dependency-free CLI after installation:

```bash
npx lou-nutriscore validate config.json
npx lou-nutriscore score config.json input.json
npx lou-nutriscore explain config.json input.json
npx lou-nutriscore compare config.json first.json second.json
npx lou-nutriscore lou --energy 10 --vibe 10 --chaos 0
```

## Playground

Open `playground/index.html` in a browser for a standalone, local demo with
live score and comparison output. It intentionally sends no input data over the
network.

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

`explainLou(input)` returns the same result together with Lou+-specific,
playful presentation text. It uses the same serious breakdown engine as the
core package.

Lou+ is a fan/parody presentation preset, not a nutrition classification and
not an official product, endorsement, or affiliation. Do not use it for health,
medical, dietary, or regulated decisions.
