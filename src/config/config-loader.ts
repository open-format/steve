import { elizaLogger } from "@elizaos/core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ScoringRules, scoringRulesSchema } from "./scoring-rules.schema";

export function loadScoringRules(environment = process.env.NODE_ENV): ScoringRules {
  try {
    // Load the appropriate config file based on environment
    const configPath = join(__dirname, `scoring-rules.${environment}.json`);
    const fallbackPath = join(__dirname, "scoring-rules.json");

    let configFile: string;
    try {
      configFile = readFileSync(configPath, "utf-8");
    } catch {
      configFile = readFileSync(fallbackPath, "utf-8");
    }

    const config = JSON.parse(configFile);
    const result = scoringRulesSchema.safeParse(config);

    if (!result.success) {
      elizaLogger.error("Invalid scoring rules configuration:", result.error);
      throw new Error("Invalid scoring rules configuration");
    }

    return result.data;
  } catch (error) {
    elizaLogger.error("Error loading scoring rules:", error);
    throw error;
  }
}
