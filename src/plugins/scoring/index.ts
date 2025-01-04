import type { Plugin } from "@elizaos/core";
import { scoringEvaluator } from "./evaluators";

export const scoringPlugin: Plugin = {
  name: "scoring",
  description: "Provides message quality and trust scoring capabilities",
  evaluators: [scoringEvaluator],
};
