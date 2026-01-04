import { ConsumeMessage } from 'amqplib';
export interface IdempotencyStore {
    isProcessed(eventId: string): Promise<boolean>;
    markProcessed(eventId: string, ttlSeconds?: number): Promise<void>;
}
export declare class MemoryIdempotencyStore implements IdempotencyStore {
    private processed;
    private timers;
    isProcessed(eventId: string): Promise<boolean>;
    markProcessed(eventId: string, ttlSeconds?: number): Promise<void>;
}
export interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
}
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
export declare function retryWithBackoff<T>(fn: () => Promise<T>, config?: RetryConfig, attempt?: number): Promise<T>;
export declare function getRedeliveryCount(message: ConsumeMessage): number;
export declare function incrementRedeliveryCount(message: ConsumeMessage): number;
//# sourceMappingURL=reliability.d.ts.map