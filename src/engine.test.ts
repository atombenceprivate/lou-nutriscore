import assert from "node:assert/strict";
import test from "node:test";
import { createCalculator, balancedPreset, ScoreConfigError } from "./index.js";
import { calculateLou, LOU_DISCLAIMER } from "./lou.js";

test("calculates a deterministic, explainable weighted result", () => {
  const result = createCalculator(balancedPreset).calculate({ quality: 8, value: 6, risk: 2 });
  assert.equal(result.score, 75);
  assert.equal(result.grade, "B");
  assert.deepEqual(result.breakdown.map(({ key, normalizedScore }) => ({ key, normalizedScore })), [
    { key: "quality", normalizedScore: 80 }, { key: "value", normalizedScore: 60 }, { key: "risk", normalizedScore: 80 },
  ]);
});

test("rejects invalid configuration", () => {
  assert.throws(() => createCalculator({ ...balancedPreset, factors: [] }), ScoreConfigError);
});

test("isolates plugin errors", () => {
  const calculator = createCalculator(balancedPreset, { plugins: [{ name: "broken", beforeCalculate: () => { throw new Error("nope"); } }] });
  assert.match(calculator.calculate({ quality: 8, value: 6, risk: 2 }).warnings[0], /broken/);
});

test("supports custom factor callbacks and an explicit explain API", () => {
  const calculator = createCalculator({
    schemaVersion: 1,
    factors: [{ key: "total", weight: 1, range: { min: 0, max: 10 }, evaluate: (input) => (input.left ?? 0) + (input.right ?? 0) }],
    grades: [{ name: "pass", min: 50 }, { name: "retry", min: 0 }],
  });
  assert.equal(calculator.explain({ left: 3, right: 4 }).score, 70);
});

test("Lou+ presentation snapshot", () => {
  assert.deepEqual(calculateLou({ energy: 9, vibe: 9, chaos: 1 }).presentation, {
    title: "LOU+ · 90/100", disclaimer: LOU_DISCLAIMER,
  });
});
