import { createCalculator } from "./engine.js";
import { registerPreset } from "./insights.js";
import type { ScoreConfig, ScorePlugin } from "./types.js";
/** Stable extension contract for lou-nutriscore-* packages. */
export interface LouNutriScoreExtension { name: string; preset?: ScoreConfig; plugins?: ScorePlugin[]; }
export function defineExtension(extension: LouNutriScoreExtension): LouNutriScoreExtension { if (!extension.name) throw new Error("Extension name is required."); return Object.freeze({ ...extension, plugins: extension.plugins ? [...extension.plugins] : undefined }); }
export function installExtension(extension: LouNutriScoreExtension) { if (extension.preset) registerPreset(extension.name, extension.preset); return extension.preset ? createCalculator(extension.preset, { plugins: extension.plugins }) : undefined; }
