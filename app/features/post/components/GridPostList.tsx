import { Link } from 'react-router';
import PostStats from './PostStats';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import type { PostGridItemViewModel } from '../types/post.type';

type GridPostListProps = {
  posts: PostGridItemViewModel[];
  showUser?: boolean;
  showStats?: boolean;
};

export default function GridPostList({
  posts,
  showUser = true,
  showStats = true,
}: GridPostListProps) {
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;
  const currentUserProfileId = currentUser?.profileId ?? '';
  return (
    <ul className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-7 max-w-5xl">
      {posts.map((post) => (
        <li key={post.id} className="relative min-w-80 h-80">
          <Link
            to={`/posts/${post.id}`}
            className="flex rounded-[24px] border overflow-hidden cursor-pointer w-full h-full"
          >
            <img src={post.imageUrl} alt="post" className="w-full h-full object-cover" />
          </Link>

          <div className="absolute bottom-0 p-5 flex justify-between items-center w-full bg-linear-to-t from-gray-900 to-transparent rounded-b-[24px] gap-2">
            {showUser && (
              <div className="flex flex-1 items-center justify-start gap-2">
                <img
                  src={post.creator.imageUrl || '/assets/icons/profile-placeholder.svg'}
                  alt="creator"
                  className="h-8 w-8 rounded-full"
                />
                <p className="line-clamp-1">{post.creator.name}</p>
              </div>
            )}
            {showStats && (
              <PostStats
                post={post}
                viewerProfileId={currentUserProfileId}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
