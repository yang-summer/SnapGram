import { ImageOff, SquarePen, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import {
  buildStandalonePostHref,
  useOptionalContextualPostRoute,
} from '../lib/contextual-post-route';
import PostStats from './PostStats';
import type { PostCardViewModel } from '../types/post.type';

type PostCardProps = {
  post: PostCardViewModel;
};

export default function PostCard({ post }: PostCardProps) {
  const contextualPostRoute = useOptionalContextualPostRoute();
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;
  const currentUserProfileId = currentUser?.profileId ?? '';
  const postDetailLinkProps = contextualPostRoute
    ? contextualPostRoute.buildPostLink(post.id)
    : { to: buildStandalonePostHref(post.id) };

  if (!post.creator) return null;

  return (
    <div className="rounded-3xl border border-amber-900 p-5 lg:p-7 w-full max-w-screen-sm">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.creator.id}`}>
            {post.creator.imageUrl ? (
              <img
                src={post.creator.imageUrl}
                alt="creator"
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft text-ink-subtle">
                <UserRound aria-hidden="true" className="size-6" />
              </div>
            )}
          </Link>
          <div className="flex flex-col">
            <p>{post.creator.name}</p>
            <div className="flex items-center gap-2">
              <p>{post.createdAt}</p>-<p>{post.location}</p>
            </div>
          </div>
        </div>
        <Link
          to={`/update-post/${post.id}`}
          className={currentUserProfileId !== post.creator.id ? 'hidden' : ''}
        >
          <SquarePen aria-hidden="true" className="size-5" />
        </Link>
      </div>
      <Link {...postDetailLinkProps}>
        <div>
          <p>{post.caption}</p>
          <ul className="flex gap-1 mt-2">
            {post.tags?.map((tag: string) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        </div>
        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            className="h-64 xs:h-[400px] lg:h-112.5 w-full rounded-[24px] object-cover mb-5"
            alt="post image"
          />
        ) : (
          <div className="mb-5 flex h-64 w-full items-center justify-center rounded-[24px] bg-surface-soft text-ink-subtle xs:h-[400px] lg:h-112.5">
            <ImageOff aria-hidden="true" className="size-10" />
          </div>
        )}
      </Link>
      <PostStats
        post={post}
        viewerProfileId={currentUserProfileId}
      />
    </div>
  );
}
