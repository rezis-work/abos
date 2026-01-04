import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  upsertMembershipProjection,
  getMembershipProjection,
  hasVerifiedMembership,
} from "../src/services/projection.service";
import { db, buildingMembershipsProjection, processedEvents } from "../src/db";

// Mock db
vi.mock("../src/db", () => {
  const mockDb = {
    transaction: vi.fn(),
    select: vi.fn(),
  };
  return {
    db: mockDb,
    buildingMembershipsProjection: {},
    processedEvents: {},
  };
});

describe("Projection Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("upsertMembershipProjection", () => {
    it("should insert new projection when event not processed", async () => {
      const userId = "user-123";
      const buildingId = "building-123";
      const role = "resident" as const;
      const verifiedAt = new Date();
      const eventId = "event-123";

      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({
        values: mockInsertValues,
      });

      const mockTx = {
        insert: mockInsert,
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No existing projection
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
      };

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await upsertMembershipProjection(
        userId,
        buildingId,
        role,
        verifiedAt,
        eventId
      );

      // Should insert processed_events first
      expect(mockInsert).toHaveBeenCalledWith(processedEvents);
      expect(mockInsertValues).toHaveBeenCalled();

      // Should check for existing projection
      expect(mockTx.select).toHaveBeenCalled();

      // Should insert new projection (since existing.length === 0)
      expect(mockInsert).toHaveBeenCalledWith(buildingMembershipsProjection);
    });

    it("should update existing projection when event not processed", async () => {
      const userId = "user-123";
      const buildingId = "building-123";
      const role = "admin" as const;
      const verifiedAt = new Date();
      const eventId = "event-456";

      const existingProjection = {
        userId,
        buildingId,
        role: "resident",
        verifiedAt: new Date("2024-01-01"),
      };

      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({
        values: mockInsertValues,
      });

      const mockUpdateWhere = vi.fn().mockReturnValue({
        then: (resolve: any) => resolve(undefined),
      });
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdateWhere,
        }),
      });

      const mockTx = {
        insert: mockInsert,
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([existingProjection]), // Existing projection
        update: mockUpdate,
        set: vi.fn().mockReturnThis(),
      };

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await upsertMembershipProjection(
        userId,
        buildingId,
        role,
        verifiedAt,
        eventId
      );

      // Should insert processed_events first
      expect(mockInsert).toHaveBeenCalledWith(processedEvents);
      expect(mockInsertValues).toHaveBeenCalled();

      // Should check for existing projection
      expect(mockTx.select).toHaveBeenCalled();

      // Should update existing projection (since existing.length > 0)
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("should throw EVENT_ALREADY_PROCESSED when event already processed", async () => {
      const userId = "user-123";
      const buildingId = "building-123";
      const role = "resident" as const;
      const verifiedAt = new Date();
      const eventId = "event-789";

      const mockInsertValues = vi.fn().mockRejectedValue({
        code: "23505", // Unique constraint violation
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: mockInsertValues,
      });

      const mockTx = {
        insert: mockInsert,
      };

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await expect(
        upsertMembershipProjection(
          userId,
          buildingId,
          role,
          verifiedAt,
          eventId
        )
      ).rejects.toThrow("EVENT_ALREADY_PROCESSED");
    });
  });

  describe("getMembershipProjection", () => {
    it("should return projection when exists", async () => {
      const userId = "user-123";
      const buildingId = "building-123";
      const projection = {
        userId,
        buildingId,
        role: "resident",
        verifiedAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([projection]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const chainableSelect = {
        from: mockFrom,
      };

      (db.select as any).mockReturnValue(chainableSelect);

      const result = await getMembershipProjection(userId, buildingId);

      expect(result).toEqual(projection);
    });

    it("should return null when projection does not exist", async () => {
      const userId = "user-123";
      const buildingId = "building-123";

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const chainableSelect = {
        from: mockFrom,
      };

      (db.select as any).mockReturnValue(chainableSelect);

      const result = await getMembershipProjection(userId, buildingId);

      expect(result).toBeNull();
    });
  });

  describe("hasVerifiedMembership", () => {
    it("should return true when projection exists", async () => {
      const userId = "user-123";
      const buildingId = "building-123";
      const projection = {
        userId,
        buildingId,
        role: "resident",
        verifiedAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([projection]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const chainableSelect = {
        from: mockFrom,
      };

      (db.select as any).mockReturnValue(chainableSelect);

      const result = await hasVerifiedMembership(userId, buildingId);

      expect(result).toBe(true);
    });

    it("should return false when projection does not exist", async () => {
      const userId = "user-123";
      const buildingId = "building-123";

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const chainableSelect = {
        from: mockFrom,
      };

      (db.select as any).mockReturnValue(chainableSelect);

      const result = await hasVerifiedMembership(userId, buildingId);

      expect(result).toBe(false);
    });
  });
});
