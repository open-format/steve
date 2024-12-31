export enum ModelProviderName {
  OPENAI = "OPENAI",
  ANTHROPIC = "ANTHROPIC",
  // Add other providers as needed
}

export interface Character {
  id?: string;
  name: string;
  modelProvider: ModelProviderName;
  clients?: string[];
  description?: string;
  personality?: string;
  settings?: {
    secrets?: Record<string, string>;
    database?: {
      maxConnections?: number;
      enableLogging?: boolean;
    };
    cache?: {
      ttl?: number;
    };
  };
}

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: number;
}

export interface Client {
  type: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  send: (message: Message) => Promise<void>;
}

export interface DatabaseAdapter {
  init: () => Promise<void>;
  close: () => Promise<void>;
  query: (sql: string, params?: any[]) => Promise<any>;
}

export interface ScoringRules {
  conditions: {
    minLength: number;
    minReactions: number;
    minQualityScore: number;
    minTrustScore: number;
  };
  scoring: {
    qualityFactors: {
      messageLength: {
        weight: number;
        thresholds: {
          min: number;
          ideal: number;
        };
      };
      uniqueWords: {
        weight: number;
        thresholds: {
          min: number;
          ideal: number;
        };
      };
      relevance: {
        weight: number;
        factors: string[];
      };
      engagement: {
        weight: number;
        factors: string[];
      };
    };
    trustFactors: {
      accountAge: {
        weight: number;
        thresholds: {
          min: string;
          ideal: string;
        };
      };
      previousContributions: {
        weight: number;
        factors: string[];
      };
      communityStanding: {
        weight: number;
        factors: string[];
      };
      reportHistory: {
        weight: number;
        factors: string[];
      };
    };
  };
}
