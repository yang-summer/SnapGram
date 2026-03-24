import { useEffect, useState } from 'react';
import GridPostList from '~/components/shared/GridPostList';
import { Input } from '~/components/ui/input';
import { useGetPostsQuery, useSearchPostsQuery } from '~/lib/react-query/queriesAndMutations';
import { useDebounce } from 'ahooks';
import { useInView } from 'react-intersection-observer';
import SearchResults from '~/components/shared/SearchResults';

export default function Explore() {
  const { ref, inView } = useInView();
  const [searchValue, setSearchValue] = useState('');
  const debouncedSearchValue = useDebounce(searchValue, { wait: 500 });

  const { data: posts, hasNextPage, fetchNextPage } = useGetPostsQuery();

  const { data: searchedPosts, isFetching: isSearchFetching } =
    useSearchPostsQuery(debouncedSearchValue);

  useEffect(() => {
    if (inView && !searchValue) fetchNextPage();
  }, [inView, searchValue]);

  if (!posts) return <div className="flex-center w-full h-full">Loading...</div>;

  const shouldShowSearchResults = searchValue !== '';
  const shouldShowPosts =
    !shouldShowSearchResults && posts.pages.every((item) => item?.rows.length === 0);

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
        {shouldShowSearchResults ? (
          <SearchResults isSearchFetching={isSearchFetching} searchedPosts={searchedPosts} />
        ) : shouldShowPosts ? (
          <p className="mt-10 text-center w-full">End of posts</p>
        ) : (
          posts.pages.map((item, index) => (
            <GridPostList key={`page-${index}`} posts={item?.rows} />
          ))
        )}
      </div>

      {hasNextPage && !searchValue && (
        <div ref={ref} className="mt-10">
          Loading...
        </div>
      )}
    </div>
  );
}
