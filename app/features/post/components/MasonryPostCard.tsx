import { Heart, ImageOff, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { usePostLikeToggle } from '../hooks/usePostLikeToggle';
import { createPostDetailNavigationState } from '../lib/post-detail-navigation';
import ProgressiveImage from './ProgressiveImage';
import type { HomeFeedPostViewModel } from '../types/post.type';

type MasonryPostCardProps = {
  post: HomeFeedPostViewModel;
  viewerProfileId?: string;
  initialIsLiked?: boolean;
};

export default function MasonryPostCard({
  post,
  viewerProfileId = '',
  initialIsLiked = false,
}: MasonryPostCardProps) {
  const location = useLocation();
  const postDetailState = createPostDetailNavigationState(location);
  const {
    isLiked,
    likeCount,
    isPending: isLikePending,
    toggleLike,
  } = usePostLikeToggle({
    postId: post.id,
    viewerProfileId,
    initialIsLiked,
    initialLikeCount: post.likeCount,
    queryEnabled: false,
  });
  const imageAlt =
    post.caption.trim().length > 0 ? post.caption : `${post.creator.name}'s post cover`;
  const hasCoverImage = post.imageUrl.trim().length > 0;
  const hasCreatorAvatar =
    typeof post.creator.imageUrl === 'string' && post.creator.imageUrl.length > 0;

  async function handleLikeClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    await toggleLike();
  }

  return (
    <article className="min-w-0 overflow-hidden rounded-2xl bg-card text-card-foreground">
      <Link
        to={`/posts/${post.id}`}
        state={postDetailState}
        preventScrollReset
        className="block rounded-2xl outline -outline-offset-1 outline-black/10"
      >
        {hasCoverImage ? (
          <ProgressiveImage
            src={post.imageUrl}
            alt={imageAlt}
            aspectRatioBucket={post.aspectRatioBucket}
            placeholder={post.imagePlaceholder}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-2xl bg-surface-soft text-ink-subtle"
            style={{ aspectRatio: 3 / 4 }}
          >
            <ImageOff aria-hidden="true" className="size-8" />
          </div>
        )}
      </Link>

      <div className="flex flex-col gap-2 p-3">
        <Link
          to={`/posts/${post.id}`}
          state={postDetailState}
          preventScrollReset
          className="line-clamp-2 text-sm leading-5 font-medium text-ink-strong"
        >
          {post.caption || 'Untitled post'}
        </Link>

        <div className="flex items-center justify-between gap-3">
          <Link to={`/profile/${post.creator.id}`} className="flex min-w-0 items-center gap-2">
            {hasCreatorAvatar ? (
              <img
                src={post.creator.imageUrl ?? undefined}
                alt={post.creator.name}
                className="size-6 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-soft text-ink-subtle">
                <UserRound aria-hidden="true" className="size-4" />
              </div>
            )}
            <span className="truncate text-sm text-ink-medium">{post.creator.name}</span>
          </Link>

          <button
            type="button"
            disabled={!viewerProfileId || isLikePending}
            aria-pressed={isLiked}
            aria-label={isLiked ? 'Unlike post' : 'Like post'}
            onClick={(event) => void handleLikeClick(event)}
            className="flex shrink-0 items-center gap-1 text-sm text-ink-subtle cursor-pointer disabled:cursor-default disabled:opacity-70"
          >
            <Heart
              aria-hidden="true"
              className={isLiked ? 'size-4 fill-current text-primary' : 'size-4'}
            />
            <span>{likeCount}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
