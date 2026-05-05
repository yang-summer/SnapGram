import { AppwriteException, Query, Storage, type Models, TablesDB } from 'node-appwrite';
import type { PostCreateActionMediaItem } from './action.js';
import type { AppwriteResourceConfig } from './config.js';
import { ContentActionError } from './errors.js';
import { buildPublishedPostMediaFilePermissions, buildStagedPostMediaFilePermissions } from './permissions.js';

export const POST_MEDIA_MIN_ITEMS = 1;
export const POST_MEDIA_MAX_ITEMS = 6;

const POST_MEDIA_LIST_LIMIT = 100;
const POST_MEDIA_SELECT = [
  '$id',
  'postId',
  'fileId',
  'sortOrder',
  'width',
  'height',
  'aspectRatioBucket',
  'placeholder',
] as const;
const DEFAULT_CLEANUP_MAX_ATTEMPTS = 3;
const DEFAULT_CLEANUP_RETRY_DELAY_MS = 250;

export type PostMediaRow = Models.Row & {
  postId: string;
  fileId: string;
  sortOrder: number;
  width?: number | null;
  height?: number | null;
  aspectRatioBucket?: string | null;
  placeholder?: string | null;
};

export type PostDeleteSourceSnapshot = Models.Row & {
  imageId?: string | null;
};

type CleanupMediaFilesOptions = {
  eventPrefix: string;
  maxAttempts?: number;
  retryDelayMs?: number;
};

type PublishMediaFilesOptions = {
  eventPrefix: string;
  maxAttempts?: number;
  retryDelayMs?: number;
};

export type NormalizedPostCreateMediaItem = PostCreateActionMediaItem;

export type PostCoverProjection = {
  imageId: string;
  imageUrl: string;
  aspectRatioBucket: string;
  imagePlaceholder: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  mediaCount: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeFileIds(fileIds: string[]): string[] {
  return Array.from(
    new Set(fileIds.map((fileId) => fileId.trim()).filter((fileId) => fileId.length > 0)),
  );
}

function arePermissionSetsEqual(actualPermissions: string[], expectedPermissions: string[]): boolean {
  if (actualPermissions.length !== expectedPermissions.length) {
    return false;
  }

  const normalizedActualPermissions = [...actualPermissions].sort();
  const normalizedExpectedPermissions = [...expectedPermissions].sort();

  for (let index = 0; index < normalizedActualPermissions.length; index += 1) {
    if (normalizedActualPermissions[index] !== normalizedExpectedPermissions[index]) {
      return false;
    }
  }

  return true;
}

function buildFileViewUrl(
  endpoint: string,
  projectId: string,
  bucketId: string,
  fileId: string,
): string {
  const normalizedEndpoint = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
  const url = new URL(`storage/buckets/${bucketId}/files/${fileId}/view`, normalizedEndpoint);
  url.searchParams.set('project', projectId);
  return url.toString();
}

function assertMediaCount(media: PostCreateActionMediaItem[]): void {
  if (media.length < POST_MEDIA_MIN_ITEMS || media.length > POST_MEDIA_MAX_ITEMS) {
    throw new ContentActionError(
      'MEDIA_COUNT_INVALID',
      400,
      `Post media count must be between ${POST_MEDIA_MIN_ITEMS} and ${POST_MEDIA_MAX_ITEMS}.`,
      {
        mediaCount: media.length,
      },
    );
  }
}

function assertSequentialSortOrders(media: PostCreateActionMediaItem[]): void {
  const sortedMedia = [...media].sort((left, right) => left.sortOrder - right.sortOrder);

  for (let index = 0; index < sortedMedia.length; index += 1) {
    if (sortedMedia[index].sortOrder !== index) {
      throw new ContentActionError(
        'MEDIA_SORT_ORDER_INVALID',
        400,
        'Media sortOrder must be continuous and start at 0.',
        {
          expectedSortOrder: index,
          actualSortOrder: sortedMedia[index].sortOrder,
        },
      );
    }
  }
}

function assertUniqueCreateMediaFileIds(media: PostCreateActionMediaItem[]): void {
  const seenFileIds = new Set<string>();

  for (const mediaItem of media) {
    if (seenFileIds.has(mediaItem.fileId)) {
      throw new ContentActionError(
        'MEDIA_FILE_ID_DUPLICATE',
        400,
        'Media fileId values must be unique.',
        {
          fileId: mediaItem.fileId,
        },
      );
    }

    seenFileIds.add(mediaItem.fileId);
  }
}

export function normalizeCreateMediaPayload(
  media: PostCreateActionMediaItem[],
): NormalizedPostCreateMediaItem[] {
  assertMediaCount(media);
  assertSequentialSortOrders(media);
  assertUniqueCreateMediaFileIds(media);

  return [...media].sort((left, right) => left.sortOrder - right.sortOrder);
}

export async function listPostMediaRowsByPostId(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  postId: string,
): Promise<PostMediaRow[]> {
  if (!postId) {
    throw new Error('Post ID is required to list post media rows.');
  }

  const response = await tablesDB.listRows<PostMediaRow>({
    databaseId: config.databaseId,
    tableId: config.postMediaTableId,
    queries: [
      Query.select([...POST_MEDIA_SELECT]),
      Query.equal('postId', postId),
      Query.orderAsc('sortOrder'),
      Query.limit(POST_MEDIA_LIST_LIMIT),
    ],
    total: false,
  });

  return response.rows;
}

export function resolvePostDeleteFileIds(
  post: PostDeleteSourceSnapshot | null,
  mediaRows: PostMediaRow[],
): string[] {
  const mediaFileIds = normalizeFileIds(
    mediaRows.map((mediaRow) => (typeof mediaRow.fileId === 'string' ? mediaRow.fileId : '')),
  );

  if (mediaFileIds.length > 0) {
    return mediaFileIds;
  }

  const legacyImageId = post?.imageId?.trim() ?? '';

  return legacyImageId ? [legacyImageId] : [];
}

export async function assertOwnedStagedFiles(
  storage: Storage,
  config: AppwriteResourceConfig,
  fileIds: string[],
  accountId: string,
): Promise<Models.File[]> {
  const normalizedFileIds = normalizeFileIds(fileIds);
  const expectedPermissions = buildStagedPostMediaFilePermissions(accountId);
  const files: Models.File[] = [];

  for (const fileId of normalizedFileIds) {
    let file: Models.File;

    try {
      file = await storage.getFile({
        bucketId: config.storageId,
        fileId,
      });
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 404) {
        throw new ContentActionError('MEDIA_FILE_NOT_FOUND', 404, 'Media file not found.', {
          fileId,
        });
      }

      throw error;
    }

    if (!arePermissionSetsEqual(file.$permissions, expectedPermissions)) {
      throw new ContentActionError(
        'MEDIA_FILE_NOT_STAGED',
        403,
        'Media file is not owned by the current account as a staged private upload.',
        {
          fileId,
        },
      );
    }

    files.push(file);
  }

  return files;
}

