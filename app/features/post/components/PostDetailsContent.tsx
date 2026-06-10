import type { ReactNode } from 'react';
import { SquarePen, Trash2, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '~/lib/utils';
import PostMediaCarousel from './PostMediaCarousel';
import PostStats from './PostStats';
import type { PostDetailViewModel } from '../types/post.type';

type PostDetailsContentProps = {
  post: PostDetailViewModel;
  viewerProfileId: string;
  onDeletePost: () => void;
  headerLeadingAction?: ReactNode;
};

type PostDetailsHeaderProps = {
  post: PostDetailViewModel;
  viewerProfileId: string;
  onDeletePost: () => void;
  leadingAction?: ReactNode;
  className?: string;
};

function padDatePart(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatPostDetailsCreatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function PostDetailsHeader({
  post,
  viewerProfileId,
  onDeletePost,
  leadingAction,
  className,
}: PostDetailsHeaderProps) {
  const hasCreatorAvatar =
    typeof post.creator.imageUrl === 'string' && post.creator.imageUrl.trim().length > 0;
  const isOwner = viewerProfileId === post.creator.id;
  const formattedCreatedAt = formatPostDetailsCreatedAt(post.createdAt);

  return (
    <div className={cn('flex w-full items-center justify-between', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {leadingAction ? <div className="shrink-0">{leadingAction}</div> : null}

        <Link to={`/profile/${post.creator.id}`} className="flex min-w-0 items-center gap-3">
          {hasCreatorAvatar ? (
            <img
              src={post.creator.imageUrl ?? undefined}
              alt={post.creator.name}
              className="h-8 w-8 rounded-full object-cover lg:h-12 lg:w-12"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-soft text-ink-subtle lg:h-12 lg:w-12">
              <UserRound aria-hidden="true" className="size-4 lg:size-6" />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate">{post.creator.name}</p>
            <div className="flex items-center gap-2 text-sm text-ink-subtle">
              <p className="truncate">{formattedCreatedAt}</p>
              <span aria-hidden="true">•</span>
              <p className="truncate">{post.location}</p>
            </div>
          </div>
        </Link>
      </div>

      <div className={cn('flex items-center justify-center gap-4', !isOwner && 'hidden')}>
        <Link to={`/update-post/${post.id}`}>
          <SquarePen className="size-6" aria-hidden="true" />
        </Link>
        <button type="button" onClick={onDeletePost} className="cursor-pointer">
          <Trash2 className="size-6 text-destructive" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function PostDetailsContent({
  post,
  viewerProfileId,
  onDeletePost,
  headerLeadingAction,
}: PostDetailsContentProps) {
  return (
    <div
      className={cn(
        'flex w-full max-w-none flex-col border-0 bg-card shadow-none lg:w-full lg:max-w-none lg:flex-row lg:[--interaction-width:360px] lg:shadow-2xl xl:[--interaction-width:400px] 2xl:[--interaction-width:440px]',
      )}
    >
      <PostDetailsHeader
        post={post}
        viewerProfileId={viewerProfileId}
        onDeletePost={onDeletePost}
        leadingAction={headerLeadingAction}
        className="p-5 lg:hidden"
      />

      <div
        className={cn(
          'h-[calc(133.333vw)] max-h-[60vw] min-h-[50vw] max-w-full lg:h-full lg:min-h-0 lg:w-auto lg:max-w-[calc(100%-var(--interaction-width))] lg:max-h-none lg:shrink-0',
        )}
      >
        <PostMediaCarousel
          media={post.media}
          altBase={post.caption || `${post.creator.name}'s post media`}
          className="h-full w-full"
          enablePreview
          postId={post.id}
          creatorName={post.creator.name}
        />
      </div>

      <div
        className={cn(
          'flex flex-1 flex-col items-start gap-5 p-8 lg:gap-7',
          'lg:w-(--interaction-width) lg:flex-none',
        )}
      >
        <PostDetailsHeader
          post={post}
          viewerProfileId={viewerProfileId}
          onDeletePost={onDeletePost}
          className="hidden lg:flex"
        />

        <hr className="hidden lg:block w-full border" />

        <div className="flex w-full flex-1 flex-col">
          <p>{post.caption}</p>
          <ul className="mt-2 flex gap-1">
            {post.tags.map((tag, index) => (
              <li key={`${tag}${index}`}>#{tag}</li>
            ))}
          </ul>
        </div>

        <div className="w-full">
          <PostStats post={post} viewerProfileId={viewerProfileId} />
        </div>
      </div>
    </div>
  );
}
