import { useEffect, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import type { CursorPage } from '~/features/post/types/post.type';

type InfiniteFeedQueryResult<TItem> = {
  data?: {
    pages: Array<CursorPage<TItem>>;
  };
  error: unknown;
  isPending: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
  isFetching: boolean;
  hasNextPage: boolean | undefined;
  fetchNextPage: () => Promise<unknown>;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
};

type UseInfiniteFeedStateOptions<TItem> = {
  query: InfiniteFeedQueryResult<TItem>;
  rootMargin?: string;
};

export type InfiniteFeedState<TItem> = {
  items: TItem[];
  hasVisibleItems: boolean;
  hasNextPage: boolean;
  isInitialLoading: boolean;
  isInitialError: boolean;
  initialError: unknown;
  isRetryingInitial: boolean;
  isEmpty: boolean;
  isLoadingMore: boolean;
  isLoadMoreError: boolean;
  isEndReached: boolean;
  isFetchingNextPage: boolean;
  loadMoreRef: (node?: Element | null) => void;
  retryInitial: () => Promise<unknown>;
  retryLoadMore: () => Promise<unknown>;
};

function flattenFeedItems<TItem>(pages: Array<CursorPage<TItem>> | undefined): TItem[] {
  if (!pages || pages.length === 0) {
    return [];
  }

  return pages.flatMap((page) => page.items);
}

export function useInfiniteFeedState<TItem>({
  query,
  rootMargin = '400px 0px',
}: UseInfiniteFeedStateOptions<TItem>): InfiniteFeedState<TItem> {
  const { ref: loadMoreRef, inView: isLoadMoreInView } = useInView({
    rootMargin,
  });
  // 将 infinite query 的多页结果拍平成单一 items，供内容区直接渲染。
  const items = useMemo(() => flattenFeedItems(query.data?.pages), [query.data?.pages]);
  // 当前是否已经有至少一张可见卡片。
  const hasVisibleItems = items.length > 0;
  // 统一归一化 hasNextPage，避免处理 undefined 分支。
  const hasNextPage = query.hasNextPage === true;
  // 首屏加载态：当前仍没有任何可见内容，且首次请求仍在进行中。
  const isInitialLoading = !hasVisibleItems && query.isPending;
  // 首屏阻塞错误：当前仍没有任何可见内容，且首次请求已经失败。
  const isInitialError = !hasVisibleItems && query.isError;
  // 整体空态：确认当前没有内容、没有进行中的加载、也没有错误，同时已经没有下一页。
  const isEmpty = !hasVisibleItems && !isInitialLoading && !isInitialError && !hasNextPage;
  // 已有内容后的“加载更多”状态，只影响底部状态区，不覆盖已渲染的瀑布流。
  const isLoadingMore = hasVisibleItems && query.isFetchingNextPage;
  // 已有内容后的分页失败状态，同样只在底部展示重试入口。
  const isLoadMoreError =
    hasVisibleItems && !query.isFetchingNextPage && query.isFetchNextPageError;
  // 已到列表末尾：已有内容、没有下一页，且当前也没有进行中的分页请求或分页错误。
  const isEndReached =
    hasVisibleItems && !hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError;
  // 首屏错误重试中的状态，用来驱动整页错误态上的“重试中”反馈。
  const isRetryingInitial = !hasVisibleItems && !query.isPending && query.isFetching;

  async function retryInitial() {
    return query.refetch();
  }

  async function retryLoadMore() {
    return query.fetchNextPage();
  }

  // 当已经有可见内容时，使用底部 sentinel 驱动正常的自动加载更多。
  // 一旦分页失败，则停止自动重试，交由底部状态区的手动重试按钮接管。
  useEffect(() => {
    if (
      !hasVisibleItems ||
      !isLoadMoreInView ||
      !hasNextPage ||
      query.isFetchingNextPage ||
      query.isFetchNextPageError
    ) {
      return;
    }

    void query.fetchNextPage();
  }, [
    query.fetchNextPage,
    hasVisibleItems,
    hasNextPage,
    isLoadMoreInView,
    query.isFetchingNextPage,
    query.isFetchNextPageError,
  ]);

  return {
    items,
    hasVisibleItems,
    hasNextPage,
    isInitialLoading,
    isInitialError,
    initialError: isInitialError ? query.error : null,
    isRetryingInitial,
    isEmpty,
    isLoadingMore,
    isLoadMoreError,
    isEndReached,
    isFetchingNextPage: query.isFetchingNextPage,
    loadMoreRef,
    retryInitial,
    retryLoadMore,
  };
}
