import { useEffect, useState } from 'react';
import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import { Input } from '~/components/ui/input';
import { useDebounce } from 'ahooks';
import GridPostList from '~/features/post/components/GridPostList';
import SearchResults from '~/features/post/components/SearchResults';
import {
  useExplorePostsInfiniteQuery,
  useSearchPostsQuery,
} from '~/features/post/queries/post.queries';
import { useInView } from 'react-intersection-observer';

export default function Explore() {
  const { ref, inView } = useInView();
  const [searchValue, setSearchValue] = useState('');
  const debouncedSearchValue = useDebounce(searchValue, { wait: 500 });
  const shouldShowSearchResults = debouncedSearchValue.trim().length >= 3;

  const {
    data: posts,
    isPending: isPostsPending,
    isError: isPostsError,
    error: postsError,
    refetch: refetchPosts,
    isFetching: isPostsFetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useExplorePostsInfiniteQuery();

  const {
    data: searchedPosts,
    isPending: isSearchPending,
    isError: isSearchError,
    error: searchError,
    refetch: refetchSearchPosts,
  } = useSearchPostsQuery(debouncedSearchValue);

  useEffect(() => {
    if (inView && !shouldShowSearchResults && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, inView, isFetchingNextPage, shouldShowSearchResults]);

  const shouldShowEmptyState =
    !shouldShowSearchResults && !!posts && posts.pages.every((page) => page.items.length === 0);

  let content: React.ReactNode;

  if (shouldShowSearchResults) {
    content = (
      <SearchResults
        searchTerm={debouncedSearchValue.trim()}
        isSearchPending={isSearchPending}
        isSearchError={isSearchError}
        searchError={searchError}
        onRetry={() => void refetchSearchPosts()}
        searchedPosts={searchedPosts}
      />
    );
  } else if (isPostsPending && !posts) {
    content = (
      <PageLoadingState
        title="Loading explore posts"
        description="Please wait while we fetch the latest recommendations."
        className="px-0 py-4"
      />
    );
  } else if (isPostsError && !posts) {
    content = (
      <PageErrorState
        title="Failed to load explore posts"
        description={
          postsError instanceof Error ? postsError.message : 'Please try again in a moment.'
        }
        onRetry={() => void refetchPosts()}
        isRetrying={isPostsFetching}
        className="px-0 py-4"
      />
    );
  } else if (shouldShowEmptyState) {
    content = (
      <PageEmptyState
        title="No explore posts yet"
        description="There are no public posts to explore right now."
        className="px-0 py-4"
      />
    );
  } else {
    content = posts?.pages.map((page, index) => (
      <GridPostList key={`page-${index}`} posts={page.items} />
    ));
  }

  return (
    <div className="flex flex-col items-center overflow-scroll py-10 px-5 md:p-14">
      <div className="flex flex-col max-w-5xl items-center w-full gap-6 md:gap-9">
        <h2>Search Posts</h2>
        <div className="flex gap-1 px-4 w-full rounded-lg">
          <img src="/assets/icons/search.svg" width={24} height={24} alt="search" />
          <Input
            type="text"
            placeholder="Search"
            className="h-12 border-none focus-visible:ring-0 focus-visible:ring-offset-0 ring-offset-0 !important"
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center w-full max-w-5xl mt-16 mb-7">
        <h3>Popular Today</h3>
        <div className="flex justify-center items-center gap-3 rounded-xl px-4 py-2 cursor-pointer">
          <p>All</p>
          <img src="/assets/icons/filter.svg" width={20} height={20} alt="filter" />
        </div>
      </div>

      <div className="flex flex-wrap gap-9 w-full max-w-5xl">
        {content}
      </div>

      {hasNextPage && !shouldShowSearchResults && !shouldShowEmptyState && !isPostsError && (
        <div ref={ref} className="mt-10">
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </div>
      )}
    </div>
  );
}
