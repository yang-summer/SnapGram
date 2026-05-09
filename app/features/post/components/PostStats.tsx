import { Bookmark, Heart } from 'lucide-react';
import { usePostLikeToggle } from '../hooks/usePostLikeToggle';
import {
  useCreateViewerPostSaveMutation,
  useDeleteViewerPostSaveMutation,
  useViewerPostSavePending,
} from '../queries/post.engagement.mutations';
import { useViewerSavedPostQuery } from '../queries/post.engagement.queries';

type PostStatsProps = {
  post: {
    id: string;
    likeCount: number;
    saveCount: number;
  };
  viewerProfileId: string;
};

export default function PostStats({ post, viewerProfileId }: PostStatsProps) {
  const engagementTarget = {
    viewerProfileId,
    postId: post.id,
  };
  const { data: viewerSavedPost } = useViewerSavedPostQuery(viewerProfileId, post.id);
  const { mutateAsync: createViewerPostSave } = useCreateViewerPostSaveMutation(engagementTarget);
  const { mutateAsync: deleteViewerPostSave } = useDeleteViewerPostSaveMutation(engagementTarget);
  const {
    isLiked,
    likeCount,
    isPending: isLikePending,
    toggleLike: handleToggleLike,
  } = usePostLikeToggle({
    postId: post.id,
    viewerProfileId,
    initialIsLiked: false,
    initialLikeCount: post.likeCount,
  });
  const isSaved = viewerSavedPost !== null && typeof viewerSavedPost !== 'undefined';
  const saveCount = post.saveCount;
  const isSavePending = useViewerPostSavePending(engagementTarget);
  const canLike = viewerProfileId.length > 0 && !isLikePending;
  const canSave = viewerProfileId.length > 0 && !isSavePending;

  async function handleLikePost(e: React.MouseEvent) {
    e.stopPropagation();

    if (!canLike) {
      return;
    }

    await handleToggleLike();
  }

  async function handleSavePost(e: React.MouseEvent) {
    e.stopPropagation();

    if (!canSave) {
      return;
    }

    if (isSaved) {
      try {
        await deleteViewerPostSave();
      } catch {
        return;
      }

      return;
    }

    try {
      await createViewerPostSave();
    } catch {
      return;
    }
  }

  return (
    <div className="flex justify-between items-center z-20">
      <div className="flex gap-2 mr-5 items-center">
        <button
          type="button"
          disabled={!canLike}
          aria-pressed={isLiked}
          aria-label={isLiked ? 'Unlike post' : 'Like post'}
          onClick={(e) => void handleLikePost(e)}
          className="flex items-center justify-center disabled:cursor-default disabled:opacity-70"
        >
          <Heart
            aria-hidden="true"
            className={isLiked ? 'size-5 fill-current text-primary' : 'size-5'}
          />
        </button>
        <p>{likeCount}</p>
      </div>
      <div className="flex gap-2 items-center">
        <button
          type="button"
          disabled={!canSave}
          aria-pressed={isSaved}
          aria-label={isSaved ? 'Remove post from saved items' : 'Save post'}
          onClick={(e) => void handleSavePost(e)}
          className="flex items-center justify-center disabled:cursor-default disabled:opacity-70"
        >
          <Bookmark
            aria-hidden="true"
            className={isSaved ? 'size-5 fill-current text-primary' : 'size-5'}
          />
        </button>
        <p>{saveCount}</p>
      </div>
    </div>
  );
}
