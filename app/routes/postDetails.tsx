import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import RouteErrorState from '~/components/feedback/route-error-state';
import { Button } from '~/components/ui/button';
import PostMediaCarousel from '~/features/post/components/PostMediaCarousel';
import PostStats from '~/features/post/components/PostStats';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import { useDeletePostMutation } from '~/features/post/queries/post.mutation';
import { useGetPostByIdQuery } from '~/features/post/queries/post.queries';
import { Link, useNavigate, useParams } from 'react-router';
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
      <div className="flex flex-col xl:flex-row w-full max-w-5xl rounded-[30px] border xl:rounded-l-[24px]">
        <div className="p-5 xl:w-[48%] xl:shrink-0">
          <PostMediaCarousel
            media={post.media}
            altBase={post.caption || `${post.creator.name}'s post media`}
            className="rounded-[24px]"
          />
        </div>
        <div className="flex flex-col gap-5 lg:gap-7 flex-1 items-start p-8 rounded-[30px]">
          <div className="flex justify-between items-center w-full">
            <Link to={`/profile/${post.creator.id}`} className="flex items-center gap-3">
              <img
                src={post.creator.imageUrl || '/assets/icons/profile-placeholder.svg'}
                alt="creator"
                className="w-8 h-8 lg:w-12 lg:h-12 rounded-full"
              />
              <div className="flex gap-1 flex-col">
                <p>{post.creator.name}</p>
                <div className="flex justify-center items-center gap-2">
                  <p>{post.createdAt}</p>•<p>{post.location}</p>
                </div>
              </div>
            </Link>
            <div className="flex justify-center items-center gap-4">
              <Link
                to={`/update-post/${post.id}`}
                className={currentUserProfileId !== post.creator.id ? 'hidden' : ''}
              >
                <img src={'/assets/icons/edit.svg'} alt="edit" width={24} height={24} />
              </Link>
              <Button
                onClick={handleDeletePost}
                variant="ghost"
                className={currentUserProfileId !== post.creator.id ? 'hidden' : ''}
              >
                <img src={'/assets/icons/delete.svg'} alt="delete" width={24} height={24} />
              </Button>
            </div>
          </div>

          <hr className="border w-full" />

          <div className="flex flex-col flex-1 w-full">
            <p>{post.caption}</p>
            <ul className="flex gap-1 mt-2">
              {post.tags.map((tag, index) => (
                <li key={`${tag}${index}`}>#{tag}</li>
              ))}
            </ul>
          </div>

          <div className="w-full">
            <PostStats
              post={post}
              viewerProfileId={currentUserProfileId}
            />
          </div>
        </div>
      </div>
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
