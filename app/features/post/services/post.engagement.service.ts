import {
  createViewerSaveRecord,
  deleteViewerSaveRecord,
  listViewerSaveRecords,
  updatePostLikesRow,
} from '../api/post.engagement.api';
import type {
  CreateViewerPostSaveInput,
  DeleteViewerPostSaveInput,
  DeleteViewerPostSaveResult,
  PostLikeMutationResult,
  RawViewerSaveRecord,
  UpdatePostLikesInput,
  ViewerPostSaveMutationResult,
  ViewerSavedPostRecord,
  ViewerSavedPostsResult,
} from '../types/post.type';

function resolveSavedPostId(record: RawViewerSaveRecord): string | null {
  if (typeof record.post === 'string') {
    return record.post;
  }

  return record.post?.$id ?? null;
}

function mapViewerSaveRecord(record: RawViewerSaveRecord): ViewerSavedPostRecord | null {
  const postId = resolveSavedPostId(record);

  if (!postId) {
    return null;
  }

  return {
    saveRecordId: record.$id,
    postId,
  };
}

function createEmptyViewerSavedPostsResult(): ViewerSavedPostsResult {
  return {
    records: [],
    postIds: [],
  };
}

function mapViewerSaveRecords(records: RawViewerSaveRecord[]): ViewerSavedPostsResult {
  if (records.length === 0) {
    return createEmptyViewerSavedPostsResult();
  }

  const mappedRecords: ViewerSavedPostRecord[] = [];
  const postIds = new Set<string>();

  for (let index = 0; index < records.length; index += 1) {
    const mappedRecord = mapViewerSaveRecord(records[index]);

    if (!mappedRecord) {
      continue;
    }

    mappedRecords.push(mappedRecord);
    postIds.add(mappedRecord.postId);
  }

  return {
    records: mappedRecords,
    postIds: Array.from(postIds),
  };
}

export async function getViewerSavedPosts(viewerId: string): Promise<ViewerSavedPostsResult> {
  if (!viewerId) {
    return createEmptyViewerSavedPostsResult();
  }

  try {
    const records = await listViewerSaveRecords(viewerId);
    return mapViewerSaveRecords(records);
  } catch (error) {
    console.error('[PostEngagementService.getViewerSavedPosts] Error:', error);
    throw error;
  }
}

export async function updatePostLikes(
  input: UpdatePostLikesInput,
): Promise<PostLikeMutationResult> {
  try {
    const updatedRow = await updatePostLikesRow(input);

    return {
      postId: updatedRow.$id,
      likes: input.likes,
    };
  } catch (error) {
    console.error('[PostEngagementService.updatePostLikes] Error:', error);
    throw error;
  }
}

export async function savePostForViewer(
  input: CreateViewerPostSaveInput,
): Promise<ViewerPostSaveMutationResult> {
  try {
    const createdRecord = await createViewerSaveRecord(input);

    return {
      saveRecordId: createdRecord.$id,
      postId: resolveSavedPostId(createdRecord) ?? input.postId,
      viewerId: input.viewerId,
    };
  } catch (error) {
    console.error('[PostEngagementService.savePostForViewer] Error:', error);
    throw error;
  }
}

export async function deleteViewerPostSave(
  input: DeleteViewerPostSaveInput,
): Promise<DeleteViewerPostSaveResult> {
  try {
    return await deleteViewerSaveRecord(input.saveRecordId);
  } catch (error) {
    console.error('[PostEngagementService.deleteViewerPostSave] Error:', error);
    throw error;
  }
}
