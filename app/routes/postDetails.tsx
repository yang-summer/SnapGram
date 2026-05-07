import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import RouteErrorState from '~/components/feedback/route-error-state';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import PostDetailsContent from '~/features/post/components/PostDetailsContent';
import { useDeletePostMutation } from '~/features/post/queries/post.mutation';
import { useGetPostByIdQuery } from '~/features/post/queries/post.queries';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import type { Route } from './+types/postDetails';

export default function PostDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;
  const currentUserProfileId = currentUser?.profileId ?? '';

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

  let content: React.ReactNode;

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
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-10 overflow-scroll px-5 py-10 md:p-14">
      {content}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <div className="flex flex-col items-center gap-10 overflow-scroll px-5 py-10 md:p-14">
      <RouteErrorState error={error} className="px-0 py-4" />
    </div>
  );
}
