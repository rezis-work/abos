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
import notificationsRoutes from "./routes/notifications";
import { startConsumer } from "./services/consumer.service";

const env = getEnv();
const logger = createLogger(env.SERVICE_NAME || "notifications-service");
const app: Express = express();

// Middleware
app.use(express.json());
app.use(correlationId());
app.use(requestLogger(logger));

// Routes
app.get("/health", healthRoute);
app.use("/notifications", notificationsRoutes);

// Error handling (must be last)
app.use(errorHandler);

// Start event consumer
startConsumer();

// Graceful shutdown
const server = app.listen(env.PORT || 3003, () => {
  logger.info("Notifications service started", {
    port: env.PORT || 3003,
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

