import { useEffect, useState } from 'react';
import { Bookmark, Heart } from 'lucide-react';
import { usePostLikeToggle } from '../hooks/usePostLikeToggle';
import {
  useCreateViewerPostSaveMutation,
  useDeleteViewerPostSaveMutation,
} from '../queries/post.engagement.mutations';
import {
  useViewerLikedPostQuery,
  useViewerSavedPostQuery,
} from '../queries/post.engagement.queries';

type PostStatsProps = {
  post: {
    id: string;
    likeCount: number;
    saveCount: number;
  };
  viewerProfileId: string;
};

export default function PostStats({ post, viewerProfileId }: PostStatsProps) {
  const [saveCount, setSaveCount] = useState(post.saveCount);
  const [isSaved, setIsSaved] = useState(false);
  const { data: viewerLikedPost } = useViewerLikedPostQuery(viewerProfileId, post.id);
  const { data: viewerSavedPost } = useViewerSavedPostQuery(viewerProfileId, post.id);
  const { mutateAsync: createViewerPostSave } = useCreateViewerPostSaveMutation();
  const { mutateAsync: deleteViewerPostSave } = useDeleteViewerPostSaveMutation();
  const {
    isLiked,
    likeCount,
    toggleLike: handleToggleLike,
  } = usePostLikeToggle({
    postId: post.id,
    viewerProfileId,
    initialIsLiked: !!viewerLikedPost,
    initialLikeCount: post.likeCount,
  });

  useEffect(() => {
    setSaveCount(post.saveCount);
  }, [post.id, post.saveCount]);

  useEffect(() => {
    setIsSaved(!!viewerSavedPost);
  }, [viewerSavedPost]);

  async function handleLikePost(e: React.MouseEvent) {
    e.stopPropagation();
    await handleToggleLike();
  }

  async function handleSavePost(e: React.MouseEvent) {
    e.stopPropagation();

    if (!viewerProfileId) {
      return;
    }

    if (isSaved) {
      const previousIsSaved = isSaved;
      const previousSaveCount = saveCount;
      setIsSaved(false);
      setSaveCount((currentCount) => Math.max(0, currentCount - 1));

      try {
        await deleteViewerPostSave({
          postId: post.id,
        });
      } catch {
        setIsSaved(previousIsSaved);
        setSaveCount(previousSaveCount);
      }

      return;
    }

    const previousIsSaved = isSaved;
    const previousSaveCount = saveCount;
    setIsSaved(true);
    setSaveCount((currentCount) => currentCount + 1);

    try {
      await createViewerPostSave({
        postId: post.id,
      });
    } catch {
      setIsSaved(previousIsSaved);
      setSaveCount(previousSaveCount);
    }
  }

  return (
    <div className="flex justify-between items-center z-20">
      <div className="flex gap-2 mr-5 items-center">
        <Heart
          aria-hidden="true"
          onClick={(e) => handleLikePost(e)}
          className={
            isLiked
              ? 'size-5 cursor-pointer fill-current text-primary'
              : 'size-5 cursor-pointer'
          }
        />
        <p>{likeCount}</p>
      </div>
      <div className="flex gap-2 items-center">
        <Bookmark
          aria-hidden="true"
          onClick={(e) => handleSavePost(e)}
          className={
            isSaved
              ? 'size-5 cursor-pointer fill-current text-primary'
              : 'size-5 cursor-pointer'
          }
        />
        <p>{saveCount}</p>
      </div>
    </div>
  );
}
