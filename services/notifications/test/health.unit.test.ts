import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { healthRoute } from '../src/routes/health';

describe('Health Route', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });
    
    mockRequest = {};
    mockResponse = {
      json: jsonSpy,
      status: statusSpy,
    };
  });

  it('should return health status with service name', () => {
    healthRoute(mockRequest as Request, mockResponse as Response);

    expect(jsonSpy).toHaveBeenCalledOnce();
    const responseData = jsonSpy.mock.calls[0][0];
    
    expect(responseData).toHaveProperty('status', 'ok');
    expect(responseData).toHaveProperty('service', 'notifications-service');
    expect(responseData).toHaveProperty('timestamp');
    expect(typeof responseData.timestamp).toBe('string');
  });

  it('should return valid ISO timestamp', () => {
    healthRoute(mockRequest as Request, mockResponse as Response);

    const responseData = jsonSpy.mock.calls[0][0];
    const timestamp = new Date(responseData.timestamp);
    
    expect(timestamp).toBeInstanceOf(Date);
    expect(isNaN(timestamp.getTime())).toBe(false);
  });
});

