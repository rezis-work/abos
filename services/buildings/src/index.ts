import "dotenv/config";
import "express-async-errors";
import express from "express";
import { getEnv } from "@common/env";
import { createLogger } from "@common/logger";
import {
  Express,
  errorHandler,
  requestLogger,
  correlationId,
} from "@common/http";
import { healthRoute } from "./routes/health";
import buildingsRoutes from "./routes/buildings";
import swaggerRoutes from "./routes/swagger";
import { startOutboxWorker } from "./services/outbox.service";

const env = getEnv();
const logger = createLogger(env.SERVICE_NAME || "buildings-service");
const app: Express = express();

// Middleware
app.use(express.json());
app.use(correlationId());
app.use(requestLogger(logger));

// Routes - mount under /buildings prefix for nginx routing
app.get("/buildings/health", healthRoute);
app.use("/buildings", swaggerRoutes); // Mount swagger routes first to avoid route conflicts
app.use("/buildings", buildingsRoutes);

// Debug endpoint to check JWT_SECRET (remove in production)
if (env.NODE_ENV === "development") {
  app.get("/debug/jwt-secret", (_req, res) => {
    const jwtSecret = (env.JWT_SECRET || "change-me-in-production") as string;
    res.json({
      jwtSecretSet: !!env.JWT_SECRET,
      jwtSecretLength: jwtSecret.length,
      // Don't expose the actual secret, just confirm it's set
      message: env.JWT_SECRET
        ? "JWT_SECRET is set"
        : "JWT_SECRET not set, using default (ensure IAM service uses same default)",
    });
  });
}

// Error handling (must be last)
app.use(errorHandler);

// Start outbox worker
startOutboxWorker();

// Graceful shutdown
const server = app.listen(env.PORT || 3002, () => {
  logger.info("Buildings service started", {
    port: env.PORT || 3002,
    nodeEnv: env.NODE_ENV,
  });
});

const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
