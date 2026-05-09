import {
  useCreateViewerPostLikeMutation,
  useDeleteViewerPostLikeMutation,
  useViewerPostLikePending,
} from '../queries/post.engagement.mutations';
import { useViewerLikedPostQuery } from '../queries/post.engagement.queries';

type UsePostLikeToggleOptions = {
  postId: string;
  viewerProfileId: string;
  initialIsLiked: boolean;
  initialLikeCount: number;
  queryEnabled?: boolean;
};

type UsePostLikeToggleResult = {
  isLiked: boolean;
  likeCount: number;
  isPending: boolean;
  toggleLike: () => Promise<boolean>;
};

export function usePostLikeToggle({
  postId,
  viewerProfileId,
  initialIsLiked,
  initialLikeCount,
  queryEnabled = true,
}: UsePostLikeToggleOptions): UsePostLikeToggleResult {
  const engagementTarget = {
    viewerProfileId,
    postId,
  };
  const { data: viewerLikedPost } = useViewerLikedPostQuery(viewerProfileId, postId, {
    enabled: queryEnabled,
  });
  const { mutateAsync: createViewerPostLike } = useCreateViewerPostLikeMutation(engagementTarget);
  const { mutateAsync: deleteViewerPostLike } = useDeleteViewerPostLikeMutation(engagementTarget);
  const isPending = useViewerPostLikePending(engagementTarget);
  const isLiked =
    typeof viewerLikedPost === 'undefined' ? initialIsLiked : viewerLikedPost !== null;
  const likeCount = initialLikeCount;

  async function toggleLike() {
    if (!viewerProfileId) {
      return false;
    }

    try {
      if (isLiked) {
        await deleteViewerPostLike();
        return false;
      }

      await createViewerPostLike();
      return true;
    } catch {
      return isLiked;
    }
  }

  return {
    isLiked,
    likeCount,
    isPending,
    toggleLike,
  };
}
