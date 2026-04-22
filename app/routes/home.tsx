import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import { Button } from '~/components/ui/button';
import MasonryFeed from '../features/post/components/MasonryFeed';
import { useHomeFeedInfiniteQuery } from '../features/post/queries/post.queries';
import type { Route } from './+types/home';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ];
}

export default function Home() {
  const { ref: loadMoreRef, inView: isLoadMoreInView } = useInView({
    rootMargin: '400px 0px',
  });
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useHomeFeedInfiniteQuery();
  const feedItems = data?.pages.flatMap((page) => page.items) ?? [];
  const hasFeedItems = feedItems.length > 0;
  const isInitialLoading = isPending;
  const isInitialError = isError && !hasFeedItems;
  const isEmpty = !isPending && !isError && !hasFeedItems;
  const isLoadingMore = hasFeedItems && isFetchingNextPage;
  const isLoadMoreError = hasFeedItems && isFetchNextPageError;
  const isEndReached = hasFeedItems && !hasNextPage && !isFetchingNextPage && !isFetchNextPageError;

  // 当底部 sentinel 接近视口时自动请求下一页；分页失败后不自动重试，交给用户手动触发。
  useEffect(() => {
    if (!isLoadMoreInView || !hasNextPage || isFetchingNextPage || isLoadMoreError) {
      return;
    }

    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoadMoreError, isLoadMoreInView]);

  let content: React.ReactNode;

  if (isInitialLoading) {
    // 首次请求期间展示整页加载态。
    content = (
      <PageLoadingState
        title="Loading your feed"
        description="Please wait while we load the latest posts."
        className="px-0 py-4"
      />
    );
  } else if (isInitialError) {
    // 首次请求失败时展示整页错误态，此时还没有可保留的 feed 内容。
    content = (
      <PageErrorState
        title="Failed to load your feed"
        description={error instanceof Error ? error.message : 'Please try again in a moment.'}
        onRetry={() => void refetch()}
        isRetrying={isFetching}
        className="px-0 py-4"
      />
    );
  } else if (isEmpty) {
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
        <MasonryFeed items={feedItems} />

        {hasNextPage && !isLoadMoreError ? (
          <div ref={loadMoreRef} aria-hidden="true" className="h-1 w-full" />
        ) : null}

        <div className="flex min-h-12 w-full items-center justify-center text-sm text-ink-subtle">
          {isLoadingMore ? <p>Loading more posts...</p> : null}

          {isLoadMoreError ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p>Unable to load more posts.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                Retry
              </Button>
            </div>
          ) : null}

          {isEndReached ? <p>You're all caught up.</p> : null}
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
