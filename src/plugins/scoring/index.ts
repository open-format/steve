import type { Plugin } from "@elizaos/core";
import { scoringEvaluator } from "./evaluators";
import { scoringProvider } from "./providers";

export const scoringPlugin: Plugin = {
  name: "scoring",
  description: "Provides message quality and trust scoring capabilities",
  providers: [scoringProvider],
  evaluators: [scoringEvaluator],
};
