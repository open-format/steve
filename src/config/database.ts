import { PostgresDatabaseAdapter } from "@elizaos/adapter-postgres";

export function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const db = new PostgresDatabaseAdapter({
    connectionString: process.env.DATABASE_URL,
    parseInputs: true,
    pool: {
      min: Number(process.env.POSTGRES_POOL_MIN || 2),
      max: Number(process.env.POSTGRES_POOL_MAX || 10),
    },
  });

  return db;
}
