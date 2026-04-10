import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import GridPostList from './GridPostList';
import type { PostGridItemViewModel } from '../types/post.type';

type SearchResultsProps = {
  searchTerm: string;
  isSearchPending: boolean;
  isSearchError: boolean;
  searchError: unknown;
  onRetry: () => void;
  searchedPosts?: PostGridItemViewModel[];
};

export default function SearchResults({
  searchTerm,
  isSearchPending,
  isSearchError,
  searchError,
  onRetry,
  searchedPosts,
}: SearchResultsProps) {
  if (isSearchPending) {
    return (
      <PageLoadingState
        title="Searching posts"
        description={`Looking for posts matching "${searchTerm}".`}
        className="px-0 py-4"
      />
    );
  }

  if (isSearchError) {
    return (
      <PageErrorState
        title="Search failed"
        description={
          searchError instanceof Error
            ? searchError.message
            : 'We could not load search results. Please try again.'
        }
        onRetry={onRetry}
        className="px-0 py-4"
      />
    );
  }

  if (searchedPosts && searchedPosts.length !== 0) {
    return <GridPostList posts={searchedPosts} />;
  }

  return (
    <PageEmptyState
      title="No matching posts"
      description={`We could not find posts matching "${searchTerm}".`}
      className="px-0 py-4"
    />
  );
}
