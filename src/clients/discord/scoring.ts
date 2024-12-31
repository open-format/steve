import { elizaLogger } from "@elizaos/core";
import { loadScoringRules } from "../../config/config-loader";
import type { ScoringRules } from "../../config/scoring-rules.schema";

export class ScoringService {
  private rules: ScoringRules;

  constructor(customRules?: Partial<ScoringRules>) {
    const defaultRules = loadScoringRules();
    this.rules = {
      ...defaultRules,
      ...customRules,
    };
  }

  async evaluateMessage(message: Message): Promise<{
    qualityScore: number;
    trustScore: number;
    meetsConditions: boolean;
  }> {
    // Calculate quality score
    const qualityScore = await this.calculateQualityScore(message, this.rules);

    // Calculate trust score
    const trustScore = await this.calculateTrustScore(message, this.rules);

    // Check conditions
    const meetsConditions = this.checkConditions(message, this.rules, qualityScore, trustScore);

    elizaLogger.log("Quality score:", qualityScore);
    elizaLogger.log("Trust score:", trustScore);
    elizaLogger.log("Meets conditions:", meetsConditions);

    return {
      qualityScore,
      trustScore,
      meetsConditions,
    };
  }

  private async calculateQualityScore(message: Message, rules: ScoringRules): Promise<number> {
    const { qualityFactors } = rules.scoring;
    let score = 0;

    // Message length score
    const lengthScore = this.calculateThresholdScore(
      message.content.length,
      qualityFactors.messageLength.thresholds.min,
      qualityFactors.messageLength.thresholds.ideal
    );
    score += lengthScore * qualityFactors.messageLength.weight;

    // Unique words score
    const uniqueWords = new Set(message.content.toLowerCase().split(/\s+/)).size;
    const uniqueWordsScore = this.calculateThresholdScore(
      uniqueWords,
      qualityFactors.uniqueWords.thresholds.min,
      qualityFactors.uniqueWords.thresholds.ideal
    );
    score += uniqueWordsScore * qualityFactors.uniqueWords.weight;

    // Add other quality factors here...

    return score;
  }

  private async calculateTrustScore(message: Message, rules: ScoringRules): Promise<number> {
    const { trustFactors } = rules.scoring;
    let score = 0;

    // Account age score
    const accountAge = Date.now() - message.author.createdTimestamp;
    const minAge = this.parseTimeString(trustFactors.accountAge.thresholds.min);
    const idealAge = this.parseTimeString(trustFactors.accountAge.thresholds.ideal);
    const ageScore = this.calculateThresholdScore(accountAge, minAge, idealAge);
    score += ageScore * trustFactors.accountAge.weight;

    // Add other trust factors here...

    return score;
  }

  private checkConditions(message: Message, rules: ScoringRules, qualityScore: number, trustScore: number): boolean {
    const { conditions } = rules;

    elizaLogger.log("Conditions:", conditions);

    return (
      message.content.length >= conditions.minLength &&
      message.reactions.cache.size >= conditions.minReactions &&
      qualityScore >= conditions.minQualityScore &&
      trustScore >= conditions.minTrustScore
    );
  }

  private calculateThresholdScore(value: number, min: number, ideal: number): number {
    if (value < min) return 0;
    if (value >= ideal) return 1;
    return (value - min) / (ideal - min);
  }

  private parseTimeString(timeStr: string): number {
    const unit = timeStr.slice(-1);
    const value = Number.parseInt(timeStr.slice(0, -1));

    switch (unit) {
      case "d":
        return value * 24 * 60 * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "m":
        return value * 60 * 1000;
      case "s":
        return value * 1000;
      default:
        return value;
    }
  }
}
