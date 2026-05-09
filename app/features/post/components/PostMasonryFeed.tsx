import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import { VirtualMasonryFeed } from '~/features/feed/components/VirtualMasonryFeed';
import { useVirtualMasonryFeedState } from '~/features/feed/hooks/useVirtualMasonryFeedState';
import { hydrateViewerLikedPostCacheFromBatch } from '../queries/post.engagement.cache';
import { useViewerLikedPostsByPostIdsQuery } from '../queries/post.engagement.queries';
import type { HomeFeedPostViewModel } from '../types/post.type';
import MasonryPostCard from './MasonryPostCard';

type PostMasonryFeedProps = {
  items: HomeFeedPostViewModel[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  onLoadMore: () => Promise<unknown>;
};

export default function PostMasonryFeed({
  items,
  hasNextPage,
  isFetchingNextPage,
  isLoadMoreError,
  onLoadMore,
}: PostMasonryFeedProps) {
  const virtualFeedState = useVirtualMasonryFeedState({
    items,
    hasNextPage,
    isFetchingNextPage,
    isLoadMoreError,
    onLoadMore,
  });
  const queryClient = useQueryClient();
  const { data: currentUserResult } = useCurrentUserQuery();
  const viewerProfileId =
    currentUserResult?.status === 'authenticated' ? currentUserResult.user.profileId : '';
  const postIds = useMemo(() => items.map((item) => item.id), [items]);
  const { data: viewerLikedPosts } = useViewerLikedPostsByPostIdsQuery(viewerProfileId, postIds);
  const likedPostIdSet = useMemo(
    () => new Set(viewerLikedPosts?.postIds ?? []),
    [viewerLikedPosts?.postIds],
  );

  useEffect(() => {
    hydrateViewerLikedPostCacheFromBatch(queryClient, viewerProfileId, postIds, viewerLikedPosts);
  }, [postIds, queryClient, viewerLikedPosts, viewerProfileId]);

  return (
    <VirtualMasonryFeed
      state={virtualFeedState}
      renderItem={(item) => (
        <MasonryPostCard
          post={item}
          viewerProfileId={viewerProfileId}
          initialIsLiked={likedPostIdSet.has(item.id)}
        />
      )}
    />
  );
}
