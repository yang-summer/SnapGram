import {
  createViewerLikeRecord,
  createViewerSaveRecord,
  deleteViewerLikeRecord,
  deleteViewerSaveRecord,
  listViewerLikeRecords,
  listViewerSaveRecords,
} from '../api/post.engagement.api';
import type {
  CreateViewerPostLikeInput,
  CreateViewerPostSaveInput,
  DeleteViewerPostLikeInput,
  DeleteViewerPostLikeResult,
  DeleteViewerPostSaveInput,
  DeleteViewerPostSaveResult,
  RawViewerLikeRecord,
  RawViewerSaveRecord,
  ViewerLikedPostRecord,
  ViewerLikedPostsResult,
  ViewerPostLikeMutationResult,
  ViewerPostSaveMutationResult,
  ViewerSavedPostRecord,
  ViewerSavedPostsResult,
} from '../types/post.type';

function mapViewerLikeRecord(record: RawViewerLikeRecord): ViewerLikedPostRecord | null {
  if (!record.postId) {
    return null;
  }

  return {
    likeRecordId: record.$id,
    postId: record.postId,
  };
}

function createEmptyViewerLikedPostsResult(): ViewerLikedPostsResult {
  return {
    records: [],
    postIds: [],
  };
}

function mapViewerLikeRecords(records: RawViewerLikeRecord[]): ViewerLikedPostsResult {
  if (records.length === 0) {
    return createEmptyViewerLikedPostsResult();
  }

  const mappedRecords: ViewerLikedPostRecord[] = [];
  const postIds = new Set<string>();

  for (let index = 0; index < records.length; index += 1) {
    const mappedRecord = mapViewerLikeRecord(records[index]);

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

function resolveSavedPostId(record: RawViewerSaveRecord): string | null {
  if (typeof record.postId === 'string' && record.postId.trim().length > 0) {
    return record.postId;
  }

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
    recordIdsByPostId: {},
  };
}

function mapViewerSaveRecords(records: RawViewerSaveRecord[]): ViewerSavedPostsResult {
  if (records.length === 0) {
    return createEmptyViewerSavedPostsResult();
  }

  const mappedRecords: ViewerSavedPostRecord[] = [];
  const postIds = new Set<string>();
  const recordIdsByPostId: Record<string, string[]> = {};

  for (let index = 0; index < records.length; index += 1) {
    const mappedRecord = mapViewerSaveRecord(records[index]);

    if (!mappedRecord) {
      continue;
    }

    mappedRecords.push(mappedRecord);
    postIds.add(mappedRecord.postId);

    const existingRecordIds = recordIdsByPostId[mappedRecord.postId];
    if (existingRecordIds) {
      existingRecordIds.push(mappedRecord.saveRecordId);
    } else {
      recordIdsByPostId[mappedRecord.postId] = [mappedRecord.saveRecordId];
    }
  }

  return {
    records: mappedRecords,
    postIds: Array.from(postIds),
    recordIdsByPostId,
  };
}

export async function getViewerLikedPosts(viewerId: string): Promise<ViewerLikedPostsResult> {
  if (!viewerId) {
    return createEmptyViewerLikedPostsResult();
  }

  try {
    const records = await listViewerLikeRecords(viewerId);
    return mapViewerLikeRecords(records);
  } catch (error) {
    console.error('[PostEngagementService.getViewerLikedPosts] Error:', error);
    throw error;
  }
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

export async function likePostForViewer(
  input: CreateViewerPostLikeInput,
): Promise<ViewerPostLikeMutationResult> {
  try {
    return await createViewerLikeRecord(input);
  } catch (error) {
    console.error('[PostEngagementService.likePostForViewer] Error:', error);
    throw error;
  }
}

export async function deleteViewerPostLike(
  input: DeleteViewerPostLikeInput,
): Promise<DeleteViewerPostLikeResult> {
  try {
    return await deleteViewerLikeRecord(input);
  } catch (error) {
    console.error('[PostEngagementService.deleteViewerPostLike] Error:', error);
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
    return await deleteViewerSaveRecord(input);
  } catch (error) {
    console.error('[PostEngagementService.deleteViewerPostSave] Error:', error);
    throw error;
  }
}
