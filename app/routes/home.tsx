import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import { Button } from '~/components/ui/button';
import { VirtualMasonryFeed } from '~/features/feed/components/VirtualMasonryFeed';
import { useInfiniteFeedState } from '~/features/feed/hooks/useInfiniteFeedState';
import { useVirtualMasonryFeedState } from '~/features/feed/hooks/useVirtualMasonryFeedState';
import MasonryPostCard from '../features/post/components/MasonryPostCard';
import { useHomeFeedInfiniteQuery } from '../features/post/queries/post.queries';
import type { HomeFeedPostViewModel } from '../features/post/types/post.type';
import type { Route } from './+types/home';

type HomeVirtualFeedContentProps = {
  items: HomeFeedPostViewModel[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  onLoadMore: () => Promise<unknown>;
};

function HomeVirtualFeedContent({
  items,
  hasNextPage,
  isFetchingNextPage,
  isLoadMoreError,
  onLoadMore,
}: HomeVirtualFeedContentProps) {
  const virtualFeedState = useVirtualMasonryFeedState({
    items,
    hasNextPage,
    isFetchingNextPage,
    isLoadMoreError,
    onLoadMore,
  });

  return (
    <VirtualMasonryFeed
      state={virtualFeedState}
      renderItem={(item) => <MasonryPostCard post={item} />}
    />
  );
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ];
}

export default function Home() {
  const homeFeedQuery = useHomeFeedInfiniteQuery();
  const state = useInfiniteFeedState({
    query: homeFeedQuery,
  });

  let content: React.ReactNode;

  if (state.isInitialLoading) {
    // 首次请求期间展示整页加载态。
    content = (
      <PageLoadingState
        title="Loading your feed"
        description="Please wait while we load the latest posts."
        className="px-0 py-4"
      />
    );
  } else if (state.isInitialError) {
    // 首次请求失败时展示整页错误态，此时还没有可保留的 feed 内容。
    content = (
      <PageErrorState
        title="Failed to load your feed"
        description={
          state.initialError instanceof Error
            ? state.initialError.message
            : 'Please try again in a moment.'
        }
        onRetry={() => void state.retryInitial()}
        isRetrying={state.isRetryingInitial}
        className="px-0 py-4"
      />
    );
  } else if (state.isEmpty) {
    // 首次请求成功但没有帖子时展示空状态。
    content = (
      <PageEmptyState
        title="No posts yet"
        description="Follow creators or publish the first post to start filling your feed."
        className="px-0 py-4"
      />
    );
  } else {
    // 已有内容时始终保留瀑布流，后续分页状态只在底部区域展示。
    content = (
      <div className="flex w-full flex-col gap-8">
        <HomeVirtualFeedContent
          items={state.items}
          hasNextPage={state.hasNextPage}
          isFetchingNextPage={state.isFetchingNextPage}
          isLoadMoreError={state.isLoadMoreError}
          onLoadMore={state.retryLoadMore}
        />

        <div className="flex min-h-12 w-full items-center justify-center text-sm text-ink-subtle">
          {state.isLoadingMore ? <p>Loading more posts...</p> : null}

          {state.isLoadMoreError ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p>Unable to load more posts.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={state.isFetchingNextPage}
                onClick={() => void state.retryLoadMore()}
              >
                Retry
              </Button>
            </div>
          ) : null}

          {state.isEndReached ? <p>You're all caught up.</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-10 px-5 py-10 md:px-8 lg:p-14">
      <div className="flex w-full max-w-7xl flex-col items-center gap-6 md:gap-9">
        <h2 className="text-left w-full">Home Feed</h2>
        {content}
      </div>
    </div>
  );
}
