import "dotenv/config";
import postgres from "postgres";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { getEnv } from "@common/env";
import { createLogger } from "@common/logger";

const logger = createLogger("migrate");

const env = getEnv();
const databaseUrl =
  env.DATABASE_URL ||
  `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${
    env.POSTGRES_HOST
  }:${env.POSTGRES_PORT}/${env.POSTGRES_DB || "notifications_db"}`;

async function runMigrations() {
  // First, ensure the database exists by connecting to the default 'postgres' database
  const defaultDatabaseUrl =
    env.DATABASE_URL?.replace(/\/[^/]+$/, "/postgres") ||
    `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/postgres`;

  const defaultSql = postgres(defaultDatabaseUrl);

  try {
    // Create notifications_db if it doesn't exist
    const dbName = env.POSTGRES_DB || "notifications_db";
    logger.info("Ensuring database exists", { database: dbName });

    const result = await defaultSql`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;

    if (result.length === 0) {
      logger.info("Creating database", { database: dbName });
      // Use unsafe for CREATE DATABASE as it doesn't support parameterized queries
      await defaultSql.unsafe(`CREATE DATABASE ${dbName}`);
      logger.info("Database created", { database: dbName });
    } else {
      logger.info("Database already exists", { database: dbName });
    }
  } catch (error) {
    logger.error("Failed to ensure database exists", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await defaultSql.end();
  }

  // Now connect to the target database and run migrations
  const sql = postgres(databaseUrl);

  try {
    // Read migration files from directory
    const migrationsDir = join(__dirname, "migrations");

    let migrationFiles: string[];
    try {
      migrationFiles = readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .sort(); // Sort to ensure order
    } catch (error) {
      // If migrations directory doesn't exist, skip
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.warn("Migrations directory not found, skipping migrations");
        return;
      }
      throw error;
    }

    if (migrationFiles.length === 0) {
      logger.warn("No migration files found");
      return;
    }

    logger.info("Reading migration files", {
      dir: migrationsDir,
      count: migrationFiles.length,
    });

    for (const migrationFile of migrationFiles) {
      const filePath = join(migrationsDir, migrationFile);
      const migrationSQL = readFileSync(filePath, "utf-8");
      logger.info("Executing migration", { file: migrationFile });
      await sql.unsafe(migrationSQL);
      logger.info("Migration completed", { file: migrationFile });
    }

    logger.info("All migrations completed successfully");
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

