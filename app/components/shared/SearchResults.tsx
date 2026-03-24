import type { Models } from 'appwrite';
import GridPostList from './GridPostList';

type SearchResultsProps = {
  isSearchFetching: boolean;
  searchedPosts: Models.Row[];
};

export default function SearchResults({ isSearchFetching, searchedPosts }: SearchResultsProps) {
  if (isSearchFetching) return <div>Loading...</div>;

  if (searchedPosts && searchedPosts.rows.length !== 0) {
    return <GridPostList posts={searchedPosts.rows} />;
  }

  return <p>No results found</p>;
}
