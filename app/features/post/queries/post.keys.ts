function normalizePostIdsForKey(postIds: readonly string[]) {
  return Array.from(
    new Set(
      postIds
        .map((postId) => postId.trim())
        .filter((postId) => postId.length > 0),
    ),
  ).sort();
}

export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  recent: () => [...postKeys.lists(), 'recent'] as const,
  homeFeed: (params: { limit: number }) => [...postKeys.lists(), 'home-feed', params] as const,
  explore: (params: { limit: number }) => [...postKeys.lists(), 'explore', params] as const,
  search: (params: { term: string; limit: number }) => [...postKeys.lists(), 'search', params] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (id: string) => [...postKeys.details(), id] as const,
  editor: (id: string) => [...postKeys.all, 'editor', id] as const,
  engagement: () => [...postKeys.all, 'engagement'] as const,
  viewerLikesRoot: () => [...postKeys.engagement(), 'viewer-likes'] as const,
  viewerLikesScope: (viewerProfileId: string) =>
    [...postKeys.viewerLikesRoot(), viewerProfileId] as const,
  viewerLikes: (viewerProfileId: string) =>
    [...postKeys.viewerLikesScope(viewerProfileId), 'all'] as const,
  viewerLike: (viewerProfileId: string, postId: string) =>
    [...postKeys.viewerLikesScope(viewerProfileId), 'single', postId] as const,
  viewerLikesByPosts: (viewerProfileId: string, postIds: readonly string[]) =>
    [...postKeys.viewerLikesScope(viewerProfileId), 'batch', normalizePostIdsForKey(postIds)] as const,
  viewerSavesRoot: () => [...postKeys.engagement(), 'viewer-saves'] as const,
  viewerSavesScope: (viewerProfileId: string) =>
    [...postKeys.viewerSavesRoot(), viewerProfileId] as const,
  viewerSaves: (viewerProfileId: string) =>
    [...postKeys.viewerSavesScope(viewerProfileId), 'all'] as const,
  viewerSave: (viewerProfileId: string, postId: string) =>
    [...postKeys.viewerSavesScope(viewerProfileId), 'single', postId] as const,
  viewerSavesByPosts: (viewerProfileId: string, postIds: readonly string[]) =>
    [...postKeys.viewerSavesScope(viewerProfileId), 'batch', normalizePostIdsForKey(postIds)] as const,
};
