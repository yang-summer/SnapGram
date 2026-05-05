import { AppwriteException, Query, Storage, TablesDB, type Models } from 'node-appwrite';
import type { CurrentUserProfile } from './auth.js';
import type { AppwriteResourceConfig } from './config.js';
import { ContentActionError } from './errors.js';
import {
  cleanupMediaFiles,
  listPostMediaRowsByPostId,
  resolvePostDeleteFileIds,
  type PostMediaRow,
  type PostDeleteSourceSnapshot,
} from './post-media.js';
import { runTransaction } from './transactions.js';

const POST_DELETE_SELECT = ['$id', 'imageId', 'creator.$id'];

type PostDeleteSnapshot = PostDeleteSourceSnapshot & {
  imageId?: string | null;
  creator?: string | (Models.Row & { $id: string }) | null;
};

export type DeletePostResult = {
  postId: string;
  mediaCleanupFailed: boolean;
};

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
  mediaRows: PostMediaRow[],
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

    if (mediaRows.length > 0) {
      await tablesDB.deleteRows({
        databaseId: config.databaseId,
        tableId: config.postMediaTableId,
        queries: [Query.equal('postId', postId)],
        transactionId,
      });
    }

    await tablesDB.deleteRow({
      databaseId: config.databaseId,
      tableId: config.postsTableId,
      rowId: postId,
      transactionId,
    });
  });
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
      mediaCleanupFailed: false,
    };
  }

  assertCanDeletePost(post, profile);
  const mediaRows = await listPostMediaRowsByPostId(tablesDB, config, postId);
  const fileIds = resolvePostDeleteFileIds(post, mediaRows);

  try {
    await deletePostData(tablesDB, config, postId, mediaRows);
  } catch (caughtError) {
    if (caughtError instanceof AppwriteException && caughtError.code === 404) {
      return {
        postId,
        mediaCleanupFailed: false,
      };
    }

    throw caughtError;
  }

  const mediaCleanupFailed = await cleanupMediaFiles(
    storage,
    config,
    fileIds,
    log,
    error,
    {
      eventPrefix: 'content-actions.post-delete',
    },
  );

  return {
    postId,
    mediaCleanupFailed,
  };
}
