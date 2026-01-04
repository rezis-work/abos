import { Response, NextFunction, Request } from "express";
import { ApiError } from "@common/http";
import { createLogger } from "@common/logger";
import { AuthenticatedRequest } from "./auth";

// Extend AuthenticatedRequest to include params
interface AuthenticatedRequestWithParams extends AuthenticatedRequest {
  params: Request["params"];
}
import {
  hasVerifiedMembership,
  getMembershipProjection,
} from "../services/projection.service";

const logger = createLogger("authorize-middleware");

/**
 * Middleware to require verified membership in a building.
 * Expects buildingId in req.params.buildingId
 */
export function requireVerifiedResident() {
  return async (
    req: AuthenticatedRequestWithParams,
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

    try {
      const hasMembership = await hasVerifiedMembership(
        req.user.userId,
        buildingId
      );

      if (!hasMembership) {
        logger.warn("User does not have verified membership in building", {
          userId: req.user.userId,
          buildingId,
        });
        const error: ApiError = new Error(
          "You must be a verified resident of this building"
        );
        error.statusCode = 403;
        error.code = "FORBIDDEN";
        next(error);
        return;
      }

      logger.debug("Verified membership confirmed", {
        userId: req.user.userId,
        buildingId,
      });
      next();
    } catch (err) {
      logger.error("Error checking verified membership", {
        error: err instanceof Error ? err.message : String(err),
        userId: req.user.userId,
        buildingId,
      });
      const error: ApiError = new Error("Error checking building membership");
      error.statusCode = 500;
      error.code = "INTERNAL_ERROR";
      next(error);
    }
  };
}

/**
 * Middleware to require admin or guard role.
 * Checks JWT role and optionally building-level admin role from projection.
 */
export function requireAdminOrGuard() {
  return async (
    req: AuthenticatedRequestWithParams,
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

    // Platform-level admins always have access
    if (req.user.role === "super_admin" || req.user.role === "manager") {
      next();
      return;
    }

    // Check if user is building admin (from projection) or has guard role
    // Note: "guard" role would need to be defined in IAM service
    // For now, we check for building_admin role or admin role in projection
    const allowedRoles = ["building_admin", "admin", "guard"];
    if (allowedRoles.includes(req.user.role)) {
      next();
      return;
    }

    // Check building-level admin from projection if buildingId is in params
    const { buildingId } = req.params;
    if (buildingId) {
      try {
        const projection = await getMembershipProjection(
          req.user.userId,
          buildingId
        );
        if (projection && projection.role === "admin") {
          next();
          return;
        }
      } catch (err) {
        logger.error("Error checking building admin role", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.warn("Insufficient permissions - admin or guard role required", {
      userRole: req.user.role,
      userId: req.user.userId,
    });
    const error: ApiError = new Error(
      "Insufficient permissions - admin or guard role required"
    );
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    next(error);
  };
}
