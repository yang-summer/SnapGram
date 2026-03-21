import { useGetRecentPostsQuery } from '~/lib/react-query/queriesAndMutations';
import type { Route } from './+types/home';
import PostCard from '~/components/shared/PostCard';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ];
}

export default function Home() {
  const { data: posts, isPending: isPostLoading, isError: isErrorPosts } = useGetRecentPostsQuery();

  return (
    <div className="flex flex-col items-center gap-10 py-10 px-5 md:px-8 lg:p-14">
      <div className="max-w-screen-sm flex flex-col items-center w-full gap-6 md:gap-9">
        <h2 className="text-left w-full">Home Feed</h2>
        {isPostLoading && !posts ? (
          <p>loading</p>
        ) : (
          <ul className="flex flex-col flex-1 gap-9 w-full">
            {posts?.rows.map((post) => (
              <PostCard key={post.$id} post={post} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
