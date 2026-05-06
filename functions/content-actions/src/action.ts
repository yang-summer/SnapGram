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

type PostAspectRatioBucket = '1:1' | '3:4' | '4:3';

export type PostCreateActionMediaItem = {
  fileId: string;
  sortOrder: number;
  width: number | null;
  height: number | null;
  aspectRatioBucket: PostAspectRatioBucket;
  placeholder: string | null;
};

export type PostCreateActionRequest = {
  action: 'post.create';
  caption: string;
  location: string;
  tags: string[];
  media: PostCreateActionMediaItem[];
};

export type ExistingPostUpdateActionMediaItem = {
  type: 'existing';
  mediaId: string;
  sortOrder: number;
};

export type NewPostUpdateActionMediaItem = {
  type: 'new';
  fileId: string;
  sortOrder: number;
  width: number | null;
  height: number | null;
  aspectRatioBucket: PostAspectRatioBucket;
  placeholder: string | null;
};

export type PostUpdateActionMediaItem =
  | ExistingPostUpdateActionMediaItem
  | NewPostUpdateActionMediaItem;

export type PostUpdateActionRequest = {
  action: 'post.update';
  postId: string;
  caption: string;
  location: string;
  tags: string[];
  media: PostUpdateActionMediaItem[];
};

export type ContentActionRequest =
  | HealthcheckActionRequest
  | PostLikeActionRequest
  | PostUnlikeActionRequest
  | PostSaveActionRequest
  | PostUnsaveActionRequest
  | PostDeleteActionRequest
  | PostCreateActionRequest
  | PostUpdateActionRequest;

const POST_ASPECT_RATIO_BUCKETS = ['1:1', '3:4', '4:3'] as const;

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

function readRequiredString(
  payload: Record<string, unknown>,
  key: string,
  code: string,
  message: string,
): string {
  const value = payload[key];

  if (typeof value !== 'string') {
    throw new ContentActionError(code, 400, message);
  }

  return value.trim();
}

function readRequiredNonEmptyString(
  payload: Record<string, unknown>,
  key: string,
  code: string,
  message: string,
): string {
  const value = readRequiredString(payload, key, code, message);

  if (!value) {
    throw new ContentActionError(code, 400, message);
  }

  return value;
}

function readTags(payload: Record<string, unknown>): string[] {
  const tags = payload.tags;

  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string')) {
    throw new ContentActionError('TAGS_INVALID', 400, 'Tags must be an array of strings.');
  }

  return tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
}

function readMedia(payload: Record<string, unknown>): Record<string, unknown>[] {
  const media = payload.media;

  if (!Array.isArray(media)) {
    throw new ContentActionError('MEDIA_INVALID', 400, 'Media must be an array.');
  }

  if (media.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new ContentActionError('MEDIA_INVALID', 400, 'Each media item must be a JSON object.');
  }

  return media as Record<string, unknown>[];
}

function readSortOrder(payload: Record<string, unknown>): number {
  const sortOrder = payload.sortOrder;

  if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder)) {
    throw new ContentActionError(
      'MEDIA_SORT_ORDER_INVALID',
      400,
      'Media sortOrder must be an integer.',
    );
  }

  return sortOrder;
}

function readOptionalNullableInteger(
  payload: Record<string, unknown>,
  key: string,
  code: string,
  message: string,
): number | null {
  const value = payload[key];

  if (value == null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ContentActionError(code, 400, message);
  }

  return value;
}

