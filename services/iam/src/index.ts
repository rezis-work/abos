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
import authRoutes from "./routes/auth";
import meRoutes from "./routes/me";
import { startOutboxWorker } from "./services/outbox.service";

const env = getEnv();
const logger = createLogger(env.SERVICE_NAME || "iam-service");
const app: Express = express();

// Middleware
app.use(express.json());
app.use(correlationId());
app.use(requestLogger(logger));

// Routes - mount under /iam prefix for nginx routing
app.get("/iam/health", healthRoute);
app.use("/iam/auth", authRoutes);
app.use("/iam", meRoutes);

// Error handling (must be last)
app.use(errorHandler);

// Start outbox worker
startOutboxWorker();

// Graceful shutdown
const server = app.listen(env.PORT || 3001, () => {
  logger.info("IAM service started", {
    port: env.PORT || 3001,
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
