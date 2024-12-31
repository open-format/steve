import { PostgresDatabaseAdapter } from "@elizaos/adapter-postgres";

export function initializeDatabase() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is required");
  }

  const db = new PostgresDatabaseAdapter({
    connectionString: process.env.POSTGRES_URL,
    parseInputs: true,
    pool: {
      min: Number(process.env.POSTGRES_POOL_MIN || 2),
      max: Number(process.env.POSTGRES_POOL_MAX || 10),
    },
  });

  return db;
}
