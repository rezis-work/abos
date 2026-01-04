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

async function retryConnection<T>(
  fn: () => Promise<T>,
  maxRetries = 30,
  delayMs = 3000,
  initialDelayMs = 5000
): Promise<T> {
  let lastError: Error | undefined;
  
  // Initial delay to allow DNS to propagate (entrypoint script also adds a delay)
  if (initialDelayMs > 0) {
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
      const isTransientError =
        errorCode === "EAI_AGAIN" ||
        errorCode === "ENOTFOUND" ||
        errorCode === "ECONNREFUSED" ||
        errorCode === "ETIMEDOUT" ||
        errorMessage?.includes("getaddrinfo") ||
        errorMessage?.includes("ENOTFOUND") ||
        errorMessage?.includes("EAI_AGAIN") ||
        errorMessage?.includes("connect ECONNREFUSED");

      if (isTransientError && attempt < maxRetries) {
        logger.warn(`Connection attempt ${attempt}/${maxRetries} failed, retrying...`, {
          error: errorMessage,
          code: errorCode,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
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
  });

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
      try {
        // Retry migration execution in case of transient connection errors
        await retryConnection(async () => {
          await sql.unsafe(migrationSQL);
        });
        logger.info("Migration completed", { file: migrationFile });
      } catch (error: any) {
        // Check if error is about duplicate type/constraint (expected in concurrent scenarios)
        if (
          error?.code === "23505" || // Unique violation
          error?.code === "42P07" || // Duplicate object
          (error?.message && error.message.includes("already exists"))
        ) {
          logger.warn("Migration encountered 'already exists' error (safe to ignore)", {
            file: migrationFile,
            error: error.message,
          });
          // Continue - this is expected when migrations run concurrently
        } else {
          // Re-throw other errors
          throw error;
        }
      }
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

