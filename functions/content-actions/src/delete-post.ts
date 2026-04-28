import { AppwriteException, Query, Storage, TablesDB, type Models } from 'node-appwrite';
import type { CurrentUserProfile } from './auth.js';
import type { AppwriteResourceConfig } from './config.js';
import { ContentActionError } from './errors.js';

const POST_DELETE_SELECT = ['$id', 'imageId', 'creator.$id'];
const DELETE_MEDIA_MAX_ATTEMPTS = 3;
const DELETE_MEDIA_RETRY_DELAY_MS = 250;

type PostDeleteSnapshot = Models.Row & {
  imageId?: string | null;
  creator?: string | (Models.Row & { $id: string }) | null;
};

export type DeletePostResult = {
  postId: string;
  imageCleanupFailed: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveCreatorProfileId(post: PostDeleteSnapshot): string | null {
  if (typeof post.creator === 'string') {
    const creatorProfileId = post.creator.trim();
    return creatorProfileId.length > 0 ? creatorProfileId : null;
  }

  if (post.creator && typeof post.creator.$id === 'string') {
    const creatorProfileId = post.creator.$id.trim();
    return creatorProfileId.length > 0 ? creatorProfileId : null;
  }

  return null;
}

async function runTransaction<T>(
  tablesDB: TablesDB,
  run: (transactionId: string) => Promise<T>,
): Promise<T> {
  const transaction = await tablesDB.createTransaction();
  let shouldRollback = true;

  try {
    const result = await run(transaction.$id);
    await tablesDB.updateTransaction({
      transactionId: transaction.$id,
      commit: true,
    });
    shouldRollback = false;

    return result;
  } catch (error) {
    if (shouldRollback) {
      try {
        await tablesDB.updateTransaction({
          transactionId: transaction.$id,
          rollback: true,
        });
      } catch {
        // Ignore rollback failures and preserve the original error.
      }
    }

    throw error;
  }
}

async function getPostDeleteSnapshot(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  postId: string,
): Promise<PostDeleteSnapshot | null> {
  try {
    return await tablesDB.getRow<PostDeleteSnapshot>({
      databaseId: config.databaseId,
      tableId: config.postsTableId,
      rowId: postId,
      queries: [Query.select(POST_DELETE_SELECT)],
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return null;
    }

    throw error;
  }
}

function assertCanDeletePost(post: PostDeleteSnapshot, profile: CurrentUserProfile): void {
  const creatorProfileId = resolveCreatorProfileId(post);

  if (!creatorProfileId || creatorProfileId !== profile.id) {
    throw new ContentActionError(
      'POST_DELETE_FORBIDDEN',
      403,
      'You do not have permission to delete this post.',
      {
        postId: post.$id,
        viewerProfileId: profile.id,
        creatorProfileId,
      },
    );
  }
}

async function deletePostData(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  postId: string,
): Promise<void> {
  await runTransaction(tablesDB, async (transactionId) => {
    await tablesDB.deleteRows({
      databaseId: config.databaseId,
      tableId: config.likesTableId,
      queries: [Query.equal('postId', postId)],
      transactionId,
    });

    await tablesDB.deleteRows({
      databaseId: config.databaseId,
      tableId: config.savesTableId,
      queries: [Query.equal('postId', postId)],
      transactionId,
    });

    await tablesDB.deleteRow({
      databaseId: config.databaseId,
      tableId: config.postsTableId,
      rowId: postId,
      transactionId,
    });
  });
}

async function cleanupPostMedia(
  storage: Storage,
  config: AppwriteResourceConfig,
  post: PostDeleteSnapshot,
  log: (message: string) => void,
  error: (message: string) => void,
): Promise<boolean> {
  const fileId = post.imageId?.trim() ?? '';

  if (!fileId) {
    return false;
  }

  for (let attempt = 1; attempt <= DELETE_MEDIA_MAX_ATTEMPTS; attempt += 1) {
    try {
      await storage.deleteFile({
        bucketId: config.storageId,
        fileId,
      });

      return false;
    } catch (caughtError) {
      if (caughtError instanceof AppwriteException && caughtError.code === 404) {
        return false;
      }

      const isLastAttempt = attempt === DELETE_MEDIA_MAX_ATTEMPTS;
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);

      if (isLastAttempt) {
        error(
          JSON.stringify({
            event: 'content-actions.post-delete.image-cleanup-failed',
            postId: post.$id,
            fileId,
            attempt,
            message,
          }),
        );

        return true;
      }

      log(
        JSON.stringify({
          event: 'content-actions.post-delete.image-cleanup-retry',
          postId: post.$id,
          fileId,
          attempt,
          message,
        }),
      );

      await sleep(DELETE_MEDIA_RETRY_DELAY_MS * attempt);
    }
  }

  return true;
}

export async function deletePostForCurrentUser(
  tablesDB: TablesDB,
  storage: Storage,
  config: AppwriteResourceConfig,
  profile: CurrentUserProfile,
  postId: string,
  log: (message: string) => void,
  error: (message: string) => void,
): Promise<DeletePostResult> {
  const post = await getPostDeleteSnapshot(tablesDB, config, postId);

  if (!post) {
    return {
      postId,
      imageCleanupFailed: false,
    };
  }

  assertCanDeletePost(post, profile);

  try {
    await deletePostData(tablesDB, config, postId);
  } catch (caughtError) {
    if (caughtError instanceof AppwriteException && caughtError.code === 404) {
      return {
        postId,
        imageCleanupFailed: false,
      };
    }

    throw caughtError;
  }

  const imageCleanupFailed = await cleanupPostMedia(storage, config, post, log, error);

  return {
    postId,
    imageCleanupFailed,
  };
}
