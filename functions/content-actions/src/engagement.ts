import {
  AppwriteException,
  ID,
  Query,
  TablesDB,
  type Models,
} from 'node-appwrite';
import type { CurrentUserProfile } from './auth.js';
import type { AppwriteResourceConfig } from './config.js';
import { ContentActionError } from './errors.js';
import { buildPrivateOwnerReadPermissions } from './permissions.js';
import { runTransaction } from './transactions.js';

const ENGAGEMENT_RECORD_SELECT = ['$id', 'postId', 'userId'];
const POST_EXISTS_SELECT = ['$id'];
const POST_LIKE_COUNT_COLUMN = 'likeCount';
const POST_LIKE_COUNT_STEP = 1;
const POST_SAVE_COUNT_COLUMN = 'saveCount';
const POST_SAVE_COUNT_STEP = 1;

type ViewerEngagementRow = Models.Row & {
  postId: string;
  userId: string;
};

type EngagementConfig = {
  tableId: 'likesTableId' | 'savesTableId';
  countColumn: string;
  countStep: number;
  recordName: 'like' | 'save';
  unresolvedCode: 'LIKE_RECORD_UNRESOLVED' | 'SAVE_RECORD_UNRESOLVED';
};

type CreateEngagementResult = {
  recordId: string;
  postId: string;
  viewerProfileId: string;
};

