export interface BaseEvent {
  eventId: string;
  version: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export type RoutingKey = 
  | 'user.created'
  | 'user.updated'
  | 'user.role_changed'
  | 'user.deleted'
  | 'building.created'
  | 'unit.assigned_to_user'
  | 'resident.verified'
  | 'resident.unverified'
  | 'post.created'
  | 'comment.created'
  | 'message.sent'
  | 'content.flagged'
  | 'ticket.created'
  | 'ticket.assigned'
  | 'ticket.status_changed'
  | 'ticket.closed'
  | 'booking.created'
  | 'booking.cancelled'
  | 'booking.checked_in'
  | 'resource.updated'
  | 'provider.created'
  | 'provider.verified'
  | 'service.listing_created'
  | 'quote.requested'
  | 'job.booked'
  | 'payment.initiated'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'refund.issued'
  | 'invoice.created'
  | 'notification.sent'
  | 'notification.failed'
  | 'ai.summary_ready'
  | 'ai.moderation_result';

export const EXCHANGE_NAME = 'app.events';
export const EXCHANGE_TYPE = 'topic';

