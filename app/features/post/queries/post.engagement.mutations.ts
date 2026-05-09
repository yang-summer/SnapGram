import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import {
  deleteViewerPostLike,
  deleteViewerPostSave,
  likePostForViewer,
  savePostForViewer,
} from '../services/post.engagement.service';
import type {
  DeleteViewerPostLikeResult,
  DeleteViewerPostSaveResult,
  ViewerPostLikeMutationResult,
  ViewerPostSaveMutationResult,
} from '../types/post.type';
import {
  applyViewerLikeMutationResultToCache,
  applyViewerSaveMutationResultToCache,
  createOptimisticViewerLikedPostRecord,
  createOptimisticViewerSavedPostRecord,
  patchNumericQueryCountCache,
  patchPostEngagementCountCaches,
  patchViewerLikedPostsCaches,
  patchViewerSavedPostsCaches,
  restoreExactQueryDataSnapshot,
  restoreQueryDataSnapshots,
  setViewerLikedPostCache,
  setViewerSavedPostCache,
  snapshotExactQueryData,
  snapshotQueryData,
  type ExactQueryDataSnapshot,
  type QueryDataSnapshot,
} from './post.engagement.cache';
import { postKeys } from './post.keys';

type BoundViewerPostEngagementParams = {
  viewerProfileId: string;
  postId: string;
};

type LikeMutationContext = {
  viewerLikeSnapshot: ExactQueryDataSnapshot;
  viewerLikesSnapshots: QueryDataSnapshot[];
  postListSnapshots: QueryDataSnapshot[];
  profileSnapshots: QueryDataSnapshot[];
  detailSnapshots: QueryDataSnapshot[];
  profileLikedCountSnapshot: ExactQueryDataSnapshot;
};

type SaveMutationContext = {
  viewerSaveSnapshot: ExactQueryDataSnapshot;
  viewerSavesSnapshots: QueryDataSnapshot[];
  postListSnapshots: QueryDataSnapshot[];
  profileSnapshots: QueryDataSnapshot[];
  detailSnapshots: QueryDataSnapshot[];
  profileSavedCountSnapshot: ExactQueryDataSnapshot;
};

type LikeMutationResult = ViewerPostLikeMutationResult | DeleteViewerPostLikeResult;
type SaveMutationResult = ViewerPostSaveMutationResult | DeleteViewerPostSaveResult;

function hasValidEngagementTarget(params: BoundViewerPostEngagementParams) {
  return params.viewerProfileId.trim().length > 0 && params.postId.trim().length > 0;
}

async function cancelLikeRelatedQueries(
  queryClient: QueryClient,
  params: BoundViewerPostEngagementParams,
) {
  await Promise.all([
    queryClient.cancelQueries({
      queryKey: postKeys.viewerLike(params.viewerProfileId, params.postId),
      exact: true,
    }),
    queryClient.cancelQueries({
      queryKey: postKeys.viewerLikesScope(params.viewerProfileId),
    }),
    queryClient.cancelQueries({
      queryKey: postKeys.lists(),
    }),
    queryClient.cancelQueries({
      queryKey: postKeys.profileRoot(),
    }),
    queryClient.cancelQueries({
      queryKey: postKeys.details(),
    }),
    queryClient.cancelQueries({
      queryKey: postKeys.profileLikedCount(params.viewerProfileId),
      exact: true,
    }),
  ]);
}

async function cancelSaveRelatedQueries(
  queryClient: QueryClient,
  params: BoundViewerPostEngagementParams,
) {
  await Promise.all([
    queryClient.cancelQueries({
      queryKey: postKeys.viewerSave(params.viewerProfileId, params.postId),
      exact: true,
    }),
    queryClient.cancelQueries({
      queryKey: postKeys.viewerSavesScope(params.viewerProfileId),
    }),
    queryClient.cancelQueries({
      queryKey: postKeys.lists(),
    }),
    queryClient.cancelQueries({
      queryKey: postKeys.profileRoot(),
    }),
    queryClient.cancelQueries({
      queryKey: postKeys.details(),
    }),
    queryClient.cancelQueries({
      queryKey: postKeys.profileSavedCount(params.viewerProfileId),
      exact: true,
    }),
  ]);
}

function createLikeMutationContext(
  queryClient: QueryClient,
  params: BoundViewerPostEngagementParams,
): LikeMutationContext {
  return {
    viewerLikeSnapshot: snapshotExactQueryData(
      queryClient,
      postKeys.viewerLike(params.viewerProfileId, params.postId),
    ),
    viewerLikesSnapshots: snapshotQueryData(
      queryClient,
      postKeys.viewerLikesScope(params.viewerProfileId),
    ),
    postListSnapshots: snapshotQueryData(queryClient, postKeys.lists()),
    profileSnapshots: snapshotQueryData(queryClient, postKeys.profileRoot()),
    detailSnapshots: snapshotQueryData(queryClient, postKeys.details()),
    profileLikedCountSnapshot: snapshotExactQueryData(
      queryClient,
      postKeys.profileLikedCount(params.viewerProfileId),
    ),
  };
}

