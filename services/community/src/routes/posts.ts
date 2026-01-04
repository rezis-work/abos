import { Router, Response } from 'express';
import {
  asyncHandler,
  validateBody,
  validateQuery,
  RequestWithId,
} from '@common/http';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import {
  requireVerifiedMember,
} from '../middleware/authorize';
import {
  buildingIdParamSchema,
  postIdParamSchema,
  createPostSchema,
  listPostsQuerySchema,
  createCommentSchema,
  listCommentsQuerySchema,
} from './posts.schemas';
import {
  createPost,
  getPostsByBuilding,
  getPostById,
} from '../services/post.service';
import {
  createComment,
  getCommentsByPost,
} from '../services/comment.service';
import { hasVerifiedMembership } from '../services/projection.service';

const router: Router = Router();

/**
 * POST /buildings/:buildingId/posts
 * Create a post (verified member only)
 */
router.post(
  '/buildings/:buildingId/posts',
  authenticate,
  requireVerifiedMember(),
  validateBody(createPostSchema),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { buildingId } = buildingIdParamSchema.parse(req.params);
    const body = createPostSchema.parse(req.body);

    const post = await createPost({
      buildingId,
      userId: req.user!.userId,
      title: body.title,
      content: body.content,
      correlationId: req.requestId,
    });

    res.status(201).json({
      data: post,
      requestId: req.requestId,
    });
  })
);

/**
 * GET /buildings/:buildingId/posts
 * List posts for a building (verified member only)
 */
router.get(
  '/buildings/:buildingId/posts',
  authenticate,
  requireVerifiedMember(),
  validateQuery(listPostsQuerySchema),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { buildingId } = buildingIdParamSchema.parse(req.params);
    const query = listPostsQuerySchema.parse(req.query);

    const posts = await getPostsByBuilding(buildingId, {
      limit: query.limit,
      offset: query.offset,
    });

    res.json({
      data: posts,
      requestId: req.requestId,
    });
  })
);

/**
 * GET /posts/:postId
 * Get post by ID (must be verified member of post's building)
 */
router.get(
  '/posts/:postId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { postId } = postIdParamSchema.parse(req.params);

    const post = await getPostById(postId);
    if (!post) {
      res.status(404).json({
        error: {
          message: 'Post not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
        requestId: req.requestId,
      });
      return;
    }

    // Check if post is deleted
    if (post.status !== 'active') {
      res.status(404).json({
        error: {
          message: 'Post not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
        requestId: req.requestId,
      });
      return;
    }

    // Verify caller is verified member of post's building
    const hasMembership = await hasVerifiedMembership(
      req.user!.userId,
      post.buildingId
    );

    if (!hasMembership) {
      res.status(403).json({
        error: {
          message: 'You must be a verified member of this building',
          code: 'FORBIDDEN',
          statusCode: 403,
        },
        requestId: req.requestId,
      });
      return;
    }

    res.json({
      data: post,
      requestId: req.requestId,
    });
  })
);

/**
 * POST /posts/:postId/comments
 * Create a comment (must be verified member of post's building)
 */
router.post(
  '/posts/:postId/comments',
  authenticate,
  validateBody(createCommentSchema),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { postId } = postIdParamSchema.parse(req.params);
    const body = createCommentSchema.parse(req.body);

    const comment = await createComment({
      postId,
      userId: req.user!.userId,
      content: body.content,
      correlationId: req.requestId,
    });

    res.status(201).json({
      data: comment,
      requestId: req.requestId,
    });
  })
);

/**
 * GET /posts/:postId/comments
 * List comments for a post (must be verified member of post's building)
 */
router.get(
  '/posts/:postId/comments',
  authenticate,
  validateQuery(listCommentsQuerySchema),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { postId } = postIdParamSchema.parse(req.params);
    const query = listCommentsQuerySchema.parse(req.query);

    // First verify post exists and get buildingId
    const post = await getPostById(postId);
    if (!post || post.status !== 'active') {
      res.status(404).json({
        error: {
          message: 'Post not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
        requestId: req.requestId,
      });
      return;
    }

    // Verify caller is verified member of post's building
    const hasMembership = await hasVerifiedMembership(
      req.user!.userId,
      post.buildingId
    );

    if (!hasMembership) {
      res.status(403).json({
        error: {
          message: 'You must be a verified member of this building',
          code: 'FORBIDDEN',
          statusCode: 403,
        },
        requestId: req.requestId,
      });
      return;
    }

    const comments = await getCommentsByPost(postId, {
      limit: query.limit,
      offset: query.offset,
    });

    res.json({
      data: comments,
      requestId: req.requestId,
    });
  })
);

export default router;

