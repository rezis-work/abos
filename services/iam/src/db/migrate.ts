import "dotenv/config";
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";
import { getEnv } from "@common/env";
import { createLogger } from "@common/logger";

const logger = createLogger("migrate");

const env = getEnv();
const databaseUrl =
  env.DATABASE_URL ||
  `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${
    env.POSTGRES_HOST
  }:${env.POSTGRES_PORT}/${env.POSTGRES_DB || "iam_db"}`;

async function runMigrations() {
  const sql = postgres(databaseUrl);

  try {
    // Read migration file
    const migrationsDir = join(__dirname, "migrations");
    const migrationFile = join(migrationsDir, "0000_exotic_luckman.sql");

    logger.info("Reading migration file", { file: migrationFile });
    const migrationSQL = readFileSync(migrationFile, "utf-8");

    // Execute the entire migration SQL file
    // The SQL file uses IF NOT EXISTS and exception handling, so it's safe to run multiple times
    logger.info("Executing migration");
    await sql.unsafe(migrationSQL);

    logger.info("Migration completed successfully");
  } catch (error) {
    logger.error("Migration failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await sql.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info("Migrations completed");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Migration error", { error });
      process.exit(1);
    });
}

export { runMigrations };
