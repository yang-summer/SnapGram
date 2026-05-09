import { UserRound } from 'lucide-react';
import { Link } from 'react-router';
import PostStats from './PostStats';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import {
  buildStandalonePostHref,
  useOptionalContextualPostRoute,
} from '../lib/contextual-post-route';
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
  const contextualPostRoute = useOptionalContextualPostRoute();
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;
  const currentUserProfileId = currentUser?.profileId ?? '';
  return (
    <ul className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-7 max-w-5xl">
      {posts.map((post) => (
        <li key={post.id} className="relative min-w-80 h-80">
          {/*
            Prefer the active contextual route when available so parent pages can
            render modal subroutes; otherwise fall back to the standalone detail page.
          */}
          <Link
            {...(contextualPostRoute
              ? contextualPostRoute.buildPostLink(post.id)
              : { to: buildStandalonePostHref(post.id) })}
            className="flex rounded-[24px] border overflow-hidden cursor-pointer w-full h-full"
          >
            <img src={post.imageUrl} alt="post" className="w-full h-full object-cover" />
          </Link>

          <div className="absolute bottom-0 p-5 flex justify-between items-center w-full bg-linear-to-t from-gray-900 to-transparent rounded-b-[24px] gap-2">
            {showUser && (
              <div className="flex flex-1 items-center justify-start gap-2">
                {post.creator.imageUrl ? (
                  <img
                    src={post.creator.imageUrl}
                    alt="creator"
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-soft/90 text-white">
                    <UserRound aria-hidden="true" className="size-4" />
                  </div>
                )}
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
