import { EventConsumer } from "@common/events";
import { createLogger } from "@common/logger";
import { DatabaseIdempotencyStore } from "./idempotency.store";
import { handleUserCreated } from "../handlers/user.created.handler";
import { handleResidentVerified } from "../handlers/resident.verified.handler";

const logger = createLogger("consumer-service");

const QUEUE_NAME = "notifications.q";

/**
 * Initialize and start the event consumer.
 */
export function startConsumer(): void {
  logger.info("Initializing event consumer", { queueName: QUEUE_NAME });

  // Create consumer with database idempotency store
  const consumer = new EventConsumer(QUEUE_NAME, {
    idempotencyStore: new DatabaseIdempotencyStore(),
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    },
  });

  // Register event handlers
  // Note: eventType in BaseEvent is "user.created", not "user.created.v1"
  // The version is in the event.version field, routing key is "user.created.v1"
  consumer.on("user.created", handleUserCreated);
  consumer.on("resident.verified", handleResidentVerified);

  // Bind queue to routing keys
  consumer
    .bind("user.created.v1")
    .then(() => {
      logger.info("Bound to user.created.v1");
    })
    .catch((error) => {
      logger.error("Failed to bind to user.created.v1", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

  consumer
    .bind("resident.verified.v1")
    .then(() => {
      logger.info("Bound to resident.verified.v1");
    })
    .catch((error) => {
      logger.error("Failed to bind to resident.verified.v1", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

  // Start consuming
  consumer
    .start()
    .then(() => {
      logger.info("Event consumer started successfully", {
        queueName: QUEUE_NAME,
      });
    })
    .catch((error) => {
      logger.error("Failed to start event consumer", {
        queueName: QUEUE_NAME,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
}
