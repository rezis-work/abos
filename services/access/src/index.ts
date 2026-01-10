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
  createCorsMiddleware,
} from "@common/http";
import { healthRoute } from "./routes/health";
import swaggerRoutes from "./routes/swagger";
import visitorPassesRoutes from "./routes/visitor-passes";
import { startOutboxWorker } from "./services/outbox.service";
import { startConsumer } from "./services/consumer.service";

const env = getEnv();
const logger = createLogger(env.SERVICE_NAME || "access-service");
const app: Express = express();

// Middleware
app.use(createCorsMiddleware());
app.use(express.json());
app.use(correlationId());
app.use(requestLogger(logger));

// Routes - mount under /access prefix for nginx routing
app.get("/access/health", healthRoute);
app.use("/access", swaggerRoutes); // Mount swagger routes first to avoid route conflicts
app.use("/access", visitorPassesRoutes);

// Error handling (must be last)
app.use(errorHandler);

// Start outbox worker
startOutboxWorker();

// Start event consumer
startConsumer();

// Graceful shutdown
const server = app.listen(env.PORT || 3006, () => {
  logger.info("Access service started", {
    port: env.PORT || 3006,
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

