import { validateConfig } from "./engine.js";
import { ScoreConfigError } from "./errors.js";
import type { PresetMigrationResult, ScoreConfig } from "./types.js";

export const balancedPreset: ScoreConfig = {
  schemaVersion: 1,
  name: "balanced",
  factors: [
    { key: "quality", label: "Quality", weight: 2, range: { min: 0, max: 10 } },
    { key: "value", label: "Value", weight: 1, range: { min: 0, max: 10 } },
    { key: "risk", label: "Risk", weight: 1, range: { min: 0, max: 10 }, invert: true },
  ],
  grades: [
    { name: "A", min: 80, label: "Excellent" }, { name: "B", min: 60, label: "Good" },
    { name: "C", min: 40, label: "Fair" }, { name: "D", min: 20, label: "Poor" }, { name: "E", min: 0, label: "Needs work" },
  ],
};

export function exportPreset(config: ScoreConfig): string {
  validateConfig(config);
  return JSON.stringify(config, null, 2);
}

export function importPreset(json: string): ScoreConfig {
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { throw new ScoreConfigError("Preset must be valid JSON."); }
  return migratePreset(parsed).config;
}

/** Converts known legacy preset shapes to the current schema without mutating the input. */
export function migratePreset(preset: unknown): PresetMigrationResult {
  if (typeof preset !== "object" || preset === null || Array.isArray(preset)) throw new ScoreConfigError("Preset must be a JSON object.");
  const source = preset as Record<string, unknown>;
  const fromVersion = typeof source.schemaVersion === "number" ? source.schemaVersion : typeof source.version === "number" ? source.version : undefined;
  if (fromVersion !== undefined && fromVersion !== 1) throw new ScoreConfigError(`Cannot migrate unsupported schemaVersion ${fromVersion}.`);
  const config = { ...source, schemaVersion: 1 } as ScoreConfig;
  delete (config as unknown as Record<string, unknown>).version;
  validateConfig(config);
  return { config, fromVersion, toVersion: 1, migrated: fromVersion !== 1 };
}
