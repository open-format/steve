import { z } from "zod";

export const scoringRulesSchema = z.object({
  conditions: z.object({
    minLength: z.number().min(0),
    minReactions: z.number().min(0),
    minQualityScore: z.number().min(0).max(1),
    minTrustScore: z.number().min(0).max(1),
  }),
  scoring: z.object({
    qualityFactors: z.object({
      messageLength: z.object({
        weight: z.number().min(0).max(1),
        thresholds: z.object({
          min: z.number().min(0),
          ideal: z.number().min(0),
        }),
      }),
      uniqueWords: z.object({
        weight: z.number().min(0).max(1),
        thresholds: z.object({
          min: z.number().min(0),
          ideal: z.number().min(0),
        }),
      }),
      relevance: z.object({
        weight: z.number().min(0).max(1),
        factors: z.array(z.enum(["channelTopicMatch", "keywordMatch"])),
      }),
      engagement: z.object({
        weight: z.number().min(0).max(1),
        factors: z.array(z.enum(["reactions", "replies"])),
      }),
    }),
    trustFactors: z.object({
      accountAge: z.object({
        weight: z.number().min(0).max(1),
        thresholds: z.object({
          min: z.string(),
          ideal: z.string(),
        }),
      }),
      previousContributions: z.object({
        weight: z.number().min(0).max(1),
        factors: z.array(z.enum(["qualityAverage", "quantity"])),
      }),
      communityStanding: z.object({
        weight: z.number().min(0).max(1),
        factors: z.array(z.enum(["roles", "reputation"])),
      }),
      reportHistory: z.object({
        weight: z.number().min(0).max(1),
        factors: z.array(z.enum(["violations", "warnings"])),
      }),
    }),
  }),
});

export type ScoringRules = z.infer<typeof scoringRulesSchema>;