function readOptionalNullableString(
  payload: Record<string, unknown>,
  key: string,
  code: string,
  message: string,
): string | null {
  const value = payload[key];

  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ContentActionError(code, 400, message);
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function readAspectRatioBucket(payload: Record<string, unknown>): PostAspectRatioBucket {
  const aspectRatioBucket = payload.aspectRatioBucket;

  if (
    typeof aspectRatioBucket !== 'string' ||
    !(POST_ASPECT_RATIO_BUCKETS as readonly string[]).includes(aspectRatioBucket)
  ) {
    throw new ContentActionError(
      'MEDIA_ASPECT_RATIO_BUCKET_INVALID',
      400,
      'Media aspectRatioBucket is invalid.',
    );
  }

  return aspectRatioBucket as PostAspectRatioBucket;
}

function readCreateMediaItem(payload: Record<string, unknown>): PostCreateActionMediaItem {
  return {
    fileId: readRequiredNonEmptyString(
      payload,
      'fileId',
      'MEDIA_FILE_ID_MISSING',
      'Media fileId is required.',
    ),
    sortOrder: readSortOrder(payload),
    width: readOptionalNullableInteger(
      payload,
      'width',
      'MEDIA_WIDTH_INVALID',
      'Media width must be an integer or null.',
    ),
    height: readOptionalNullableInteger(
      payload,
      'height',
      'MEDIA_HEIGHT_INVALID',
      'Media height must be an integer or null.',
    ),
    aspectRatioBucket: readAspectRatioBucket(payload),
    placeholder: readOptionalNullableString(
      payload,
      'placeholder',
      'MEDIA_PLACEHOLDER_INVALID',
      'Media placeholder must be a string or null.',
    ),
  };
}

function readCreateMedia(payload: Record<string, unknown>): PostCreateActionMediaItem[] {
  return readMedia(payload).map(readCreateMediaItem);
}

function readUpdateMediaItem(payload: Record<string, unknown>): PostUpdateActionMediaItem {
  const type = readRequiredNonEmptyString(
    payload,
    'type',
    'MEDIA_TYPE_INVALID',
    'Media type is required.',
  );

  switch (type) {
    case 'existing':
      return {
        type,
        mediaId: readRequiredNonEmptyString(
          payload,
          'mediaId',
          'MEDIA_ID_MISSING',
          'Existing mediaId is required.',
        ),
        sortOrder: readSortOrder(payload),
      };
    case 'new':
      return {
        type,
        fileId: readRequiredNonEmptyString(
          payload,
          'fileId',
          'MEDIA_FILE_ID_MISSING',
          'New media fileId is required.',
        ),
        sortOrder: readSortOrder(payload),
        width: readOptionalNullableInteger(
          payload,
          'width',
          'MEDIA_WIDTH_INVALID',
          'Media width must be an integer or null.',
        ),
        height: readOptionalNullableInteger(
          payload,
          'height',
          'MEDIA_HEIGHT_INVALID',
          'Media height must be an integer or null.',
        ),
        aspectRatioBucket: readAspectRatioBucket(payload),
        placeholder: readOptionalNullableString(
          payload,
          'placeholder',
          'MEDIA_PLACEHOLDER_INVALID',
          'Media placeholder must be a string or null.',
        ),
      };
    default:
      throw new ContentActionError(
        'MEDIA_TYPE_INVALID',
        400,
        'Media type must be either existing or new.',
      );
  }
}

function readUpdateMedia(payload: Record<string, unknown>): PostUpdateActionMediaItem[] {
  return readMedia(payload).map(readUpdateMediaItem);
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
    case 'post.create':
      return {
        action,
        caption: readRequiredString(
          normalizedPayload,
          'caption',
          'CAPTION_INVALID',
          'Caption must be a string.',
        ),
        location: readRequiredString(
          normalizedPayload,
          'location',
          'LOCATION_INVALID',
          'Location must be a string.',
        ),
        tags: readTags(normalizedPayload),
        media: readCreateMedia(normalizedPayload),
      };
    case 'post.update':
      return {
        action,
        postId: readPostId(normalizedPayload),
        caption: readRequiredString(
          normalizedPayload,
          'caption',
          'CAPTION_INVALID',
          'Caption must be a string.',
        ),
        location: readRequiredString(
          normalizedPayload,
          'location',
          'LOCATION_INVALID',
          'Location must be a string.',
        ),
        tags: readTags(normalizedPayload),
        media: readUpdateMedia(normalizedPayload),
      };
    default:
      throw new ContentActionError('ACTION_INVALID', 400, 'Action is missing or unsupported.', {
        action,
      });
  }
}
