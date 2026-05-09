import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import RouteErrorState from '~/components/feedback/route-error-state';
import { SquarePen } from 'lucide-react';
import PostForm from '~/features/post/components/PostForm';
import { useGetPostEditorQuery } from '~/features/post/queries/post.queries';
import { useParams } from 'react-router';
import type { Route } from './+types/editPost';

export default function EditPost() {
  const { id } = useParams();
  if (!id) {
    throw new Error('EditPost route requires a post id.');
  }

  const postId = id;
  const { data: post, isPending, isError, error, refetch, isFetching } =
    useGetPostEditorQuery(postId);

  if (isPending) {
    return (
      <div className="flex">
        <div className="flex flex-1 flex-col items-center gap-10 px-5 py-10 md:px-8 lg:px-14 lg:pt-10 lg:pb-14">
          <div className="flex justify-start items-center gap-3 max-w-5xl w-full">
            <SquarePen className="size-9" aria-hidden="true" />
            <h2 className="text-[24px] font-bold leading-[140%] tracking-tighter w-full text-left">
              Edit Post
            </h2>
          </div>
          <PageLoadingState
            title="Loading post editor"
            description="Please wait while we load the post data."
            className="px-0 py-4"
          />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex">
        <div className="flex flex-1 flex-col items-center gap-10 px-5 py-10 md:px-8 lg:px-14 lg:pt-10 lg:pb-14">
          <div className="flex justify-start items-center gap-3 max-w-5xl w-full">
            <SquarePen className="size-9" aria-hidden="true" />
            <h2 className="text-[24px] font-bold leading-[140%] tracking-tighter w-full text-left">
              Edit Post
            </h2>
          </div>
          <PageErrorState
            title="Failed to load the post editor"
            description={error instanceof Error ? error.message : 'Please try again in a moment.'}
            onRetry={() => void refetch()}
            isRetrying={isFetching}
            className="px-0 py-4"
          />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex">
        <div className="flex flex-1 flex-col items-center gap-10 px-5 py-10 md:px-8 lg:px-14 lg:pt-10 lg:pb-14">
          <div className="flex justify-start items-center gap-3 max-w-5xl w-full">
            <SquarePen className="size-9" aria-hidden="true" />
            <h2 className="text-[24px] font-bold leading-[140%] tracking-tighter w-full text-left">
              Edit Post
            </h2>
          </div>
          <PageEmptyState
            title="Post not found"
            description="This post may have been removed or is no longer available."
            className="px-0 py-4"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="flex flex-col flex-1 items-center gap-10 py-10 px-5 md:px-8 lg:px-14 lg:pt-10 lg:pb-14">
        <div className="flex justify-start items-center gap-3 max-w-5xl w-full">
          <SquarePen className="size-9" aria-hidden="true" />
          <h2 className="text-[24px] font-bold leading-[140%] tracking-tighter w-full text-left">
            Edit Post
          </h2>
        </div>
        <PostForm action="Update" post={post} />
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <div className="flex">
      <div className="flex flex-1 flex-col items-center gap-10 px-5 py-10 md:px-8 lg:px-14 lg:pt-10 lg:pb-14">
        <div className="flex justify-start items-center gap-3 max-w-5xl w-full">
          <SquarePen className="size-9" aria-hidden="true" />
          <h2 className="text-[24px] font-bold leading-[140%] tracking-tighter w-full text-left">
            Edit Post
          </h2>
        </div>
        <RouteErrorState error={error} className="px-0 py-4" />
      </div>
    </div>
  );
}
