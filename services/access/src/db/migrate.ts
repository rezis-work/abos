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
  }:${env.POSTGRES_PORT}/${env.POSTGRES_DB || "access_db"}`;

async function retryConnection<T>(
  fn: () => Promise<T>,
  maxRetries = 30,
  delayMs = 3000,
  initialDelayMs = 5000
): Promise<T> {
  let lastError: Error | undefined;

  // Initial delay to allow DNS to propagate (entrypoint script also adds a delay)
  if (initialDelayMs > 0) {
    logger.info(
      `Waiting ${initialDelayMs}ms before initial connection attempt...`
    );
    await new Promise((resolve) => setTimeout(resolve, initialDelayMs));
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Check if it's a DNS/connection error that might be transient
      const errorCode = error?.code || error?.errno?.toString();
      const errorMessage = error?.message || String(error);
      const errorString = String(error);

      const isTransientError =
        errorCode === "EAI_AGAIN" ||
        errorCode === "ENOTFOUND" ||
        errorCode === "ECONNREFUSED" ||
        errorCode === "ETIMEDOUT" ||
        errorCode === "ECONNRESET" ||
        errorMessage?.includes("getaddrinfo") ||
        errorMessage?.includes("ENOTFOUND") ||
        errorMessage?.includes("EAI_AGAIN") ||
        errorMessage?.includes("connect ECONNREFUSED") ||
        errorMessage?.includes("Connection terminated") ||
        errorMessage?.includes("Connection closed") ||
        errorString?.includes("getaddrinfo") ||
        errorString?.includes("ENOTFOUND") ||
        errorString?.includes("EAI_AGAIN") ||
        errorString?.includes("ECONNREFUSED");

      if (isTransientError && attempt < maxRetries) {
        logger.warn(
          `Connection attempt ${attempt}/${maxRetries} failed, retrying...`,
          {
            error: errorMessage,
            code: errorCode,
            errno: error?.errno,
            fullError: errorString,
          }
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      // Log the error before throwing
      logger.error(`Connection failed after ${attempt} attempts`, {
        error: errorMessage,
        code: errorCode,
        errno: error?.errno,
        fullError: errorString,
        stack: error?.stack,
      });
      throw error;
    }
  }
  throw lastError || new Error("Connection failed after retries");
}

async function runMigrations() {
  // First, ensure the database exists by connecting to the default 'postgres' database
  const defaultDatabaseUrl =
    env.DATABASE_URL?.replace(/\/[^/]+$/, "/postgres") ||
    `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/postgres`;

  await retryConnection(async () => {
    const defaultSql = postgres(defaultDatabaseUrl);

    try {
      // Create access_db if it doesn't exist
      const dbName = env.POSTGRES_DB || "access_db";
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
  });

  // Now connect to the target database and run migrations
  // Read migration files first (before creating connection)
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

  // Read all migration SQL files
  const migrationSQLs = migrationFiles.map((file) => ({
    file,
    sql: readFileSync(join(migrationsDir, file), "utf-8"),
  }));

  // Execute all migrations with retry logic
  // Use a single connection for all migrations, but retry the entire operation if it fails
  await retryConnection(async () => {
    const sql = postgres(databaseUrl);
    try {
      for (const { file, sql: migrationSQL } of migrationSQLs) {
        logger.info("Executing migration", { file });
        await sql.unsafe(migrationSQL);
        logger.info("Migration completed", { file });
      }
    } finally {
      await sql.end();
    }
  });

  logger.info("All migrations completed successfully");
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info("Migrations completed");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Migration error", {
        error: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        errno: (error as any)?.errno,
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    });
}

export { runMigrations };

