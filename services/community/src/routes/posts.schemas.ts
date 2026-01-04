import { z } from 'zod';

export const buildingIdParamSchema = z.object({
  buildingId: z.string().uuid(),
});

export const postIdParamSchema = z.object({
  postId: z.string().uuid(),
});

export const createPostSchema = z.object({
  title: z.string().max(120).optional(),
  content: z.string().min(1).max(10000),
});

export const listPostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const listCommentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

