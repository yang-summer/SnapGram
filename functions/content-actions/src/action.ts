import type { FunctionRequest } from './request.js';
import { ContentActionError } from './errors.js';

type HealthcheckActionRequest = {
  action: 'healthcheck';
};

type PostLikeActionRequest = {
  action: 'post.like';
  postId: string;
};

type PostUnlikeActionRequest = {
  action: 'post.unlike';
  postId: string;
};

type PostSaveActionRequest = {
  action: 'post.save';
  postId: string;
};

type PostUnsaveActionRequest = {
  action: 'post.unsave';
  postId: string;
};

type PostDeleteActionRequest = {
  action: 'post.delete';
  postId: string;
};

export type ContentActionRequest =
  | HealthcheckActionRequest
  | PostLikeActionRequest
  | PostUnlikeActionRequest
  | PostSaveActionRequest
  | PostUnsaveActionRequest
  | PostDeleteActionRequest;

function readBodyText(req: FunctionRequest): string {
  return req.bodyText?.trim() ?? '';
}

function readPostId(payload: Record<string, unknown>): string {
  const postId = typeof payload.postId === 'string' ? payload.postId.trim() : '';

  if (!postId) {
    throw new ContentActionError('POST_ID_MISSING', 400, 'Post ID is required.');
  }

  return postId;
}

export function parseContentActionRequest(req: FunctionRequest): ContentActionRequest {
  const bodyText = readBodyText(req);

  if (!bodyText) {
    if (req.method.toUpperCase() === 'GET') {
      return { action: 'healthcheck' };
    }

    throw new ContentActionError(
      'REQUEST_BODY_MISSING',
      400,
      'Request body is required for this action.',
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new ContentActionError('REQUEST_BODY_INVALID', 400, 'Request body must be valid JSON.');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ContentActionError('REQUEST_BODY_INVALID', 400, 'Request body must be a JSON object.');
  }

  const normalizedPayload = payload as Record<string, unknown>;
  const action =
    typeof normalizedPayload.action === 'string' ? normalizedPayload.action.trim() : '';

  switch (action) {
    case 'healthcheck':
      return { action };
    case 'post.like':
    case 'post.unlike':
    case 'post.save':
    case 'post.unsave':
    case 'post.delete':
      return {
        action,
        postId: readPostId(normalizedPayload),
      };
    default:
      throw new ContentActionError('ACTION_INVALID', 400, 'Action is missing or unsupported.', {
        action,
      });
  }
}
