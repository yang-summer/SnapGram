import { ExecutionMethod } from 'appwrite';
import type { Models } from 'appwrite';
import { appwriteConfig, functions } from '~/lib/appwrite/config';
import type {
  CreatePostWithContentActionRequest,
  CreatePostWithContentActionResult,
  DeletePostResult,
  DeleteViewerPostLikeResult,
  DeleteViewerPostSaveResult,
  UpdatePostWithContentActionRequest,
  UpdatePostWithContentActionResult,
  ViewerPostLikeMutationResult,
  ViewerPostSaveMutationResult,
} from '../types/post.type';

type ContentActionHealthcheckRequest = {
  action: 'healthcheck';
};

type ContentActionPostLikeRequest = {
  action: 'post.like';
  postId: string;
};

type ContentActionPostUnlikeRequest = {
  action: 'post.unlike';
  postId: string;
};

type ContentActionPostSaveRequest = {
  action: 'post.save';
  postId: string;
};

type ContentActionPostUnsaveRequest = {
  action: 'post.unsave';
  postId: string;
};

type ContentActionPostDeleteRequest = {
  action: 'post.delete';
  postId: string;
};

type ContentActionRequest =
  | ContentActionHealthcheckRequest
  | ContentActionPostLikeRequest
  | ContentActionPostUnlikeRequest
  | ContentActionPostSaveRequest
  | ContentActionPostUnsaveRequest
  | ContentActionPostDeleteRequest
  | CreatePostWithContentActionRequest
  | UpdatePostWithContentActionRequest;

export type ContentActionExecutionResult = {
  executionId: string;
  status: string;
  statusCode: number;
  responseBodyText: string;
  responseBody: unknown;
};

type ContentActionErrorResponse = {
  ok: false;
  error: {
    message?: string;
  };
};

type ContentActionSuccessResponse<Action extends string, Data> = {
  ok: true;
  action: Action;
  data: Data;
};

function parseExecutionResponseBody(responseBody: string): unknown {
  if (!responseBody.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseBody);
  } catch {
    return responseBody;
  }
}

function mapExecutionResult(execution: Models.Execution): ContentActionExecutionResult {
  return {
    executionId: execution.$id,
    status: execution.status,
    statusCode: execution.responseStatusCode,
    responseBodyText: execution.responseBody,
    responseBody: parseExecutionResponseBody(execution.responseBody),
  };
}

function isContentActionErrorResponse(body: unknown): body is ContentActionErrorResponse {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return false;
  }

  const normalizedBody = body as Record<string, unknown>;

  return (
    normalizedBody.ok === false &&
    !!normalizedBody.error &&
    typeof normalizedBody.error === 'object'
  );
}

function resolveExecutionErrorMessage(result: ContentActionExecutionResult): string | null {
  if (isContentActionErrorResponse(result.responseBody)) {
    return result.responseBody.error.message ?? 'Content action failed.';
  }

  if (result.statusCode >= 400) {
    return `Content action failed with status ${result.statusCode}.`;
  }

  return null;
}

function readExecutionData<Action extends string, Data>(
  result: ContentActionExecutionResult,
  action: Action,
): Data {
  const errorMessage = resolveExecutionErrorMessage(result);

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  const body = result.responseBody;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Content action returned an invalid response body.');
  }

  const normalizedBody = body as Record<string, unknown>;

  if (
    normalizedBody.ok !== true ||
    normalizedBody.action !== action ||
    !('data' in normalizedBody)
  ) {
    throw new Error('Content action returned an unexpected response payload.');
  }

  return (normalizedBody as ContentActionSuccessResponse<Action, Data>).data;
}

async function executeContentAction(
  payload: ContentActionRequest,
): Promise<ContentActionExecutionResult> {
  const execution = await functions.createExecution({
    functionId: appwriteConfig.contentActionsFunctionId,
    body: JSON.stringify(payload),
    async: false,
    xpath: '/',
    method: ExecutionMethod.POST,
    headers: {
      'content-type': 'application/json',
    },
  });

  return mapExecutionResult(execution);
}

export async function runContentActionsHealthcheck(): Promise<ContentActionExecutionResult> {
  return executeContentAction({ action: 'healthcheck' });
}

export async function likePostWithContentAction(
  postId: string,
): Promise<ViewerPostLikeMutationResult> {
  const result = await executeContentAction({
    action: 'post.like',
    postId,
  });

  return readExecutionData(result, 'post.like');
}

export async function unlikePostWithContentAction(
  postId: string,
): Promise<DeleteViewerPostLikeResult> {
  const result = await executeContentAction({
    action: 'post.unlike',
    postId,
  });

  return readExecutionData(result, 'post.unlike');
}

export async function savePostWithContentAction(
  postId: string,
): Promise<ViewerPostSaveMutationResult> {
  const result = await executeContentAction({
    action: 'post.save',
    postId,
  });

  return readExecutionData(result, 'post.save');
}

export async function unsavePostWithContentAction(
  postId: string,
): Promise<DeleteViewerPostSaveResult> {
  const result = await executeContentAction({
    action: 'post.unsave',
    postId,
  });

  return readExecutionData(result, 'post.unsave');
}

export async function deletePostWithContentAction(postId: string): Promise<DeletePostResult> {
  const result = await executeContentAction({
    action: 'post.delete',
    postId,
  });

  return readExecutionData(result, 'post.delete');
}

export async function createPostWithContentAction(
  payload: Omit<CreatePostWithContentActionRequest, 'action'>,
): Promise<CreatePostWithContentActionResult> {
  const result = await executeContentAction({
    action: 'post.create',
    ...payload,
  });

  return readExecutionData(result, 'post.create');
}

export async function updatePostWithContentAction(
  payload: Omit<UpdatePostWithContentActionRequest, 'action'>,
): Promise<UpdatePostWithContentActionResult> {
  const result = await executeContentAction({
    action: 'post.update',
    ...payload,
  });

  return readExecutionData(result, 'post.update');
}
