import {
  AppwriteException,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
  type Models,
} from 'node-appwrite';
import type { CurrentUserProfile } from './auth.js';
import type { AppwriteResourceConfig } from './config.js';
import { ContentActionError } from './errors.js';

const LIKE_RECORD_SELECT = ['$id', 'postId', 'userId'];
const POST_EXISTS_SELECT = ['$id'];
const POST_LIKE_COUNT_COLUMN = 'likeCount';
const POST_LIKE_COUNT_STEP = 1;

type ViewerLikeRow = Models.Row & {
  postId: string;
  userId: string;
};

export type LikePostResult = {
  likeRecordId: string;
  postId: string;
  viewerProfileId: string;
};

export type UnlikePostResult = {
  likeRecordId: string | null;
  postId: string;
  viewerProfileId: string;
  deleted: boolean;
};

function buildPrivateOwnerReadPermissions(accountId: string): string[] {
  return [Permission.read(Role.user(accountId))];
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

async function assertPostExists(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  postId: string,
): Promise<void> {
  try {
    await tablesDB.getRow({
      databaseId: config.databaseId,
      tableId: config.postsTableId,
      rowId: postId,
      queries: [Query.select(POST_EXISTS_SELECT)],
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      throw new ContentActionError('POST_NOT_FOUND', 404, 'Post not found.', { postId });
    }

    throw error;
  }
}

async function findViewerLikeRecord(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  viewerProfileId: string,
  postId: string,
): Promise<ViewerLikeRow | null> {
  const result = await tablesDB.listRows<ViewerLikeRow>({
    databaseId: config.databaseId,
    tableId: config.likesTableId,
    queries: [
      Query.select(LIKE_RECORD_SELECT),
      Query.equal('userId', viewerProfileId),
      Query.equal('postId', postId),
      Query.limit(1),
    ],
    total: false,
  });

  return result.rows[0] ?? null;
}

async function getRequiredViewerLikeRecord(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  viewerProfileId: string,
  postId: string,
): Promise<ViewerLikeRow> {
  const existingRecord = await findViewerLikeRecord(tablesDB, config, viewerProfileId, postId);

  if (!existingRecord) {
    throw new ContentActionError(
      'LIKE_RECORD_UNRESOLVED',
      500,
      'The like record already exists, but it could not be loaded.',
      {
        postId,
        viewerProfileId,
      },
    );
  }

  return existingRecord;
}

export async function likePostForCurrentUser(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  profile: CurrentUserProfile,
  postId: string,
): Promise<LikePostResult> {
  await assertPostExists(tablesDB, config, postId);

  try {
    return await runTransaction(tablesDB, async (transactionId) => {
      const createdRecord = await tablesDB.createRow<ViewerLikeRow>({
        databaseId: config.databaseId,
        tableId: config.likesTableId,
        rowId: ID.unique(),
        data: {
          userId: profile.id,
          postId,
        },
        permissions: buildPrivateOwnerReadPermissions(profile.accountId),
        transactionId,
      });

      await tablesDB.incrementRowColumn({
        databaseId: config.databaseId,
        tableId: config.postsTableId,
        rowId: postId,
        column: POST_LIKE_COUNT_COLUMN,
        value: POST_LIKE_COUNT_STEP,
        transactionId,
      });

      return {
        likeRecordId: createdRecord.$id,
        postId: createdRecord.postId,
        viewerProfileId: profile.id,
      };
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      const existingRecord = await getRequiredViewerLikeRecord(tablesDB, config, profile.id, postId);

      return {
        likeRecordId: existingRecord.$id,
        postId: existingRecord.postId,
        viewerProfileId: profile.id,
      };
    }

    if (error instanceof AppwriteException && error.code === 404) {
      throw new ContentActionError('POST_NOT_FOUND', 404, 'Post not found.', { postId });
    }

    throw error;
  }
}

export async function unlikePostForCurrentUser(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  profile: CurrentUserProfile,
  postId: string,
): Promise<UnlikePostResult> {
  await assertPostExists(tablesDB, config, postId);

  const existingRecord = await findViewerLikeRecord(tablesDB, config, profile.id, postId);

  if (!existingRecord) {
    return {
      likeRecordId: null,
      postId,
      viewerProfileId: profile.id,
      deleted: false,
    };
  }

  try {
    return await runTransaction(tablesDB, async (transactionId) => {
      await tablesDB.deleteRow({
        databaseId: config.databaseId,
        tableId: config.likesTableId,
        rowId: existingRecord.$id,
        transactionId,
      });

      await tablesDB.decrementRowColumn({
        databaseId: config.databaseId,
        tableId: config.postsTableId,
        rowId: postId,
        column: POST_LIKE_COUNT_COLUMN,
        value: POST_LIKE_COUNT_STEP,
        min: 0,
        transactionId,
      });

      return {
        likeRecordId: existingRecord.$id,
        postId,
        viewerProfileId: profile.id,
        deleted: true,
      };
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return {
        likeRecordId: existingRecord.$id,
        postId,
        viewerProfileId: profile.id,
        deleted: false,
      };
    }

    throw error;
  }
}
