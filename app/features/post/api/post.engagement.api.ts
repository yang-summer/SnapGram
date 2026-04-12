import { AppwriteException, Query } from 'appwrite';
import { appwriteConfig, tablesDB } from '~/lib/appwrite/config';
import type {
  CreateViewerPostLikeInput,
  CreateViewerPostSaveInput,
  DeleteViewerPostLikeInput,
  DeleteViewerPostLikeResult,
  DeleteViewerPostSaveInput,
  DeleteViewerPostSaveResult,
  RawViewerLikeRecord,
  RawViewerSaveRecord,
  ViewerPostLikeMutationResult,
} from '../types/post.type';

const VIEWER_LIKE_RECORD_SELECT = ['$id', 'postId'];
const VIEWER_LIKE_RECORD_LIMIT = 100;
const VIEWER_SAVE_RECORD_SELECT = ['$id', 'postId', 'userId', 'post.$id'];
const VIEWER_SAVE_RECORD_LIMIT = 100;
const POST_LIKE_COUNT_COLUMN = 'likeCount';
const POST_LIKE_COUNT_STEP = 1;
const POST_SAVE_COUNT_COLUMN = 'saveCount';
const POST_SAVE_COUNT_STEP = 1;

function createDeterministicEngagementRowId(
  kind: 'like' | 'save',
  viewerId: string,
  postId: string,
): string {
  const source = `${viewerId}:${postId}`;
  let forward = 2166136261;
  let backward = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    forward ^= source.charCodeAt(index);
    forward = Math.imul(forward, 16777619);

    const reverseIndex = source.length - 1 - index;
    backward ^= source.charCodeAt(reverseIndex);
    backward = Math.imul(backward, 16777619);
  }

  const forwardHash = (forward >>> 0).toString(36).padStart(7, '0');
  const backwardHash = (backward >>> 0).toString(36).padStart(7, '0');

  return `${kind}_${forwardHash}${backwardHash}`.slice(0, 36);
}

function createDeterministicLikeRowId(viewerId: string, postId: string): string {
  return createDeterministicEngagementRowId('like', viewerId, postId);
}

function createDeterministicSaveRowId(viewerId: string, postId: string): string {
  return createDeterministicEngagementRowId('save', viewerId, postId);
}

function createSyntheticViewerSaveRecord(
  saveRecordId: string,
  input: CreateViewerPostSaveInput,
): RawViewerSaveRecord {
  return {
    $id: saveRecordId,
    postId: input.postId,
    userId: input.viewerId,
    post: input.postId,
    user: input.viewerId,
  } as RawViewerSaveRecord;
}

export async function listViewerLikeRecords(viewerId: string): Promise<RawViewerLikeRecord[]> {
  if (!viewerId) {
    return [];
  }

  try {
    const result = await tablesDB.listRows<RawViewerLikeRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.likesTableId,
      queries: [
        Query.select(VIEWER_LIKE_RECORD_SELECT),
        Query.equal('userId', viewerId),
        Query.limit(VIEWER_LIKE_RECORD_LIMIT),
      ],
      total: false,
    });

    return result.rows;
  } catch (error) {
    console.error(
      '[PostEngagementApi.listViewerLikeRecords] Failed to load viewer like records.',
      error,
    );
    throw error;
  }
}

export async function listViewerSaveRecords(viewerId: string): Promise<RawViewerSaveRecord[]> {
  if (!viewerId) {
    return [];
  }

  try {
    const result = await tablesDB.listRows<RawViewerSaveRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.saveTableId,
      queries: [
        Query.select(VIEWER_SAVE_RECORD_SELECT),
        Query.equal('userId', viewerId),
        Query.limit(VIEWER_SAVE_RECORD_LIMIT),
      ],
      total: false,
    });

    return result.rows;
  } catch (error) {
    console.error(
      '[PostEngagementApi.listViewerSaveRecords] Failed to load viewer save records.',
      error,
    );
    throw error;
  }
}

