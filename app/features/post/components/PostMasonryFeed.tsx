import { useMemo } from 'react';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import { VirtualMasonryFeed } from '~/features/feed/components/VirtualMasonryFeed';
import { useVirtualMasonryFeedState } from '~/features/feed/hooks/useVirtualMasonryFeedState';
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
  const { data: currentUserResult } = useCurrentUserQuery();
  const viewerProfileId =
    currentUserResult?.status === 'authenticated' ? currentUserResult.user.profileId : '';
  const postIds = useMemo(() => items.map((item) => item.id), [items]);
  const { data: viewerLikedPosts } = useViewerLikedPostsByPostIdsQuery(viewerProfileId, postIds);
  const likedPostIdSet = useMemo(
    () => new Set(viewerLikedPosts?.postIds ?? []),
    [viewerLikedPosts?.postIds],
  );

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
