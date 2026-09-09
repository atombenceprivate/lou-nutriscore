import assert from "node:assert/strict";
import test from "node:test";
import { createCalculator, createCompositeCalculator, balancedPreset, migratePreset, ScoreConfigError } from "./index.js";
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
    title: "LOU+ · 90/100", disclaimer: LOU_DISCLAIMER, narrative: "Energy, vibe and chaos combine into LOU+.",
  });
});

test("batch, comparison and sensitivity APIs remain deterministic", () => {
  const calculator = createCalculator(balancedPreset);
  assert.deepEqual(calculator.calculateMany([{ quality: 8, value: 6, risk: 2 }, { quality: 9, value: 9, risk: 1 }]).map((item) => item.score), [75, 90]);
  assert.equal(calculator.compare({ quality: 8, value: 6, risk: 2 }, { quality: 9, value: 9, risk: 1 }).winner, "b");
  assert.equal(calculator.sensitivity({ quality: 8, value: 6, risk: 2 }).factors.length, 3);
});

test("supports async factors, migration and composite scores", async () => {
  const asyncCalculator = createCalculator({ schemaVersion: 1, factors: [{ key: "remote", weight: 1, range: { min: 0, max: 10 }, evaluate: async () => 8 }], grades: [{ name: "good", min: 50 }, { name: "low", min: 0 }] });
  assert.equal((await asyncCalculator.calculateAsync({})).score, 80);
  assert.equal(migratePreset({ version: 1, factors: balancedPreset.factors, grades: balancedPreset.grades }).migrated, false);
  const composite = createCompositeCalculator({ schemaVersion: 1, factors: [{ key: "child", weight: 1, range: { min: 0, max: 100 } }], grades: [{ name: "ok", min: 0 }] }, { child: createCalculator(balancedPreset) });
  assert.equal(composite.calculate({}, { child: { quality: 8, value: 6, risk: 2 } }).result.score, 75);
});
