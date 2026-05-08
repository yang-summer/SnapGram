import type { ReactNode } from 'react';
import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import { Button } from '~/components/ui/button';
import type { InfiniteFeedState } from '~/features/feed/hooks/useInfiniteFeedState';
import PostMasonryFeed from '~/features/post/components/PostMasonryFeed';
import type { HomeFeedPostViewModel } from '~/features/post/types/post.type';

export type ProfileFeedTabContentCopy = {
  loadingTitle?: string;
  loadingDescription?: string;
  errorTitle?: string;
  emptyTitle: string;
  emptyDescription: string;
  loadingMoreLabel?: string;
  loadMoreErrorMessage?: string;
  loadMoreRetryLabel?: string;
  endReachedMessage?: string;
};

type ProfileFeedTabContentProps = {
  state: InfiniteFeedState<HomeFeedPostViewModel>;
  copy: ProfileFeedTabContentCopy;
  className?: string;
};

function ProfileFeedLoadMoreState({
  state,
  copy,
}: {
  state: InfiniteFeedState<HomeFeedPostViewModel>;
  copy: ProfileFeedTabContentCopy;
}) {
  return (
    <div className="flex min-h-12 w-full items-center justify-center text-center text-sm text-ink-subtle">
      {state.isLoadingMore ? <p>{copy.loadingMoreLabel ?? 'Loading more posts...'}</p> : null}

      {state.isLoadMoreError ? (
        <div className="flex flex-col items-center gap-3">
          <p>{copy.loadMoreErrorMessage ?? 'Unable to load more posts.'}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={state.isFetchingNextPage}
            onClick={() => void state.retryLoadMore()}
          >
            {copy.loadMoreRetryLabel ?? 'Retry'}
          </Button>
        </div>
      ) : null}

      {state.isEndReached ? <p>{copy.endReachedMessage ?? 'No more posts to show.'}</p> : null}
    </div>
  );
}

export default function ProfileFeedTabContent({
  state,
  copy,
  className,
}: ProfileFeedTabContentProps) {
  let content: ReactNode;

  if (state.isInitialLoading) {
    content = (
      <PageLoadingState
        title={copy.loadingTitle ?? 'Loading posts'}
        description={
          copy.loadingDescription ?? 'Please wait while we load the latest posts for this tab.'
        }
        className="px-0 py-4"
      />
    );
  } else if (state.isInitialError) {
    content = (
      <PageErrorState
        title={copy.errorTitle ?? 'Failed to load posts'}
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
    content = (
      <PageEmptyState
        title={copy.emptyTitle}
        description={copy.emptyDescription}
        className="px-0 py-4"
      />
    );
  } else {
    content = (
      <div className="flex w-full flex-col gap-8">
        <PostMasonryFeed
          items={state.items}
          hasNextPage={state.hasNextPage}
          isFetchingNextPage={state.isFetchingNextPage}
          isLoadMoreError={state.isLoadMoreError}
          onLoadMore={state.retryLoadMore}
        />

        <ProfileFeedLoadMoreState state={state} copy={copy} />
      </div>
    );
  }

  return <div className={className}>{content}</div>;
}
