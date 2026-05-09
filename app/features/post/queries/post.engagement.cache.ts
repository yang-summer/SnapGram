import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { postKeys } from './post.keys';
import type {
  DeleteViewerPostLikeResult,
  DeleteViewerPostSaveResult,
  ViewerLikedPostRecord,
  ViewerLikedPostsResult,
  ViewerPostLikeMutationResult,
  ViewerPostSaveMutationResult,
  ViewerSavedPostRecord,
  ViewerSavedPostsResult,
} from '../types/post.type';

type PostEngagementCountField = 'likeCount' | 'saveCount';

export type QueryDataSnapshot = {
  queryKey: QueryKey;
  data: unknown;
};

export type ExactQueryDataSnapshot = {
  queryKey: QueryKey;
  data: unknown;
  hadQuery: boolean;
};

function normalizePostIds(postIds: readonly string[]) {
  return Array.from(
    new Set(
      postIds
        .map((postId) => postId.trim())
        .filter((postId) => postId.length > 0),
    ),
  ).sort();
}

function toViewerLikedPostRecord(
  result: ViewerPostLikeMutationResult | DeleteViewerPostLikeResult,
): ViewerLikedPostRecord | null {
  if ('deleted' in result) {
    return null;
  }

  return {
    likeRecordId: result.likeRecordId,
    postId: result.postId,
  };
}

