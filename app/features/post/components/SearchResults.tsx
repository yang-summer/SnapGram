import GridPostList from './GridPostList';
import type { PostGridItemViewModel } from '../types/post.type';

type SearchResultsProps = {
  isSearchFetching: boolean;
  searchedPosts?: PostGridItemViewModel[];
};

export default function SearchResults({ isSearchFetching, searchedPosts }: SearchResultsProps) {
  if (isSearchFetching) return <div>Loading...</div>;

  if (searchedPosts && searchedPosts.length !== 0) {
    return <GridPostList posts={searchedPosts} />;
  }

  return <p>No results found</p>;
}
