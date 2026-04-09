import { ID, Query } from 'appwrite';
import { appwriteConfig, tablesDB } from '~/lib/appwrite/config';
import type {
  CreateViewerPostSaveInput,
  DeleteViewerPostSaveResult,
  RawPostLikeMutationRow,
  RawViewerSaveRecord,
  UpdatePostLikesInput,
} from '../types/post.type';

const VIEWER_SAVE_RECORD_SELECT = ['$id', 'post.$id', 'user'];
const VIEWER_SAVE_RECORD_LIMIT = 100;

export async function updatePostLikesRow(
  input: UpdatePostLikesInput,
): Promise<RawPostLikeMutationRow> {
  if (!input.postId) {
    throw new Error('Post ID is required to update post likes.');
  }

  try {
    return await tablesDB.updateRow<RawPostLikeMutationRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: input.postId,
      data: {
        likes: input.likes,
      },
    });
  } catch (error) {
    console.error('[PostEngagementApi.updatePostLikesRow] Failed to update post likes.', error);
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
        Query.equal('user', viewerId),
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

export async function createViewerSaveRecord(
  input: CreateViewerPostSaveInput,
): Promise<RawViewerSaveRecord> {
  if (!input.viewerId) {
    throw new Error('Viewer ID is required to save a post.');
  }

  if (!input.postId) {
    throw new Error('Post ID is required to save a post.');
  }

  try {
    return await tablesDB.createRow<RawViewerSaveRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.saveTableId,
      rowId: ID.unique(),
      data: {
        user: input.viewerId,
        post: input.postId,
      },
    });
  } catch (error) {
    console.error(
      '[PostEngagementApi.createViewerSaveRecord] Failed to create a viewer save record.',
      error,
    );
    throw error;
  }
}

export async function deleteViewerSaveRecord(
  saveRecordId: string,
): Promise<DeleteViewerPostSaveResult> {
  if (!saveRecordId) {
    throw new Error('Save record ID is required to delete a saved post.');
  }

  try {
    await tablesDB.deleteRow({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.saveTableId,
      rowId: saveRecordId,
    });

    return {
      saveRecordId,
    };
  } catch (error) {
    console.error(
      '[PostEngagementApi.deleteViewerSaveRecord] Failed to delete a viewer save record.',
      error,
    );
    throw error;
  }
}
