import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import type { Message } from "discord.js";
import { loadScoringRules } from "./rules/config-loader";
import type { ScoringRules } from "./rules/scoring-rules.schema";

export class ScoringService {
  private rules: ScoringRules;
  private runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime, customRules?: Partial<ScoringRules>) {
    elizaLogger.debug("ScoringService constructor called");
    this.runtime = runtime;
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
    elizaLogger.debug("Evaluating message", message);
    // Calculate quality score
    const qualityScore = await this.calculateQualityScore(message);

    // Calculate trust score
    const trustScore = await this.calculateTrustScore(message);

    // Check conditions
    const meetsConditions = this.checkConditions(message, qualityScore, trustScore);

    elizaLogger.debug("Message passed scoring validation", {
      qualityScore,
      trustScore,
      meetsConditions,
    });

    return {
      qualityScore,
      trustScore,
      meetsConditions,
    };
  }

  private async calculateQualityScore(message: Message): Promise<number> {
    const { qualityFactors } = this.rules.scoring;
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

    // Relevance score
    if (qualityFactors.relevance) {
      const relevanceScore = await this.calculateRelevanceScore(message);
      score += relevanceScore * qualityFactors.relevance.weight;
    }

    // Engagement score
    if (qualityFactors.engagement) {
      const engagementScore = this.calculateEngagementScore(message);
      score += engagementScore * qualityFactors.engagement.weight;
    }

    return Math.min(1, Math.max(0, score));
  }

  private async calculateRelevanceScore(message: Message): Promise<number> {
    let score = 0;
    const { relevance } = this.rules.scoring.qualityFactors;

    if (relevance.factors.includes("channelTopicMatch") && message.channel.isTextBased()) {
      const topic = message.channel.topic?.toLowerCase() || "";
      const content = message.content.toLowerCase();
      if (topic && this.calculateTextSimilarity(content, topic) > 0.3) {
        score += 0.5;
      }
    }

    if (relevance.factors.includes("keywordMatch")) {
      // You can implement keyword matching based on your needs
      // For example, checking against a list of relevant keywords
      score += 0.5;
    }

    return score;
  }

  private calculateEngagementScore(message: Message): number {
    let score = 0;
    const { engagement } = this.rules.scoring.qualityFactors;

    if (engagement.factors.includes("reactions")) {
      const reactionScore = this.calculateThresholdScore(message.reactions.cache.size, 1, 5);
      score += reactionScore * 0.5;
    }

    if (engagement.factors.includes("replies")) {
      const replyScore = this.calculateThresholdScore(message.thread?.messageCount || 0, 1, 3);
      score += replyScore * 0.5;
    }

    return score;
  }

  private async calculateTrustScore(message: Message): Promise<number> {
    const { trustFactors } = this.rules.scoring;
    let score = 0;

    // Account age score
    const accountAge = Date.now() - message.author.createdTimestamp;
    const minAge = this.parseTimeString(trustFactors.accountAge.thresholds.min);
    const idealAge = this.parseTimeString(trustFactors.accountAge.thresholds.ideal);
    const ageScore = this.calculateThresholdScore(accountAge, minAge, idealAge);
    score += ageScore * trustFactors.accountAge.weight;

    // Add community standing score if available
    if (message.member && trustFactors.communityStanding) {
      const standingScore = this.calculateCommunityStandingScore(message);
      score += standingScore * trustFactors.communityStanding.weight;
    }

    return Math.min(1, Math.max(0, score));
  }

  private calculateCommunityStandingScore(message: Message): number {
    let score = 0;
    const { communityStanding } = this.rules.scoring.trustFactors;

    if (communityStanding.factors.includes("roles")) {
      const roleScore = this.calculateThresholdScore(message.member?.roles.cache.size || 0, 1, 5);
      score += roleScore * 0.5;
    }

    // Add more community standing factors as needed

    return score;
  }

  private checkConditions(message: Message, qualityScore: number, trustScore: number): boolean {
    const { conditions } = this.rules;

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

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity implementation
    const set1 = new Set(text1.split(/\s+/));
    const set2 = new Set(text2.split(/\s+/));
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }
}