function toViewerSavedPostRecord(
  result: ViewerPostSaveMutationResult | DeleteViewerPostSaveResult,
): ViewerSavedPostRecord | null {
  if ('deleted' in result) {
    return null;
  }

  return {
    saveRecordId: result.saveRecordId,
    postId: result.postId,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isViewerLikedPostRecord(value: unknown): value is ViewerLikedPostRecord {
  return (
    isPlainObject(value) &&
    typeof value.likeRecordId === 'string' &&
    typeof value.postId === 'string'
  );
}

function isViewerSavedPostRecord(value: unknown): value is ViewerSavedPostRecord {
  return (
    isPlainObject(value) &&
    typeof value.saveRecordId === 'string' &&
    typeof value.postId === 'string'
  );
}

function patchNumericCount(currentCount: number, delta: number) {
  return Math.max(0, Math.trunc(currentCount) + delta);
}

function patchViewerLikedPostsResult(
  result: ViewerLikedPostsResult | unknown,
  postId: string,
  viewerLikedPost: ViewerLikedPostRecord | null,
): ViewerLikedPostsResult | unknown {
  if (
    !isPlainObject(result) ||
    !Array.isArray(result.records) ||
    !Array.isArray(result.postIds) ||
    !isPlainObject(result.recordByPostId)
  ) {
    return result;
  }

  const hasExistingRecord = typeof result.recordByPostId[postId] !== 'undefined';

  if (!viewerLikedPost && !hasExistingRecord) {
    return result;
  }

  if (viewerLikedPost && hasExistingRecord) {
    const currentRecord = result.recordByPostId[postId];

    if (
      isViewerLikedPostRecord(currentRecord) &&
      currentRecord.likeRecordId === viewerLikedPost.likeRecordId &&
      currentRecord.postId === viewerLikedPost.postId
    ) {
      return result;
    }
  }

  const nextRecordByPostId: Record<string, ViewerLikedPostRecord> = {
    ...(result.recordByPostId as Record<string, ViewerLikedPostRecord>),
  };

  if (viewerLikedPost) {
    nextRecordByPostId[postId] = viewerLikedPost;
  } else {
    delete nextRecordByPostId[postId];
  }

  const nextRecords = Object.values(nextRecordByPostId);

  return {
    records: nextRecords,
    postIds: nextRecords.map((record) => record.postId),
    recordByPostId: nextRecordByPostId,
  };
}

function patchViewerSavedPostsResult(
  result: ViewerSavedPostsResult | unknown,
  postId: string,
  viewerSavedPost: ViewerSavedPostRecord | null,
): ViewerSavedPostsResult | unknown {
  if (
    !isPlainObject(result) ||
    !Array.isArray(result.records) ||
    !Array.isArray(result.postIds) ||
    !isPlainObject(result.recordByPostId) ||
    !isPlainObject(result.recordIdsByPostId)
  ) {
    return result;
  }

  const hasExistingRecord = typeof result.recordByPostId[postId] !== 'undefined';

  if (!viewerSavedPost && !hasExistingRecord) {
    return result;
  }

  if (viewerSavedPost && hasExistingRecord) {
    const currentRecord = result.recordByPostId[postId];

    if (
      isViewerSavedPostRecord(currentRecord) &&
      currentRecord.saveRecordId === viewerSavedPost.saveRecordId &&
      currentRecord.postId === viewerSavedPost.postId
    ) {
      return result;
    }
  }

  const nextRecordByPostId: Record<string, ViewerSavedPostRecord> = {
    ...(result.recordByPostId as Record<string, ViewerSavedPostRecord>),
  };
  const nextRecordIdsByPostId: Record<string, string[]> = {
    ...(result.recordIdsByPostId as Record<string, string[]>),
  };

  if (viewerSavedPost) {
    nextRecordByPostId[postId] = viewerSavedPost;
    nextRecordIdsByPostId[postId] = [viewerSavedPost.saveRecordId];
  } else {
    delete nextRecordByPostId[postId];
    delete nextRecordIdsByPostId[postId];
  }

  const nextRecords = Object.values(nextRecordByPostId);

  return {
    records: nextRecords,
    postIds: nextRecords.map((record) => record.postId),
    recordByPostId: nextRecordByPostId,
    recordIdsByPostId: nextRecordIdsByPostId,
  };
}

function patchPostCountOnItem<T>(
  item: T,
  postId: string,
  field: PostEngagementCountField,
  delta: number,
): T {
  if (!isPlainObject(item) || item.id !== postId) {
    return item;
  }

  const currentCount = item[field];

  if (typeof currentCount !== 'number' || !Number.isFinite(currentCount)) {
    return item;
  }

  const nextCount = patchNumericCount(currentCount, delta);

  if (nextCount === currentCount) {
    return item;
  }

  return {
    ...item,
    [field]: nextCount,
  } as T;
}

function patchPostCountInArray<T>(
  items: T[],
  postId: string,
  field: PostEngagementCountField,
  delta: number,
): T[] {
  let hasChanged = false;
  const nextItems = items.map((item) => {
    const nextItem = patchPostCountOnItem(item, postId, field, delta);

    if (nextItem !== item) {
      hasChanged = true;
    }

    return nextItem;
  });

  return hasChanged ? nextItems : items;
}

function patchPostCountInData<T>(
  data: T | undefined,
  postId: string,
  field: PostEngagementCountField,
  delta: number,
): T | undefined {
  if (typeof data === 'undefined') {
    return data;
  }

  if (Array.isArray(data)) {
    return patchPostCountInArray(data, postId, field, delta) as T;
  }

  if (!isPlainObject(data)) {
    return data;
  }

  if (Array.isArray(data.pages)) {
    let hasChanged = false;
    const nextPages = data.pages.map((page) => {
      if (!isPlainObject(page) || !Array.isArray(page.items)) {
        return page;
      }

      const nextItems = patchPostCountInArray(page.items, postId, field, delta);

      if (nextItems === page.items) {
        return page;
      }

      hasChanged = true;

      return {
        ...page,
        items: nextItems,
      };
    });

    if (hasChanged) {
      return {
        ...data,
        pages: nextPages,
      } as T;
    }
  }

  if (Array.isArray(data.items)) {
    const nextItems = patchPostCountInArray(data.items, postId, field, delta);

    if (nextItems !== data.items) {
      return {
        ...data,
        items: nextItems,
      } as T;
    }
  }

  return patchPostCountOnItem(data, postId, field, delta);
}

export function createOptimisticViewerLikedPostRecord(postId: string): ViewerLikedPostRecord {
  return {
    likeRecordId: `optimistic-like:${postId}`,
    postId,
  };
}

export function createOptimisticViewerSavedPostRecord(postId: string): ViewerSavedPostRecord {
  return {
    saveRecordId: `optimistic-save:${postId}`,
    postId,
  };
}

export function snapshotQueryData(
  queryClient: QueryClient,
  queryKey: QueryKey,
): QueryDataSnapshot[] {
  return queryClient
    .getQueriesData({ queryKey })
    .map(([matchedQueryKey, data]) => ({ queryKey: matchedQueryKey, data }));
}

export function restoreQueryDataSnapshots(
  queryClient: QueryClient,
  snapshots: QueryDataSnapshot[],
): void {
  for (const snapshot of snapshots) {
    queryClient.setQueryData(snapshot.queryKey, snapshot.data);
  }
}

export function snapshotExactQueryData(
  queryClient: QueryClient,
  queryKey: QueryKey,
): ExactQueryDataSnapshot {
  return {
    queryKey,
    data: queryClient.getQueryData(queryKey),
    hadQuery: typeof queryClient.getQueryState(queryKey) !== 'undefined',
  };
}

export function restoreExactQueryDataSnapshot(
  queryClient: QueryClient,
  snapshot: ExactQueryDataSnapshot,
): void {
  if (snapshot.hadQuery) {
    queryClient.setQueryData(snapshot.queryKey, snapshot.data);
    return;
  }

  queryClient.removeQueries({ queryKey: snapshot.queryKey, exact: true });
}

export function patchPostEngagementCountCaches(
  queryClient: QueryClient,
  params: {
    postId: string;
    field: PostEngagementCountField;
    delta: number;
  },
): void {
  const normalizedPostId = params.postId.trim();

  if (normalizedPostId.length === 0 || params.delta === 0) {
    return;
  }

  const patchData = <T>(data: T | undefined) =>
    patchPostCountInData(data, normalizedPostId, params.field, params.delta);

  queryClient.setQueriesData({ queryKey: postKeys.lists() }, patchData);
  queryClient.setQueriesData({ queryKey: postKeys.profileRoot() }, patchData);
  queryClient.setQueriesData({ queryKey: postKeys.details() }, patchData);
}

export function patchNumericQueryCountCache(
  queryClient: QueryClient,
  queryKey: QueryKey,
  delta: number,
): void {
  if (delta === 0 || typeof queryClient.getQueryState(queryKey) === 'undefined') {
    return;
  }

  queryClient.setQueryData<number | undefined>(queryKey, (currentCount) => {
    if (typeof currentCount !== 'number' || !Number.isFinite(currentCount)) {
      return currentCount;
    }

    return patchNumericCount(currentCount, delta);
  });
}

export function setViewerLikedPostCache(
  queryClient: QueryClient,
  viewerProfileId: string,
  postId: string,
  viewerLikedPost: ViewerLikedPostRecord | null,
): void {
  const normalizedViewerProfileId = viewerProfileId.trim();
  const normalizedPostId = postId.trim();

  if (normalizedViewerProfileId.length === 0 || normalizedPostId.length === 0) {
    return;
  }

  queryClient.setQueryData(
    postKeys.viewerLike(normalizedViewerProfileId, normalizedPostId),
    viewerLikedPost,
  );
}

export function setViewerSavedPostCache(
  queryClient: QueryClient,
  viewerProfileId: string,
  postId: string,
  viewerSavedPost: ViewerSavedPostRecord | null,
): void {
  const normalizedViewerProfileId = viewerProfileId.trim();
  const normalizedPostId = postId.trim();

  if (normalizedViewerProfileId.length === 0 || normalizedPostId.length === 0) {
    return;
  }

  queryClient.setQueryData(
    postKeys.viewerSave(normalizedViewerProfileId, normalizedPostId),
    viewerSavedPost,
  );
}

export function applyViewerLikeMutationResultToCache(
  queryClient: QueryClient,
  result: ViewerPostLikeMutationResult | DeleteViewerPostLikeResult,
): void {
  const viewerLikedPost = toViewerLikedPostRecord(result);

  setViewerLikedPostCache(
    queryClient,
    result.viewerProfileId,
    result.postId,
    viewerLikedPost,
  );
  patchViewerLikedPostsCaches(
    queryClient,
    result.viewerProfileId,
    result.postId,
    viewerLikedPost,
  );
}

export function applyViewerSaveMutationResultToCache(
  queryClient: QueryClient,
  result: ViewerPostSaveMutationResult | DeleteViewerPostSaveResult,
): void {
  const viewerSavedPost = toViewerSavedPostRecord(result);

  setViewerSavedPostCache(
    queryClient,
    result.viewerProfileId,
    result.postId,
    viewerSavedPost,
  );
  patchViewerSavedPostsCaches(
    queryClient,
    result.viewerProfileId,
    result.postId,
    viewerSavedPost,
  );
}

export function patchViewerLikedPostsCaches(
  queryClient: QueryClient,
  viewerProfileId: string,
  postId: string,
  viewerLikedPost: ViewerLikedPostRecord | null,
): void {
  const normalizedViewerProfileId = viewerProfileId.trim();
  const normalizedPostId = postId.trim();

  if (normalizedViewerProfileId.length === 0 || normalizedPostId.length === 0) {
    return;
  }

  queryClient.setQueriesData(
    { queryKey: postKeys.viewerLikesScope(normalizedViewerProfileId) },
    (currentResult) => patchViewerLikedPostsResult(currentResult, normalizedPostId, viewerLikedPost),
  );
}

export function patchViewerSavedPostsCaches(
  queryClient: QueryClient,
  viewerProfileId: string,
  postId: string,
  viewerSavedPost: ViewerSavedPostRecord | null,
): void {
  const normalizedViewerProfileId = viewerProfileId.trim();
  const normalizedPostId = postId.trim();

  if (normalizedViewerProfileId.length === 0 || normalizedPostId.length === 0) {
    return;
  }

  queryClient.setQueriesData(
    { queryKey: postKeys.viewerSavesScope(normalizedViewerProfileId) },
    (currentResult) => patchViewerSavedPostsResult(currentResult, normalizedPostId, viewerSavedPost),
  );
}

export function hydrateViewerLikedPostCacheFromBatch(
  queryClient: QueryClient,
  viewerProfileId: string,
  postIds: readonly string[],
  viewerLikedPosts: ViewerLikedPostsResult | undefined,
): void {
  const normalizedViewerProfileId = viewerProfileId.trim();
  const normalizedPostIds = normalizePostIds(postIds);

  if (
    normalizedViewerProfileId.length === 0 ||
    normalizedPostIds.length === 0 ||
    typeof viewerLikedPosts === 'undefined'
  ) {
    return;
  }

  const recordByPostId = viewerLikedPosts?.recordByPostId ?? {};

  for (const postId of normalizedPostIds) {
    const singlePostQueryKey = postKeys.viewerLike(normalizedViewerProfileId, postId);

    if (typeof queryClient.getQueryData(singlePostQueryKey) !== 'undefined') {
      continue;
    }

    setViewerLikedPostCache(
      queryClient,
      normalizedViewerProfileId,
      postId,
      recordByPostId[postId] ?? null,
    );
  }
}

export function hydrateViewerSavedPostCacheFromBatch(
  queryClient: QueryClient,
  viewerProfileId: string,
  postIds: readonly string[],
  viewerSavedPosts: ViewerSavedPostsResult | undefined,
): void {
  const normalizedViewerProfileId = viewerProfileId.trim();
  const normalizedPostIds = normalizePostIds(postIds);

  if (
    normalizedViewerProfileId.length === 0 ||
    normalizedPostIds.length === 0 ||
    typeof viewerSavedPosts === 'undefined'
  ) {
    return;
  }

  const recordByPostId = viewerSavedPosts?.recordByPostId ?? {};

  for (const postId of normalizedPostIds) {
    const singlePostQueryKey = postKeys.viewerSave(normalizedViewerProfileId, postId);

    if (typeof queryClient.getQueryData(singlePostQueryKey) !== 'undefined') {
      continue;
    }

    setViewerSavedPostCache(
      queryClient,
      normalizedViewerProfileId,
      postId,
      recordByPostId[postId] ?? null,
    );
  }
}
