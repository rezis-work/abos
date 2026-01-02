import { Response, NextFunction } from "express";
import { ApiError } from "@common/http";
import { createLogger } from "@common/logger";
import { AuthenticatedRequest } from "./auth";
import { hasBuildingAdminAccess } from "../services/membership.service";

const logger = createLogger("authorize-middleware");

export function requireRole(roles: string[]) {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      logger.warn("Authentication required but user not found");
      const error: ApiError = new Error("Authentication required");
      error.statusCode = 401;
      error.code = "UNAUTHORIZED";
      next(error);
      return;
    }

    logger.debug("Checking role authorization", {
      userRole: req.user.role,
      requiredRoles: roles,
    });

    if (!roles.includes(req.user.role)) {
      logger.warn("Insufficient permissions", {
        userRole: req.user.role,
        requiredRoles: roles,
      });
      const error: ApiError = new Error("Insufficient permissions");
      error.statusCode = 403;
      error.code = "FORBIDDEN";
      next(error);
      return;
    }

    next();
  };
}

export function requireSuperAdminOrManager() {
  return requireRole(["super_admin", "manager"]);
}

/**
 * Middleware to require building admin access.
 * For building_admin role: checks if user has verified membership with roleInBuilding = 'admin' in the building.
 * For super_admin/manager: allows access to all buildings (platform-level admins).
 *
 * Expects buildingId in req.params.buildingId
 */
export function requireBuildingAdmin() {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      logger.warn("Authentication required but user not found");
      const error: ApiError = new Error("Authentication required");
      error.statusCode = 401;
      error.code = "UNAUTHORIZED";
      next(error);
      return;
    }

    const { buildingId } = req.params;
    if (!buildingId) {
      logger.warn("Building ID not found in request params");
      const error: ApiError = new Error("Building ID is required");
      error.statusCode = 400;
      error.code = "VALIDATION_ERROR";
      next(error);
      return;
    }

    // Check if user has required role
    const allowedRoles = ["building_admin", "super_admin", "manager"];
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn("Insufficient role permissions", {
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });
      const error: ApiError = new Error("Insufficient permissions");
      error.statusCode = 403;
      error.code = "FORBIDDEN";
      next(error);
      return;
    }

    // Check building-scoped access
    try {
      const hasAccess = await hasBuildingAdminAccess(
        buildingId,
        req.user.userId,
        req.user.role
      );

      if (!hasAccess) {
        logger.warn("User does not have admin access to building", {
          userId: req.user.userId,
          userRole: req.user.role,
          buildingId,
        });
        const error: ApiError = new Error(
          "You do not have admin access to this building"
        );
        error.statusCode = 403;
        error.code = "FORBIDDEN";
        next(error);
        return;
      }

      logger.debug("Building admin access granted", {
        userId: req.user.userId,
        userRole: req.user.role,
        buildingId,
      });
      next();
    } catch (err) {
      logger.error("Error checking building admin access", {
        error: err instanceof Error ? err.message : String(err),
        userId: req.user.userId,
        buildingId,
      });
      const error: ApiError = new Error("Error checking building access");
      error.statusCode = 500;
      error.code = "INTERNAL_ERROR";
      next(error);
    }
  };
}
