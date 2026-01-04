import { ConsumeMessage } from 'amqplib';
import { closeConnection } from './connection';
import { BaseEvent, RoutingKey } from './types';
import { IdempotencyStore, RetryConfig } from './reliability';
export declare class EventPublisher {
    publish(routingKey: RoutingKey, event: BaseEvent, correlationId?: string, causationId?: string): Promise<void>;
}
export interface EventHandler<T = unknown> {
    (event: BaseEvent & {
        payload: T;
    }, message: ConsumeMessage): Promise<void>;
}
export declare class EventConsumer {
    private queueName;
    private dlqName;
    private handlers;
    private idempotencyStore;
    private retryConfig;
    constructor(queueName: string, options?: {
        idempotencyStore?: IdempotencyStore;
        retryConfig?: RetryConfig;
    });
    start(): Promise<void>;
    on<T = unknown>(eventType: string, handler: EventHandler<T>): void;
    bind(routingKeyPattern: string): Promise<void>;
}
export declare function createEventId(): Promise<string>;
export { closeConnection };
export * from './types';
export * from './reliability';
//# sourceMappingURL=index.d.ts.map