import { Response, NextFunction } from 'express';
import { ApiError } from '@common/http';
import { createLogger } from '@common/logger';
import { AuthenticatedRequest } from './auth';
import { hasVerifiedMembership, isBuildingAdmin } from '../services/projection.service';

const logger = createLogger('authorize-middleware');

/**
 * Middleware to require verified member membership in a building.
 * Checks the local membership projection.
 * Expects buildingId in req.params.buildingId
 */
export function requireVerifiedMember() {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      logger.warn('Authentication required but user not found');
      const error: ApiError = new Error('Authentication required');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      next(error);
      return;
    }

    const { buildingId } = req.params;
    if (!buildingId) {
      logger.warn('Building ID not found in request params');
      const error: ApiError = new Error('Building ID is required');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      next(error);
      return;
    }

    try {
      const hasMembership = await hasVerifiedMembership(
        req.user.userId,
        buildingId
      );

      if (!hasMembership) {
        logger.warn('User does not have verified membership in building', {
          userId: req.user.userId,
          buildingId,
        });
        const error: ApiError = new Error(
          'You must be a verified member of this building'
        );
        error.statusCode = 403;
        error.code = 'FORBIDDEN';
        next(error);
        return;
      }

      logger.debug('Verified member access granted', {
        userId: req.user.userId,
        buildingId,
      });
      next();
    } catch (err) {
      logger.error('Error checking verified membership', {
        error: err instanceof Error ? err.message : String(err),
        userId: req.user.userId,
        buildingId,
      });
      const error: ApiError = new Error('Error checking building membership');
      error.statusCode = 500;
      error.code = 'INTERNAL_ERROR';
      next(error);
    }
  };
}

/**
 * Middleware to require building admin access.
 * Checks the local membership projection for admin role.
 * Also allows super_admin and manager (platform-level admins).
 * Expects buildingId in req.params.buildingId
 */
export function requireBuildingAdmin() {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      logger.warn('Authentication required but user not found');
      const error: ApiError = new Error('Authentication required');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      next(error);
      return;
    }

    const { buildingId } = req.params;
    if (!buildingId) {
      logger.warn('Building ID not found in request params');
      const error: ApiError = new Error('Building ID is required');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      next(error);
      return;
    }

    try {
      const hasAccess = await isBuildingAdmin(
        req.user.userId,
        buildingId,
        req.user.role
      );

      if (!hasAccess) {
        logger.warn('User does not have admin access to building', {
          userId: req.user.userId,
          userRole: req.user.role,
          buildingId,
        });
        const error: ApiError = new Error(
          'You do not have admin access to this building'
        );
        error.statusCode = 403;
        error.code = 'FORBIDDEN';
        next(error);
        return;
      }

      logger.debug('Building admin access granted', {
        userId: req.user.userId,
        userRole: req.user.role,
        buildingId,
      });
      next();
    } catch (err) {
      logger.error('Error checking building admin access', {
        error: err instanceof Error ? err.message : String(err),
        userId: req.user.userId,
        buildingId,
      });
      const error: ApiError = new Error('Error checking building access');
      error.statusCode = 500;
      error.code = 'INTERNAL_ERROR';
      next(error);
    }
  };
}
