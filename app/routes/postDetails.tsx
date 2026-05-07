import type { ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import RouteErrorState from '~/components/feedback/route-error-state';
import { Button } from '~/components/ui/button';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import PostDetailsContent from '~/features/post/components/PostDetailsContent';
import type { PostDetailNavigationState } from '~/features/post/lib/post-detail-navigation';
import { useDeletePostMutation } from '~/features/post/queries/post.mutation';
import { useGetPostByIdQuery } from '~/features/post/queries/post.queries';
import { useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import type { Route } from './+types/postDetails';

type PostDetailsPageShellProps = {
  children: ReactNode;
};

function PostDetailsPageShell({ children }: PostDetailsPageShellProps) {
  return (
    <div className="flex flex-col items-center gap-10 overflow-scroll px-5 py-10 md:p-14">
      {children}
    </div>
  );
}

type PostDetailsModalShellProps = {
  children: ReactNode;
  onClose: () => void;
};

function PostDetailsModalShell({ children, onClose }: PostDetailsModalShellProps) {
  return (
    <div
      className="h-full w-full bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Post details"
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className="hidden lg:flex fixed top-5 left-5 z-10 h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/70"
        aria-label="Close post details"
      >
        <X className="size-5" />
      </button>

      <div className="h-full w-full overflow-y-auto overscroll-contain">
        <div className="flex min-h-full w-full items-start justify-center lg:items-center lg:p-6 xl:p-10">
          <div
            className="flex w-full max-w-6xl justify-center"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

type PostDetailsShellProps = {
  isModal: boolean;
  onClose: () => void;
  children: ReactNode;
};

function PostDetailsShell({ isModal, onClose, children }: PostDetailsShellProps) {
  if (isModal) {
    return <PostDetailsModalShell onClose={onClose}>{children}</PostDetailsModalShell>;
  }

  return <PostDetailsPageShell>{children}</PostDetailsPageShell>;
}

export default function PostDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;
  const currentUserProfileId = currentUser?.profileId ?? '';
  const locationState = location.state as PostDetailNavigationState | null;
  const isModal = Boolean(locationState?.backgroundLocation);

  if (!id) {
    throw new Error('PostDetails route requires a post id.');
  }

  const postId = id;
  const { data: post, isPending, isError, error, refetch, isFetching } = useGetPostByIdQuery(postId);
  const { mutateAsync: deletePost } = useDeletePostMutation();

  async function handleDeletePost() {
    try {
      const result = await deletePost(postId);

      if (result.mediaCleanupFailed) {
        console.warn('Post row deleted, but media cleanup failed.');
        toast.warning('Post deleted, but some media cleanup could not be completed.');
      } else {
        toast.success('Post deleted successfully.');
      }

      navigate(-1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete post. Please try again.');
    }
  }

  function handleClose() {
    navigate(-1);
  }

  const mobileCloseButton = isModal ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClose}
      className="rounded-full text-ink-strong"
      aria-label="Close post details"
    >
      <ArrowLeft className="size-5" />
    </Button>
  ) : null;

  let content: ReactNode;

  if (isPending) {
    content = (
      <PageLoadingState
        title="Loading post"
        description="Please wait while we load the post details."
        className="px-0 py-4"
      />
    );
  } else if (isError) {
    content = (
      <PageErrorState
        title="Failed to load post"
        description={error instanceof Error ? error.message : 'Please try again in a moment.'}
        onRetry={() => void refetch()}
        isRetrying={isFetching}
        className="px-0 py-4"
      />
    );
  } else if (post === null) {
    content = (
      <PageEmptyState
        title="Post not found"
        description="This post may have been removed or is no longer available."
        className="px-0 py-4"
      />
    );
  } else {
    content = (
      <PostDetailsContent
        post={post}
        viewerProfileId={currentUserProfileId}
        onDeletePost={handleDeletePost}
        headerLeadingAction={mobileCloseButton}
        className={
          isModal
            ? 'max-w-none rounded-none border-0 bg-card shadow-none lg:max-w-5xl lg:rounded-[30px] lg:border lg:shadow-2xl'
            : undefined
        }
      />
    );
  }

  return <PostDetailsShell isModal={isModal} onClose={handleClose}>{content}</PostDetailsShell>;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <PostDetailsPageShell>
      <RouteErrorState error={error} className="px-0 py-4" />
    </PostDetailsPageShell>
  );
}
