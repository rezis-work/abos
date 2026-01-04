import { EventConsumer } from "@common/events";
import { createLogger } from "@common/logger";
import { DatabaseIdempotencyStore } from "./idempotency.store";
import { handleUserCreated } from "../handlers/user.created.handler";
import { handleResidentVerified } from "../handlers/resident.verified.handler";
import { handleTicketCreated } from "../handlers/ticket.created.handler";
import { handleTicketAssigned } from "../handlers/ticket.assigned.handler";
import { handleTicketStatusChanged } from "../handlers/ticket.status_changed.handler";
import { handleCommentCreated } from "../handlers/comment.created.handler";

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
  consumer.on("ticket.created", handleTicketCreated);
  consumer.on("ticket.assigned", handleTicketAssigned);
  consumer.on("ticket.status_changed", handleTicketStatusChanged);
  consumer.on("comment.created", handleCommentCreated);

  // Start consuming first (this asserts the queue)
  consumer
    .start()
    .then(() => {
      logger.info("Event consumer started successfully", {
        queueName: QUEUE_NAME,
      });

      // Bind queue to routing keys after queue is asserted
      return Promise.all([
        consumer.bind("user.created.v1"),
        consumer.bind("resident.verified.v1"),
        consumer.bind("ticket.created.v1"),
        consumer.bind("ticket.assigned.v1"),
        consumer.bind("ticket.status_changed.v1"),
        consumer.bind("comment.created.v1"),
      ]);
    })
    .then(() => {
      logger.info("Bound to all routing keys");
    })
    .catch((error) => {
      logger.error("Failed to start event consumer or bind queues", {
        queueName: QUEUE_NAME,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
}
