import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createVisitorPass,
  revokeVisitorPass,
  markVisitorPassUsed,
} from '../src/services/visitor-pass.service';
import { hasVerifiedMembership, getMembershipProjection } from '../src/services/projection.service';
import { db } from '../src/db';

// Mock dependencies
vi.mock('../src/services/projection.service');
vi.mock('../src/db');

describe('Visitor Pass Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset db.transaction mock
    vi.mocked(db.transaction).mockReset();
  });

  describe('createVisitorPass', () => {
    it('should validate date range (validFrom < validTo)', async () => {
      const input = {
        buildingId: 'building-123',
        residentId: 'user-123',
        visitorName: 'John Doe',
        validFrom: new Date('2024-01-15T18:00:00Z'),
        validTo: new Date('2024-01-15T10:00:00Z'), // Invalid: after validFrom
      };

      vi.mocked(hasVerifiedMembership).mockResolvedValue(true);

      await expect(createVisitorPass(input)).rejects.toThrow(
        'validFrom must be before validTo'
      );
    });

    it('should require verified membership', async () => {
      const input = {
        buildingId: 'building-123',
        residentId: 'user-123',
        visitorName: 'John Doe',
        validFrom: new Date('2024-01-15T10:00:00Z'),
        validTo: new Date('2024-01-15T18:00:00Z'),
      };

      vi.mocked(hasVerifiedMembership).mockResolvedValue(false);

      await expect(createVisitorPass(input)).rejects.toThrow(
        'User does not have verified membership'
      );
    });
  });

  describe('revokeVisitorPass', () => {
    it('should only allow owner to revoke', async () => {
      const mockPass = {
        id: 'pass-123',
        buildingId: 'building-123',
        residentId: 'user-123',
        visitorName: 'John Doe',
        validFrom: new Date('2024-01-15T10:00:00Z'),
        validTo: new Date('2024-01-15T18:00:00Z'),
        status: 'active' as const,
        createdAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPass]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      const mockTx = {
        select: mockSelect,
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockPass]),
            }),
          }),
        }),
      };

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      // Try to revoke as different user
      await expect(
        revokeVisitorPass('pass-123', 'different-user', undefined)
      ).rejects.toThrow('You can only revoke your own visitor passes');
    });

    it('should only allow revoking active passes', async () => {
      const mockPass = {
        id: 'pass-123',
        buildingId: 'building-123',
        residentId: 'user-123',
        visitorName: 'John Doe',
        validFrom: new Date('2024-01-15T10:00:00Z'),
        validTo: new Date('2024-01-15T18:00:00Z'),
        status: 'used' as const,
        createdAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPass]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      const mockTx = {
        select: mockSelect,
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockPass]),
            }),
          }),
        }),
      };

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await expect(
        revokeVisitorPass('pass-123', 'user-123', undefined)
      ).rejects.toThrow('Only active visitor passes can be revoked');
    });
  });

  describe('markVisitorPassUsed', () => {
    it('should only allow admin/guard to mark as used', async () => {
      // Use fake timers to control time
      const now = new Date('2024-01-15T14:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      // Set valid time window (current time is within range)
      const validFrom = new Date('2024-01-15T10:00:00Z'); // 4 hours before now
      const validTo = new Date('2024-01-15T18:00:00Z'); // 4 hours after now

      const mockPass = {
        id: 'pass-123',
        buildingId: 'building-123',
        residentId: 'user-123',
        visitorName: 'John Doe',
        validFrom,
        validTo,
        status: 'active' as const,
        createdAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPass]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      const mockTx = {
        select: mockSelect,
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockPass]),
            }),
          }),
        }),
      };

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });
      vi.mocked(getMembershipProjection).mockResolvedValue(null);

      // Try as regular resident
      await expect(
        markVisitorPassUsed('pass-123', 'user-456', 'resident', 'building-123', undefined)
      ).rejects.toThrow('Only admins or guards can mark visitor passes as used');

      vi.useRealTimers();
    });

    it('should only allow marking active passes as used', async () => {
      const mockPass = {
        id: 'pass-123',
        buildingId: 'building-123',
        residentId: 'user-123',
        visitorName: 'John Doe',
        validFrom: new Date('2024-01-15T10:00:00Z'),
        validTo: new Date('2024-01-15T18:00:00Z'),
        status: 'used' as const,
        createdAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPass]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      const mockTx = {
        select: mockSelect,
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockPass]),
            }),
          }),
        }),
      };

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });
      vi.mocked(getMembershipProjection).mockResolvedValue({
        id: 'proj-123',
        userId: 'admin-123',
        buildingId: 'building-123',
        role: 'admin' as const,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        markVisitorPassUsed('pass-123', 'admin-123', 'admin', 'building-123', undefined)
      ).rejects.toThrow('Only active visitor passes can be marked as used');
    });

    it('should validate time window', async () => {
      const now = new Date('2024-01-20T12:00:00Z'); // After validTo
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const mockPass = {
        id: 'pass-123',
        buildingId: 'building-123',
        residentId: 'user-123',
        visitorName: 'John Doe',
        validFrom: new Date('2024-01-15T10:00:00Z'),
        validTo: new Date('2024-01-15T18:00:00Z'),
        status: 'active' as const,
        createdAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPass]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      const mockTx = {
        select: mockSelect,
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockPass]),
            }),
          }),
        }),
      };

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });
      vi.mocked(getMembershipProjection).mockResolvedValue({
        id: 'proj-123',
        userId: 'admin-123',
        buildingId: 'building-123',
        role: 'admin' as const,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        markVisitorPassUsed('pass-123', 'admin-123', 'admin', 'building-123', undefined)
      ).rejects.toThrow('Visitor pass is not valid at this time');

      vi.useRealTimers();
    });
  });
});

