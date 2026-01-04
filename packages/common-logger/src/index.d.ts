export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export interface LoggerContext {
    service?: string;
    requestId?: string;
    userId?: string;
    [key: string]: unknown;
}
declare class Logger {
    private logger;
    constructor(serviceName?: string);
    error(message: string, context?: LoggerContext): void;
    warn(message: string, context?: LoggerContext): void;
    info(message: string, context?: LoggerContext): void;
    debug(message: string, context?: LoggerContext): void;
    child(context: LoggerContext): Logger;
}
export declare function createLogger(serviceName?: string): Logger;
export declare function getLogger(): Logger;
export { Logger };
//# sourceMappingURL=index.d.ts.map