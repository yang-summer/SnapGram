import {
  countProfileLikeRecords,
  countProfileSaveRecords,
  findViewerLikeRecord,
  findViewerSaveRecord,
  listAllViewerLikeRecords,
  listAllViewerSaveRecords,
  listProfileLikeRecordsPage,
  listProfileSaveRecordsPage,
  listViewerLikeRecordsByPostIds,
  listViewerSaveRecordsByPostIds,
} from '../api/post.engagement.api';
import {
  likePostWithContentAction,
  savePostWithContentAction,
  unlikePostWithContentAction,
  unsavePostWithContentAction,
} from '../api/post.actions.api';
import { DEFAULT_PROFILE_FEED_PAGE_SIZE, listPublishedFeedPostRowsByIds } from '../api/post.api';
import { mapPostRowsToOrderedHomeFeedItems } from '../mappers/post.mapper';
import type {
  CreateViewerPostLikeInput,
  CreateViewerPostSaveInput,
  DeleteViewerPostLikeInput,
  DeleteViewerPostLikeResult,
  DeleteViewerPostSaveInput,
  DeleteViewerPostSaveResult,
  ProfileEngagementPageParams,
  ProfileFeedPage,
  RawViewerLikeRecord,
  RawViewerSaveRecord,
  ViewerLikedPostResult,
  ViewerLikedPostsByPostIdsResult,
  ViewerLikedPostRecord,
  ViewerLikedPostsResult,
  ViewerPostLikeMutationResult,
  ViewerPostSaveMutationResult,
  ViewerSavedPostResult,
  ViewerSavedPostsByPostIdsResult,
  ViewerSavedPostRecord,
  ViewerSavedPostsResult,
} from '../types/post.type';

const APPWRITE_MAX_LIST_LIMIT = 100;

function clampListLimit(limit: number | undefined, fallback: number): number {
  if (typeof limit !== 'number' || Number.isNaN(limit)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), APPWRITE_MAX_LIST_LIMIT);
}

function getNextCursorFromEngagementRows(
  rows: Array<RawViewerLikeRecord | RawViewerSaveRecord>,
  pageSize: number,
): string | null {
  if (rows.length !== pageSize || rows.length === 0) {
    return null;
  }

  return rows[rows.length - 1].$id;
}

function getOrderedPostIdsFromEngagementRows(
  rows: Array<RawViewerLikeRecord | RawViewerSaveRecord>,
): string[] {
  return rows
    .map((row) => row.postId.trim())
    .filter((postId) => postId.length > 0);
}

async function getProfileEngagementFeedPage(
  params: ProfileEngagementPageParams,
  listRecordsPage: (
    params: ProfileEngagementPageParams,
  ) => Promise<{
    rows: Array<RawViewerLikeRecord | RawViewerSaveRecord>;
  }>,
): Promise<ProfileFeedPage> {
  const normalizedLimit = clampListLimit(params.limit, DEFAULT_PROFILE_FEED_PAGE_SIZE);
  const recordsPage = await listRecordsPage({
    profileId: params.profileId,
    cursor: params.cursor ?? null,
    limit: normalizedLimit,
  });
  const nextCursor = getNextCursorFromEngagementRows(recordsPage.rows, normalizedLimit);
  const orderedPostIds = getOrderedPostIdsFromEngagementRows(recordsPage.rows);

  if (orderedPostIds.length === 0) {
    return {
      items: [],
      nextCursor,
    };
  }

  const postsPage = await listPublishedFeedPostRowsByIds(orderedPostIds);

  return {
    items: mapPostRowsToOrderedHomeFeedItems(postsPage.rows, orderedPostIds),
    nextCursor,
  };
}

function mapViewerLikeRecord(record: RawViewerLikeRecord): ViewerLikedPostRecord {
  return {
    likeRecordId: record.$id,
    postId: record.postId,
  };
}

function createEmptyViewerLikedPostsResult(): ViewerLikedPostsResult {
  return {
    records: [],
    postIds: [],
    recordByPostId: {},
  };
}

function mapViewerLikeRecords(records: RawViewerLikeRecord[]): ViewerLikedPostsResult {
  if (records.length === 0) {
    return createEmptyViewerLikedPostsResult();
  }

  const recordByPostId: Record<string, ViewerLikedPostRecord> = {};

  for (let index = 0; index < records.length; index += 1) {
    const mappedRecord = mapViewerLikeRecord(records[index]);

    if (!recordByPostId[mappedRecord.postId]) {
      recordByPostId[mappedRecord.postId] = mappedRecord;
    }
  }

  const mappedRecords = Object.values(recordByPostId);

  return {
    records: mappedRecords,
    postIds: mappedRecords.map((record) => record.postId),
    recordByPostId,
  };
}

function mapViewerSaveRecord(record: RawViewerSaveRecord): ViewerSavedPostRecord {
  return {
    saveRecordId: record.$id,
    postId: record.postId,
  };
}

function createEmptyViewerSavedPostsResult(): ViewerSavedPostsResult {
  return {
    records: [],
    postIds: [],
    recordByPostId: {},
    recordIdsByPostId: {},
  };
}

function mapViewerSaveRecords(records: RawViewerSaveRecord[]): ViewerSavedPostsResult {
  if (records.length === 0) {
    return createEmptyViewerSavedPostsResult();
  }

  const recordByPostId: Record<string, ViewerSavedPostRecord> = {};

  for (let index = 0; index < records.length; index += 1) {
    const mappedRecord = mapViewerSaveRecord(records[index]);

    if (!recordByPostId[mappedRecord.postId]) {
      recordByPostId[mappedRecord.postId] = mappedRecord;
    }
  }

  const mappedRecords = Object.values(recordByPostId);
  const recordIdsByPostId = Object.fromEntries(
    mappedRecords.map((record) => [record.postId, [record.saveRecordId]]),
  );

  return {
    records: mappedRecords,
    postIds: mappedRecords.map((record) => record.postId),
    recordByPostId,
    recordIdsByPostId,
  };
}

