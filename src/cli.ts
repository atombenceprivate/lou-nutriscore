#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createCalculator, importPreset, validateConfig } from "./index.js";

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const [command, ...paths] = process.argv.slice(2);

try {
  if (!command || command === "--help" || command === "-h") {
    console.log("Usage: lou-nutriscore <score|explain|compare|validate> <config.json> [input.json] [other-input.json]");
  } else if (command === "validate") {
    validateConfig(importPreset(readFileSync(paths[0], "utf8")));
    console.log(JSON.stringify({ valid: true }));
  } else {
    const calculator = createCalculator(importPreset(readFileSync(paths[0], "utf8")));
    if (command === "score") console.log(JSON.stringify(calculator.calculate(readJson(paths[1]) as Record<string, number>), null, 2));
    else if (command === "explain") console.log(JSON.stringify(calculator.explain(readJson(paths[1]) as Record<string, number>), null, 2));
    else if (command === "compare") console.log(JSON.stringify(calculator.compare(readJson(paths[1]) as Record<string, number>, readJson(paths[2]) as Record<string, number>), null, 2));
    else throw new Error(`Unknown command '${command}'.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
