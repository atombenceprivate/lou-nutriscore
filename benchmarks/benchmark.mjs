import { createCalculator, balancedPreset, statistics } from "../dist/index.js";
const calculator = createCalculator(balancedPreset);
for (const size of [1_000, 10_000, 100_000]) {
  const dataset = Array.from({ length: size }, (_, index) => ({ quality: index % 11, value: (index * 3) % 11, risk: (index * 7) % 11 }));
  const started = performance.now(), results = calculator.calculateMany(dataset), elapsed = performance.now() - started;
  console.log(JSON.stringify({ size, milliseconds: Number(elapsed.toFixed(2)), mean: statistics(results).mean }));
}
