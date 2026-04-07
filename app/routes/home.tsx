import { useGetRecentPostsQuery } from '../features/post/queries/post.queries';
import type { Route } from './+types/home';
import PostCard from '../features/post/components/PostCard';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ];
}

export default function Home() {
  const { data: posts, isPending, isError, error, refetch } = useGetRecentPostsQuery();

  let content: React.ReactNode;

  if (isPending) {
    content = <p>Loading posts...</p>;
  } else if (isError) {
    content = (
      <div className="w-full rounded-2xl border p-6 text-center">
        <p>Failed to load posts.</p>
        <p className="mt-2 text-sm opacity-70">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <button onClick={() => refetch()} className="mt-4">
          Retry
        </button>
      </div>
    );
  } else if (posts.length === 0) {
    content = (
      <div className="w-full rounded-2xl border p-6 text-center">
        <p>No posts yet.</p>
      </div>
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
    <div className="flex flex-col items-center gap-10 py-10 px-5 md:px-8 lg:p-14">
      <div className="max-w-screen-sm flex flex-col items-center w-full gap-6 md:gap-9">
        <h2 className="text-left w-full">Home Feed</h2>
        {content}
      </div>
    </div>
  );
}
