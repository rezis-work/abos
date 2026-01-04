import * as amqp from 'amqp-connection-manager';
export declare function getConnection(): Promise<amqp.AmqpConnectionManager>;
export declare function getChannel(): Promise<amqp.ChannelWrapper>;
export declare function closeConnection(): Promise<void>;
//# sourceMappingURL=connection.d.ts.map