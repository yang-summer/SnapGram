import { AppwriteException, Query, Storage, TablesDB, type Models } from 'node-appwrite';
import type { AppwriteResourceConfig } from './config.js';

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