export async function createViewerLikeRecord(
  input: CreateViewerPostLikeInput,
): Promise<ViewerPostLikeMutationResult> {
  if (!input.viewerId) {
    throw new Error('Viewer ID is required to like a post.');
  }

  if (!input.postId) {
    throw new Error('Post ID is required to like a post.');
  }

  const likeRecordId = createDeterministicLikeRowId(input.viewerId, input.postId);

  try {
    await tablesDB.createRow<RawViewerLikeRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.likesTableId,
      rowId: likeRecordId,
      data: {
        userId: input.viewerId,
        postId: input.postId,
      },
    });

    await tablesDB.incrementRowColumn({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: input.postId,
      column: POST_LIKE_COUNT_COLUMN,
      value: POST_LIKE_COUNT_STEP,
    });

    return {
      likeRecordId,
      postId: input.postId,
      viewerId: input.viewerId,
    };
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      return {
        likeRecordId,
        postId: input.postId,
        viewerId: input.viewerId,
      };
    }

    console.error('[PostEngagementApi.createViewerLikeRecord] Failed to create a like record.', error);
    throw error;
  }
}

export async function createViewerSaveRecord(
  input: CreateViewerPostSaveInput,
): Promise<RawViewerSaveRecord> {
  if (!input.viewerId) {
    throw new Error('Viewer ID is required to save a post.');
  }

  if (!input.postId) {
    throw new Error('Post ID is required to save a post.');
  }

  const saveRecordId = createDeterministicSaveRowId(input.viewerId, input.postId);

  try {
    const createdRecord = await tablesDB.createRow<RawViewerSaveRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.saveTableId,
      rowId: saveRecordId,
      data: {
        user: input.viewerId,
        post: input.postId,
        userId: input.viewerId,
        postId: input.postId,
      },
    });

    await tablesDB.incrementRowColumn({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: input.postId,
      column: POST_SAVE_COUNT_COLUMN,
      value: POST_SAVE_COUNT_STEP,
    });

    return createdRecord;
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      return createSyntheticViewerSaveRecord(saveRecordId, input);
    }

    console.error(
      '[PostEngagementApi.createViewerSaveRecord] Failed to create a viewer save record.',
      error,
    );
    throw error;
  }
}

export async function deleteViewerLikeRecord(
  input: DeleteViewerPostLikeInput,
): Promise<DeleteViewerPostLikeResult> {
  if (!input.likeRecordId) {
    throw new Error('Like record ID is required to delete a liked post.');
  }

  if (!input.postId) {
    throw new Error('Post ID is required to delete a liked post.');
  }

  try {
    await tablesDB.deleteRow({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.likesTableId,
      rowId: input.likeRecordId,
    });

    await tablesDB.decrementRowColumn({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: input.postId,
      column: POST_LIKE_COUNT_COLUMN,
      value: POST_LIKE_COUNT_STEP,
      min: 0,
    });

    return {
      likeRecordId: input.likeRecordId,
    };
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return {
        likeRecordId: input.likeRecordId,
      };
    }

    console.error('[PostEngagementApi.deleteViewerLikeRecord] Failed to delete a like record.', error);
    throw error;
  }
}

export async function deleteViewerSaveRecord(
  input: DeleteViewerPostSaveInput,
): Promise<DeleteViewerPostSaveResult> {
  const saveRecordIds = Array.from(
    new Set(input.saveRecordIds.filter((saveRecordId) => saveRecordId.trim().length > 0)),
  );

  if (saveRecordIds.length === 0) {
    throw new Error('At least one save record ID is required to delete a saved post.');
  }

  if (!input.postId) {
    throw new Error('Post ID is required to delete a saved post.');
  }

  try {
    let deletedCount = 0;

    for (let index = 0; index < saveRecordIds.length; index += 1) {
      try {
        await tablesDB.deleteRow({
          databaseId: appwriteConfig.databaseId,
          tableId: appwriteConfig.saveTableId,
          rowId: saveRecordIds[index],
        });

        deletedCount += 1;
      } catch (error) {
        if (error instanceof AppwriteException && error.code === 404) {
          continue;
        }

        throw error;
      }
    }

    if (deletedCount > 0) {
      await tablesDB.decrementRowColumn({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.postsTableId,
        rowId: input.postId,
        column: POST_SAVE_COUNT_COLUMN,
        value: POST_SAVE_COUNT_STEP,
        min: 0,
      });
    }

    return {
      saveRecordIds,
    };
  } catch (error) {
    console.error(
      '[PostEngagementApi.deleteViewerSaveRecord] Failed to delete a viewer save record.',
      error,
    );
    throw error;
  }
}
