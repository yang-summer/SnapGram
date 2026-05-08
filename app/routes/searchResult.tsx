import { SearchIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import { Button } from '~/components/ui/button';
import { useInfiniteFeedState } from '~/features/feed/hooks/useInfiniteFeedState';
import PostMasonryFeed from '~/features/post/components/PostMasonryFeed';
import { useSearchPostsInfiniteQuery } from '~/features/post/queries/post.queries';

const SEARCH_KEYWORD_MIN_LENGTH = 3;

export default function SearchResult() {
  const [searchParams] = useSearchParams();
  const keyword = (searchParams.get('keyword') ?? '').trim();
  const hasKeyword = keyword.length > 0;
  const isKeywordTooShort = hasKeyword && keyword.length < SEARCH_KEYWORD_MIN_LENGTH;
  const canSearch = keyword.length >= SEARCH_KEYWORD_MIN_LENGTH;

  const searchPostsQuery = useSearchPostsInfiniteQuery(keyword);
  const state = useInfiniteFeedState({
    query: searchPostsQuery,
  });

  let content: ReactNode;

  if (!hasKeyword) {
    // URL 中没有 keyword 时，不发起搜索请求，展示引导态提示用户从顶部栏输入关键词。
    content = (
      <PageEmptyState
        title="Start a search"
        description="Enter a keyword in the top bar to search posts by caption and tags."
        className="px-0 py-4"
      />
    );
  } else if (isKeywordTooShort) {
    // URL 中有 keyword，但长度还没达到 Appwrite 全文搜索门槛时，展示说明态而不是继续请求。
    content = (
      <PageEmptyState
        title="Keyword is too short"
        description="Enter at least 3 characters in the top bar to search posts."
        className="px-0 py-4"
      />
    );
  } else if (state.isInitialLoading) {
    // 首次进入结果页且搜索请求仍在进行时，展示整页加载态。
    content = (
      <PageLoadingState
        title="Searching posts"
        description={`Please wait while we search for "${keyword}".`}
        className="px-0 py-4"
      />
    );
  } else if (state.isInitialError) {
    // 首次搜索失败且当前还没有任何可展示结果时，展示整页错误态和重试入口。
    content = (
      <PageErrorState
        title="Failed to load search results"
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
    // 搜索成功但没有命中任何帖子时，展示无结果空态。
    content = (
      <PageEmptyState
        title="No matching posts"
        description={`We could not find posts matching "${keyword}".`}
        className="px-0 py-4"
      />
    );
  } else {
    // 已经拿到至少一条结果时，始终保留瀑布流内容；后续分页状态只在底部状态区展示。
    content = (
      <div className="flex w-full flex-col gap-8">
        <PostMasonryFeed
          items={state.items}
          hasNextPage={state.hasNextPage}
          isFetchingNextPage={state.isFetchingNextPage}
          isLoadMoreError={state.isLoadMoreError}
          onLoadMore={state.retryLoadMore}
        />

        <div className="flex min-h-12 w-full items-center justify-center text-center text-sm text-ink-subtle">
          {/* 已有结果后继续翻页时，只在底部显示“加载更多中”，不覆盖现有内容。 */}
          {state.isLoadingMore ? <p>Loading more results...</p> : null}

          {/* 后续分页失败时，保留已渲染结果，仅在底部提供手动重试入口。 */}
          {state.isLoadMoreError ? (
            <div className="flex flex-col items-center gap-3">
              <p>Unable to load more search results.</p>
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

          {/* 已有结果且确认没有下一页时，在底部给出明确的列表结束提示。 */}
          {state.isEndReached ? <p>You have reached the end of the search results.</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-10 px-5 py-10 md:px-8 lg:px-14 lg:pt-10 lg:pb-14">
      <div className="flex w-full max-w-7xl flex-col items-center gap-6 md:gap-9">
        <div className="flex w-full flex-col gap-2">
          <div className="flex justify-start items-center gap-3 w-full">
            <SearchIcon className="size-9" aria-hidden="true" />
            <h2 className="text-[24px] font-bold leading-[140%] tracking-tighter w-full text-left">
              Search Results
            </h2>
          </div>
          {hasKeyword ? (
            <p className="text-sm text-ink-subtle">Showing posts matching "{keyword}".</p>
          ) : (
            <p className="text-sm text-ink-subtle">Use the top bar to search published posts.</p>
          )}
        </div>
        {content}
      </div>
    </div>
  );
}