function createSaveMutationContext(
  queryClient: QueryClient,
  params: BoundViewerPostEngagementParams,
): SaveMutationContext {
  return {
    viewerSaveSnapshot: snapshotExactQueryData(
      queryClient,
      postKeys.viewerSave(params.viewerProfileId, params.postId),
    ),
    viewerSavesSnapshots: snapshotQueryData(
      queryClient,
      postKeys.viewerSavesScope(params.viewerProfileId),
    ),
    postListSnapshots: snapshotQueryData(queryClient, postKeys.lists()),
    profileSnapshots: snapshotQueryData(queryClient, postKeys.profileRoot()),
    detailSnapshots: snapshotQueryData(queryClient, postKeys.details()),
    profileSavedCountSnapshot: snapshotExactQueryData(
      queryClient,
      postKeys.profileSavedCount(params.viewerProfileId),
    ),
  };
}

function applyOptimisticLikeState(
  queryClient: QueryClient,
  params: BoundViewerPostEngagementParams,
  isLiked: boolean,
): void {
  const viewerLikedPost = isLiked
    ? createOptimisticViewerLikedPostRecord(params.postId)
    : null;
  const delta = isLiked ? 1 : -1;

  setViewerLikedPostCache(
    queryClient,
    params.viewerProfileId,
    params.postId,
    viewerLikedPost,
  );
  patchViewerLikedPostsCaches(
    queryClient,
    params.viewerProfileId,
    params.postId,
    viewerLikedPost,
  );
  patchPostEngagementCountCaches(queryClient, {
    postId: params.postId,
    field: 'likeCount',
    delta,
  });
  patchNumericQueryCountCache(
    queryClient,
    postKeys.profileLikedCount(params.viewerProfileId),
    delta,
  );
}

function applyOptimisticSaveState(
  queryClient: QueryClient,
  params: BoundViewerPostEngagementParams,
  isSaved: boolean,
): void {
  const viewerSavedPost = isSaved
    ? createOptimisticViewerSavedPostRecord(params.postId)
    : null;
  const delta = isSaved ? 1 : -1;

  setViewerSavedPostCache(
    queryClient,
    params.viewerProfileId,
    params.postId,
    viewerSavedPost,
  );
  patchViewerSavedPostsCaches(
    queryClient,
    params.viewerProfileId,
    params.postId,
    viewerSavedPost,
  );
  patchPostEngagementCountCaches(queryClient, {
    postId: params.postId,
    field: 'saveCount',
    delta,
  });
  patchNumericQueryCountCache(
    queryClient,
    postKeys.profileSavedCount(params.viewerProfileId),
    delta,
  );
}

function rollbackLikeMutation(
  queryClient: QueryClient,
  context: LikeMutationContext | undefined,
): void {
  if (!context) {
    return;
  }

  restoreExactQueryDataSnapshot(queryClient, context.viewerLikeSnapshot);
  restoreQueryDataSnapshots(queryClient, context.viewerLikesSnapshots);
  restoreQueryDataSnapshots(queryClient, context.postListSnapshots);
  restoreQueryDataSnapshots(queryClient, context.profileSnapshots);
  restoreQueryDataSnapshots(queryClient, context.detailSnapshots);
  restoreExactQueryDataSnapshot(queryClient, context.profileLikedCountSnapshot);
}

function rollbackSaveMutation(
  queryClient: QueryClient,
  context: SaveMutationContext | undefined,
): void {
  if (!context) {
    return;
  }

  restoreExactQueryDataSnapshot(queryClient, context.viewerSaveSnapshot);
  restoreQueryDataSnapshots(queryClient, context.viewerSavesSnapshots);
  restoreQueryDataSnapshots(queryClient, context.postListSnapshots);
  restoreQueryDataSnapshots(queryClient, context.profileSnapshots);
  restoreQueryDataSnapshots(queryClient, context.detailSnapshots);
  restoreExactQueryDataSnapshot(queryClient, context.profileSavedCountSnapshot);
}

async function invalidateLikeQueries(
  queryClient: QueryClient,
  params: BoundViewerPostEngagementParams,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: postKeys.detail(params.postId),
    }),
    queryClient.invalidateQueries({
      queryKey: postKeys.lists(),
    }),
    queryClient.invalidateQueries({
      queryKey: postKeys.profileRoot(),
    }),
    queryClient.invalidateQueries({
      queryKey: postKeys.viewerLikesScope(params.viewerProfileId),
    }),
    queryClient.invalidateQueries({
      queryKey: postKeys.profileLikedFeedScope(params.viewerProfileId),
    }),
    queryClient.invalidateQueries({
      queryKey: postKeys.profileLikedCount(params.viewerProfileId),
    }),
  ]);
}

