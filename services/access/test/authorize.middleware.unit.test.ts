import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response, Request } from 'express';
import { requireVerifiedResident } from '../src/middleware/authorize';
import { hasVerifiedMembership } from '../src/services/projection.service';

// Mock projection service
vi.mock('../src/services/projection.service', () => ({
  hasVerifiedMembership: vi.fn(),
  getMembershipProjection: vi.fn(),
}));

describe('requireVerifiedResident Middleware', () => {
  let mockReq: any;
  let mockRes: Response;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      user: {
        userId: 'user-123',
        role: 'resident',
      },
      params: {
        buildingId: 'building-123',
      },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    mockNext = vi.fn();
  });

  it('should call next() when user has verified membership', async () => {
    vi.mocked(hasVerifiedMembership).mockResolvedValue(true);

    const middleware = requireVerifiedResident();
    await middleware(mockReq, mockRes, mockNext);

    expect(hasVerifiedMembership).toHaveBeenCalledWith('user-123', 'building-123');
    expect(mockNext).toHaveBeenCalledWith();
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should call next() with 403 error when user does not have verified membership', async () => {
    vi.mocked(hasVerifiedMembership).mockResolvedValue(false);

    const middleware = requireVerifiedResident();
    await middleware(mockReq, mockRes, mockNext);

    expect(hasVerifiedMembership).toHaveBeenCalledWith('user-123', 'building-123');
    expect(mockNext).toHaveBeenCalled();
    
    const error = mockNext.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toContain('verified resident');
  });

  it('should call next() with 401 error when user is not authenticated', async () => {
    mockReq.user = undefined;

    const middleware = requireVerifiedResident();
    await middleware(mockReq, mockRes, mockNext);

    expect(hasVerifiedMembership).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
    
    const error = mockNext.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('should call next() with 400 error when buildingId is missing', async () => {
    mockReq.params.buildingId = undefined;

    const middleware = requireVerifiedResident();
    await middleware(mockReq, mockRes, mockNext);

    expect(hasVerifiedMembership).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
    
    const error = mockNext.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('should call next() with 500 error when database error occurs', async () => {
    vi.mocked(hasVerifiedMembership).mockRejectedValue(new Error('Database error'));

    const middleware = requireVerifiedResident();
    await middleware(mockReq, mockRes, mockNext);

    expect(hasVerifiedMembership).toHaveBeenCalledWith('user-123', 'building-123');
    expect(mockNext).toHaveBeenCalled();
    
    const error = mockNext.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
  });
});

