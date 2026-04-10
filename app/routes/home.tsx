import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import PostCard from '../features/post/components/PostCard';
import { useGetRecentPostsQuery } from '../features/post/queries/post.queries';
import type { Route } from './+types/home';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ];
}

export default function Home() {
  const { data: posts, isPending, isError, error, refetch, isFetching } = useGetRecentPostsQuery();

  let content: React.ReactNode;

  if (isPending) {
    content = (
      <PageLoadingState
        title="Loading your feed"
        description="Please wait while we load the latest posts."
        className="px-0 py-4"
      />
    );
  } else if (isError) {
    content = (
      <PageErrorState
        title="Failed to load your feed"
        description={error instanceof Error ? error.message : 'Please try again in a moment.'}
        onRetry={() => void refetch()}
        isRetrying={isFetching}
        className="px-0 py-4"
      />
    );
  } else if (posts.length === 0) {
    content = (
      <PageEmptyState
        title="No posts yet"
        description="Follow creators or publish the first post to start filling your feed."
        className="px-0 py-4"
      />
    );
  } else {
    content = (
      <ul className="flex flex-col flex-1 gap-9 w-full">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col items-center gap-10 px-5 py-10 md:px-8 lg:p-14">
      <div className="flex w-full max-w-screen-sm flex-col items-center gap-6 md:gap-9">
        <h2 className="text-left w-full">Home Feed</h2>
        {content}
      </div>
    </div>
  );
}
