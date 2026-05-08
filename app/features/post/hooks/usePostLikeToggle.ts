import { useEffect, useState } from 'react';
import {
  useCreateViewerPostLikeMutation,
  useDeleteViewerPostLikeMutation,
} from '../queries/post.engagement.mutations';

type UsePostLikeToggleOptions = {
  postId: string;
  viewerProfileId: string;
  initialIsLiked: boolean;
  initialLikeCount: number;
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
}: UsePostLikeToggleOptions): UsePostLikeToggleResult {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const { mutateAsync: createViewerPostLike, isPending: isCreatePending } =
    useCreateViewerPostLikeMutation();
  const { mutateAsync: deleteViewerPostLike, isPending: isDeletePending } =
    useDeleteViewerPostLikeMutation();

  useEffect(() => {
    setIsLiked(initialIsLiked);
  }, [initialIsLiked, postId]);

  useEffect(() => {
    setLikeCount(initialLikeCount);
  }, [initialLikeCount, postId]);

  async function toggleLike() {
    if (!viewerProfileId) {
      return false;
    }

    const previousIsLiked = isLiked;
    const previousLikeCount = likeCount;

    try {
      if (isLiked) {
        setIsLiked(false);
        setLikeCount((currentCount) => Math.max(0, currentCount - 1));
        await deleteViewerPostLike({ postId });
        return false;
      }

      setIsLiked(true);
      setLikeCount((currentCount) => currentCount + 1);
      await createViewerPostLike({ postId });
      return true;
    } catch {
      setIsLiked(previousIsLiked);
      setLikeCount(previousLikeCount);
      return previousIsLiked;
    }
  }

  return {
    isLiked,
    likeCount,
    isPending: isCreatePending || isDeletePending,
    toggleLike,
  };
}