export async function getViewerLikedPost(
  viewerProfileId: string,
  postId: string,
): Promise<ViewerLikedPostResult> {
  if (!viewerProfileId || !postId) {
    return null;
  }

  try {
    const record = await findViewerLikeRecord(viewerProfileId, postId);
    return record ? mapViewerLikeRecord(record) : null;
  } catch (error) {
    console.error('[PostEngagementService.getViewerLikedPost] Error:', error);
    throw error;
  }
}

export async function getViewerLikedPosts(viewerProfileId: string): Promise<ViewerLikedPostsResult> {
  if (!viewerProfileId) {
    return createEmptyViewerLikedPostsResult();
  }

  try {
    const records = await listAllViewerLikeRecords(viewerProfileId);
    return mapViewerLikeRecords(records);
  } catch (error) {
    console.error('[PostEngagementService.getViewerLikedPosts] Error:', error);
    throw error;
  }
}

export async function getViewerLikedPostsByPostIds(
  viewerProfileId: string,
  postIds: string[],
): Promise<ViewerLikedPostsByPostIdsResult> {
  if (!viewerProfileId || postIds.length === 0) {
    return createEmptyViewerLikedPostsResult();
  }

  try {
    const records = await listViewerLikeRecordsByPostIds(viewerProfileId, postIds);
    return mapViewerLikeRecords(records);
  } catch (error) {
    console.error('[PostEngagementService.getViewerLikedPostsByPostIds] Error:', error);
    throw error;
  }
}

export async function getViewerSavedPost(
  viewerProfileId: string,
  postId: string,
): Promise<ViewerSavedPostResult> {
  if (!viewerProfileId || !postId) {
    return null;
  }

  try {
    const record = await findViewerSaveRecord(viewerProfileId, postId);
    return record ? mapViewerSaveRecord(record) : null;
  } catch (error) {
    console.error('[PostEngagementService.getViewerSavedPost] Error:', error);
    throw error;
  }
}

export async function getViewerSavedPosts(viewerProfileId: string): Promise<ViewerSavedPostsResult> {
  if (!viewerProfileId) {
    return createEmptyViewerSavedPostsResult();
  }

  try {
    const records = await listAllViewerSaveRecords(viewerProfileId);
    return mapViewerSaveRecords(records);
  } catch (error) {
    console.error('[PostEngagementService.getViewerSavedPosts] Error:', error);
    throw error;
  }
}

export async function getViewerSavedPostsByPostIds(
  viewerProfileId: string,
  postIds: string[],
): Promise<ViewerSavedPostsByPostIdsResult> {
  if (!viewerProfileId || postIds.length === 0) {
    return createEmptyViewerSavedPostsResult();
  }

  try {
    const records = await listViewerSaveRecordsByPostIds(viewerProfileId, postIds);
    return mapViewerSaveRecords(records);
  } catch (error) {
    console.error('[PostEngagementService.getViewerSavedPostsByPostIds] Error:', error);
    throw error;
  }
}

export async function getProfileLikedFeedPage(
  params: ProfileEngagementPageParams,
): Promise<ProfileFeedPage> {
  try {
    return await getProfileEngagementFeedPage(params, listProfileLikeRecordsPage);
  } catch (error) {
    console.error('[PostEngagementService.getProfileLikedFeedPage] Error:', error);
    throw error;
  }
}

export async function getProfileSavedFeedPage(
  params: ProfileEngagementPageParams,
): Promise<ProfileFeedPage> {
  try {
    return await getProfileEngagementFeedPage(params, listProfileSaveRecordsPage);
  } catch (error) {
    console.error('[PostEngagementService.getProfileSavedFeedPage] Error:', error);
    throw error;
  }
}

export async function getProfileLikedCount(profileId: string): Promise<number> {
  try {
    return await countProfileLikeRecords(profileId);
  } catch (error) {
    console.error('[PostEngagementService.getProfileLikedCount] Error:', error);
    throw error;
  }
}

export async function getProfileSavedCount(profileId: string): Promise<number> {
  try {
    return await countProfileSaveRecords(profileId);
  } catch (error) {
    console.error('[PostEngagementService.getProfileSavedCount] Error:', error);
    throw error;
  }
}

export async function likePostForViewer(
  input: CreateViewerPostLikeInput,
): Promise<ViewerPostLikeMutationResult> {
  try {
    return await likePostWithContentAction(input.postId);
  } catch (error) {
    console.error('[PostEngagementService.likePostForViewer] Error:', error);
    throw error;
  }
}

export async function deleteViewerPostLike(
  input: DeleteViewerPostLikeInput,
): Promise<DeleteViewerPostLikeResult> {
  try {
    return await unlikePostWithContentAction(input.postId);
  } catch (error) {
    console.error('[PostEngagementService.deleteViewerPostLike] Error:', error);
    throw error;
  }
}

export async function savePostForViewer(
  input: CreateViewerPostSaveInput,
): Promise<ViewerPostSaveMutationResult> {
  try {
    return await savePostWithContentAction(input.postId);
  } catch (error) {
    console.error('[PostEngagementService.savePostForViewer] Error:', error);
    throw error;
  }
}

export async function deleteViewerPostSave(
  input: DeleteViewerPostSaveInput,
): Promise<DeleteViewerPostSaveResult> {
  try {
    return await unsavePostWithContentAction(input.postId);
  } catch (error) {
    console.error('[PostEngagementService.deleteViewerPostSave] Error:', error);
    throw error;
  }
}
