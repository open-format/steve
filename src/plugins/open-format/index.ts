import type { Plugin } from "@elizaos/core";
import { scoringEvaluator } from "./evaluators";

export const openFormatPlugin: Plugin = {
  name: "open-format",
  description: "Provides message quality and trust scoring capabilities",
  evaluators: [scoringEvaluator],
};