export function buildPostCoverProjectionFromMedia(
  media: NormalizedPostCreateMediaItem[],
  config: AppwriteResourceConfig,
): PostCoverProjection {
  const firstMediaItem = media[0];

  if (!firstMediaItem) {
    throw new ContentActionError('MEDIA_REQUIRED', 400, 'At least one media item is required.');
  }

  return {
    imageId: firstMediaItem.fileId,
    imageUrl: buildFileViewUrl(
      config.endpoint,
      config.projectId,
      config.storageId,
      firstMediaItem.fileId,
    ),
    aspectRatioBucket: firstMediaItem.aspectRatioBucket,
    imagePlaceholder: firstMediaItem.placeholder,
    imageWidth: firstMediaItem.width,
    imageHeight: firstMediaItem.height,
    mediaCount: media.length,
  };
}

export async function publishMediaFiles(
  storage: Storage,
  config: AppwriteResourceConfig,
  fileIds: string[],
  log: (message: string) => void,
  error: (message: string) => void,
  options: PublishMediaFilesOptions,
): Promise<boolean> {
  const normalizedFileIds = normalizeFileIds(fileIds);
  const maxAttempts = options.maxAttempts ?? DEFAULT_CLEANUP_MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_CLEANUP_RETRY_DELAY_MS;
  const permissions = buildPublishedPostMediaFilePermissions();
  let publicationFailed = false;

  for (const fileId of normalizedFileIds) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await storage.updateFile({
          bucketId: config.storageId,
          fileId,
          permissions,
        });

        break;
      } catch (caughtError) {
        const isLastAttempt = attempt === maxAttempts;
        const message = caughtError instanceof Error ? caughtError.message : String(caughtError);

        if (isLastAttempt) {
          publicationFailed = true;
          error(
            JSON.stringify({
              event: `${options.eventPrefix}.publish-failed`,
              fileId,
              attempt,
              message,
            }),
          );
          break;
        }

        log(
          JSON.stringify({
            event: `${options.eventPrefix}.publish-retry`,
            fileId,
            attempt,
            message,
          }),
        );

        await sleep(retryDelayMs * attempt);
      }
    }
  }

  return publicationFailed;
}

export async function cleanupMediaFiles(
  storage: Storage,
  config: AppwriteResourceConfig,
  fileIds: string[],
  log: (message: string) => void,
  error: (message: string) => void,
  options: CleanupMediaFilesOptions,
): Promise<boolean> {
  const normalizedFileIds = normalizeFileIds(fileIds);
  const maxAttempts = options.maxAttempts ?? DEFAULT_CLEANUP_MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_CLEANUP_RETRY_DELAY_MS;
  let cleanupFailed = false;

  for (const fileId of normalizedFileIds) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await storage.deleteFile({
          bucketId: config.storageId,
          fileId,
        });

        break;
      } catch (caughtError) {
        if (caughtError instanceof AppwriteException && caughtError.code === 404) {
          break;
        }

        const isLastAttempt = attempt === maxAttempts;
        const message = caughtError instanceof Error ? caughtError.message : String(caughtError);

        if (isLastAttempt) {
          cleanupFailed = true;
          error(
            JSON.stringify({
              event: `${options.eventPrefix}.cleanup-failed`,
              fileId,
              attempt,
              message,
            }),
          );
          break;
        }

        log(
          JSON.stringify({
            event: `${options.eventPrefix}.cleanup-retry`,
            fileId,
            attempt,
            message,
          }),
        );

        await sleep(retryDelayMs * attempt);
      }
    }
  }

  return cleanupFailed;
}