async function invalidateSaveQueries(
  queryClient: QueryClient,
  params: BoundViewerPostEngagementParams,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: postKeys.detail(params.postId),
    }),
    queryClient.invalidateQueries({
      queryKey: postKeys.lists(),
    }),
    queryClient.invalidateQueries({
      queryKey: postKeys.profileRoot(),
    }),
    queryClient.invalidateQueries({
      queryKey: postKeys.viewerSavesScope(params.viewerProfileId),
    }),
    queryClient.invalidateQueries({
      queryKey: postKeys.profileSavedFeedScope(params.viewerProfileId),
    }),
    queryClient.invalidateQueries({
      queryKey: postKeys.profileSavedCount(params.viewerProfileId),
    }),
  ]);
}

function createLikeMutationOptions(
  queryClient: QueryClient,
  params: BoundViewerPostEngagementParams,
  mutationFn: () => Promise<LikeMutationResult>,
  optimisticIsLiked: boolean,
) {
  return {
    mutationKey: postKeys.viewerLikeMutationKey(params.viewerProfileId, params.postId),
    scope: {
      id: postKeys.viewerLikeMutationScopeId(params.viewerProfileId, params.postId),
    },
    mutationFn,
    onMutate: async () => {
      if (!hasValidEngagementTarget(params)) {
        return createLikeMutationContext(queryClient, params);
      }

      await cancelLikeRelatedQueries(queryClient, params);

      const context = createLikeMutationContext(queryClient, params);
      applyOptimisticLikeState(queryClient, params, optimisticIsLiked);

      return context;
    },
    onError: (
      _error: unknown,
      _variables: void,
      context: LikeMutationContext | undefined,
    ) => {
      rollbackLikeMutation(queryClient, context);
    },
    onSuccess: (result: LikeMutationResult) => {
      applyViewerLikeMutationResultToCache(queryClient, result);
    },
    onSettled: async () => {
      if (!hasValidEngagementTarget(params)) {
        return;
      }

      await invalidateLikeQueries(queryClient, params);
    },
  } as const;
}

function createSaveMutationOptions(
  queryClient: QueryClient,
  params: BoundViewerPostEngagementParams,
  mutationFn: () => Promise<SaveMutationResult>,
  optimisticIsSaved: boolean,
) {
  return {
    mutationKey: postKeys.viewerSaveMutationKey(params.viewerProfileId, params.postId),
    scope: {
      id: postKeys.viewerSaveMutationScopeId(params.viewerProfileId, params.postId),
    },
    mutationFn,
    onMutate: async () => {
      if (!hasValidEngagementTarget(params)) {
        return createSaveMutationContext(queryClient, params);
      }

      await cancelSaveRelatedQueries(queryClient, params);

      const context = createSaveMutationContext(queryClient, params);
      applyOptimisticSaveState(queryClient, params, optimisticIsSaved);

      return context;
    },
    onError: (
      _error: unknown,
      _variables: void,
      context: SaveMutationContext | undefined,
    ) => {
      rollbackSaveMutation(queryClient, context);
    },
    onSuccess: (result: SaveMutationResult) => {
      applyViewerSaveMutationResultToCache(queryClient, result);
    },
    onSettled: async () => {
      if (!hasValidEngagementTarget(params)) {
        return;
      }

      await invalidateSaveQueries(queryClient, params);
    },
  } as const;
}

export function useCreateViewerPostLikeMutation(params: BoundViewerPostEngagementParams) {
  const queryClient = useQueryClient();

  return useMutation(
    createLikeMutationOptions(
      queryClient,
      params,
      () => likePostForViewer({ postId: params.postId }),
      true,
    ),
  );
}

export function useDeleteViewerPostLikeMutation(params: BoundViewerPostEngagementParams) {
  const queryClient = useQueryClient();

  return useMutation(
    createLikeMutationOptions(
      queryClient,
      params,
      () => deleteViewerPostLike({ postId: params.postId }),
      false,
    ),
  );
}

export function useCreateViewerPostSaveMutation(params: BoundViewerPostEngagementParams) {
  const queryClient = useQueryClient();

  return useMutation(
    createSaveMutationOptions(
      queryClient,
      params,
      () => savePostForViewer({ postId: params.postId }),
      true,
    ),
  );
}

export function useDeleteViewerPostSaveMutation(params: BoundViewerPostEngagementParams) {
  const queryClient = useQueryClient();

  return useMutation(
    createSaveMutationOptions(
      queryClient,
      params,
      () => deleteViewerPostSave({ postId: params.postId }),
      false,
    ),
  );
}

export function useViewerPostLikePending(params: BoundViewerPostEngagementParams) {
  return (
    useIsMutating({
      mutationKey: postKeys.viewerLikeMutationKey(params.viewerProfileId, params.postId),
    }) > 0
  );
}

export function useViewerPostSavePending(params: BoundViewerPostEngagementParams) {
  return (
    useIsMutating({
      mutationKey: postKeys.viewerSaveMutationKey(params.viewerProfileId, params.postId),
    }) > 0
  );
}
