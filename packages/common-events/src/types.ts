export interface BaseEvent {
  eventId: string;
  version: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  causationId?: string;
}

export type RoutingKey = 
  | 'user.created'
  | 'user.created.v1'
  | 'user.updated'
  | 'user.role_changed'
  | 'user.role_changed.v1'
  | 'user.deleted'
  | 'building.created'
  | 'building.created.v1'
  | 'unit.created'
  | 'unit.created.v1'
  | 'unit.assigned_to_user'
  | 'resident.verified'
  | 'resident.verified.v1'
  | 'resident.unverified'
  | 'membership.created'
  | 'membership.created.v1'
  | 'post.created'
  | 'comment.created'
  | 'message.sent'
  | 'content.flagged'
  | 'ticket.created'
  | 'ticket.created.v1'
  | 'ticket.assigned'
  | 'ticket.assigned.v1'
  | 'ticket.status_changed'
  | 'ticket.status_changed.v1'
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

