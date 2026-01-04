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
import postsRoutes from "./routes/posts";
import swaggerRoutes from "./routes/swagger";
import { startConsumer } from "./services/consumer.service";
import { startOutboxWorker } from "./services/outbox.service";

const env = getEnv();
const logger = createLogger(env.SERVICE_NAME || "community-service");
const app: Express = express();

// Middleware
app.use(express.json());
app.use(correlationId());
app.use(requestLogger(logger));

// Routes - mount under /community prefix for nginx routing
app.get("/community/health", healthRoute);
app.use("/community", swaggerRoutes); // Mount swagger routes first to avoid route conflicts
app.use("/community", postsRoutes);

// Error handling (must be last)
app.use(errorHandler);

// Start event consumer (projection sync)
startConsumer();

// Start outbox worker
startOutboxWorker();

// Graceful shutdown
const server = app.listen(env.PORT || 3005, () => {
  logger.info("Community service started", {
    port: env.PORT || 3005,
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
