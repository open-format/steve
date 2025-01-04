import { elizaLogger } from "@elizaos/core";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ScoringRules, scoringRulesSchema } from "./scoring-rules.schema";

export function loadScoringRules(environment = process.env.NODE_ENV): ScoringRules {
  try {
    // Get the directory path in a way that works with both ESM and CommonJS
    const currentDir = dirname(fileURLToPath(import.meta.url));

    // Load the appropriate config file based on environment
    const configPath = join(currentDir, `scoring-rules.${environment}.json`);
    const fallbackPath = join(currentDir, "scoring-rules.json");

    elizaLogger.debug("configPath", configPath);
    elizaLogger.debug("fallbackPath", fallbackPath);

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
    elizaLogger.error("Error loading scoring ruless:", error);
    throw error;
  }
}