type DeleteEngagementResult = {
  recordId: string | null;
  postId: string;
  viewerProfileId: string;
  deleted: boolean;
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

export type SavePostResult = {
  saveRecordId: string;
  postId: string;
  viewerProfileId: string;
};

export type UnsavePostResult = {
  saveRecordId: string | null;
  postId: string;
  viewerProfileId: string;
  deleted: boolean;
};

const LIKE_ENGAGEMENT_CONFIG: EngagementConfig = {
  tableId: 'likesTableId',
  countColumn: POST_LIKE_COUNT_COLUMN,
  countStep: POST_LIKE_COUNT_STEP,
  recordName: 'like',
  unresolvedCode: 'LIKE_RECORD_UNRESOLVED',
};

const SAVE_ENGAGEMENT_CONFIG: EngagementConfig = {
  tableId: 'savesTableId',
  countColumn: POST_SAVE_COUNT_COLUMN,
  countStep: POST_SAVE_COUNT_STEP,
  recordName: 'save',
  unresolvedCode: 'SAVE_RECORD_UNRESOLVED',
};

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

async function findViewerEngagementRecord(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  tableId: EngagementConfig['tableId'],
  viewerProfileId: string,
  postId: string,
): Promise<ViewerEngagementRow | null> {
  const result = await tablesDB.listRows<ViewerEngagementRow>({
    databaseId: config.databaseId,
    tableId: config[tableId],
    queries: [
      Query.select(ENGAGEMENT_RECORD_SELECT),
      Query.equal('userId', viewerProfileId),
      Query.equal('postId', postId),
      Query.limit(1),
    ],
    total: false,
  });

  return result.rows[0] ?? null;
}

async function getRequiredViewerEngagementRecord(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  engagementConfig: EngagementConfig,
  viewerProfileId: string,
  postId: string,
): Promise<ViewerEngagementRow> {
  const existingRecord = await findViewerEngagementRecord(
    tablesDB,
    config,
    engagementConfig.tableId,
    viewerProfileId,
    postId,
  );

  if (!existingRecord) {
    throw new ContentActionError(
      engagementConfig.unresolvedCode,
      500,
      `The ${engagementConfig.recordName} record already exists, but it could not be loaded.`,
      {
        postId,
        viewerProfileId,
      },
    );
  }

  return existingRecord;
}

async function createEngagementForCurrentUser(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  profile: CurrentUserProfile,
  postId: string,
  engagementConfig: EngagementConfig,
): Promise<CreateEngagementResult> {
  await assertPostExists(tablesDB, config, postId);

  try {
    return await runTransaction(tablesDB, async (transactionId) => {
      const createdRecord = await tablesDB.createRow<ViewerEngagementRow>({
        databaseId: config.databaseId,
        tableId: config[engagementConfig.tableId],
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
        column: engagementConfig.countColumn,
        value: engagementConfig.countStep,
        transactionId,
      });

      return {
        recordId: createdRecord.$id,
        postId: createdRecord.postId,
        viewerProfileId: profile.id,
      };
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      const existingRecord = await getRequiredViewerEngagementRecord(
        tablesDB,
        config,
        engagementConfig,
        profile.id,
        postId,
      );

      return {
        recordId: existingRecord.$id,
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

async function deleteEngagementForCurrentUser(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  profile: CurrentUserProfile,
  postId: string,
  engagementConfig: EngagementConfig,
): Promise<DeleteEngagementResult> {
  await assertPostExists(tablesDB, config, postId);

  const existingRecord = await findViewerEngagementRecord(
    tablesDB,
    config,
    engagementConfig.tableId,
    profile.id,
    postId,
  );

  if (!existingRecord) {
    return {
      recordId: null,
      postId,
      viewerProfileId: profile.id,
      deleted: false,
    };
  }

  try {
    return await runTransaction(tablesDB, async (transactionId) => {
      await tablesDB.deleteRow({
        databaseId: config.databaseId,
        tableId: config[engagementConfig.tableId],
        rowId: existingRecord.$id,
        transactionId,
      });

      await tablesDB.decrementRowColumn({
        databaseId: config.databaseId,
        tableId: config.postsTableId,
        rowId: postId,
        column: engagementConfig.countColumn,
        value: engagementConfig.countStep,
        min: 0,
        transactionId,
      });

      return {
        recordId: existingRecord.$id,
        postId,
        viewerProfileId: profile.id,
        deleted: true,
      };
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return {
        recordId: existingRecord.$id,
        postId,
        viewerProfileId: profile.id,
        deleted: false,
      };
    }

    throw error;
  }
}

export async function likePostForCurrentUser(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  profile: CurrentUserProfile,
  postId: string,
): Promise<LikePostResult> {
  const result = await createEngagementForCurrentUser(
    tablesDB,
    config,
    profile,
    postId,
    LIKE_ENGAGEMENT_CONFIG,
  );

  return {
    likeRecordId: result.recordId,
    postId: result.postId,
    viewerProfileId: result.viewerProfileId,
  };
}

export async function unlikePostForCurrentUser(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  profile: CurrentUserProfile,
  postId: string,
): Promise<UnlikePostResult> {
  const result = await deleteEngagementForCurrentUser(
    tablesDB,
    config,
    profile,
    postId,
    LIKE_ENGAGEMENT_CONFIG,
  );

  return {
    likeRecordId: result.recordId,
    postId: result.postId,
    viewerProfileId: result.viewerProfileId,
    deleted: result.deleted,
  };
}

export async function savePostForCurrentUser(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  profile: CurrentUserProfile,
  postId: string,
): Promise<SavePostResult> {
  const result = await createEngagementForCurrentUser(
    tablesDB,
    config,
    profile,
    postId,
    SAVE_ENGAGEMENT_CONFIG,
  );

  return {
    saveRecordId: result.recordId,
    postId: result.postId,
    viewerProfileId: result.viewerProfileId,
  };
}

export async function unsavePostForCurrentUser(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  profile: CurrentUserProfile,
  postId: string,
): Promise<UnsavePostResult> {
  const result = await deleteEngagementForCurrentUser(
    tablesDB,
    config,
    profile,
    postId,
    SAVE_ENGAGEMENT_CONFIG,
  );

  return {
    saveRecordId: result.recordId,
    postId: result.postId,
    viewerProfileId: result.viewerProfileId,
    deleted: result.deleted,
  };
}
