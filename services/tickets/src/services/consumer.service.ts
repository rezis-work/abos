import { EventConsumer } from "@common/events";
import { createLogger } from "@common/logger";
import { DatabaseIdempotencyStore } from "./idempotency.store";
import { handleResidentVerified } from "../handlers/resident.verified.handler";

const logger = createLogger("consumer-service");

const QUEUE_NAME = "tickets.projections.q";

/**
 * Initialize and start the event consumer for projection sync.
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
  // Note: eventType in BaseEvent is "resident.verified", not "resident.verified.v1"
  // The version is in the event.version field, routing key is "resident.verified.v1"
  consumer.on("resident.verified", handleResidentVerified);

  // Start consuming first (this asserts the queue)
  consumer
    .start()
    .then(() => {
      logger.info("Event consumer started successfully", {
        queueName: QUEUE_NAME,
      });

      // Bind queue to routing keys after queue is asserted
      return consumer.bind("resident.verified.v1");
    })
    .then(() => {
      logger.info("Bound to resident.verified.v1");
    })
    .catch((error) => {
      logger.error("Failed to start event consumer or bind queue", {
        queueName: QUEUE_NAME,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
}

