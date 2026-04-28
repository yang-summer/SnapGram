import { useEffect, useState } from 'react';
import {
  useCreateViewerPostLikeMutation,
  useCreateViewerPostSaveMutation,
  useDeleteViewerPostLikeMutation,
  useDeleteViewerPostSaveMutation,
} from '../queries/post.engagement.mutations';
import { useViewerLikedPostQuery, useViewerSavedPostQuery } from '../queries/post.engagement.queries';

type PostStatsProps = {
  post: {
    id: string;
    likeCount: number;
    saveCount: number;
  };
  viewerProfileId: string;
};

export default function PostStats({ post, viewerProfileId }: PostStatsProps) {
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saveCount, setSaveCount] = useState(post.saveCount);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { data: viewerLikedPost } = useViewerLikedPostQuery(viewerProfileId, post.id);
  const { data: viewerSavedPost } = useViewerSavedPostQuery(viewerProfileId, post.id);

  const { mutateAsync: createViewerPostLike } = useCreateViewerPostLikeMutation();
  const { mutateAsync: deleteViewerPostLike } = useDeleteViewerPostLikeMutation();
  const { mutateAsync: createViewerPostSave } = useCreateViewerPostSaveMutation();
  const { mutateAsync: deleteViewerPostSave } = useDeleteViewerPostSaveMutation();

  useEffect(() => {
    setLikeCount(post.likeCount);
    setSaveCount(post.saveCount);
  }, [post.id, post.likeCount, post.saveCount]);

  useEffect(() => {
    setIsLiked(!!viewerLikedPost);
  }, [viewerLikedPost]);

  useEffect(() => {
    setIsSaved(!!viewerSavedPost);
  }, [viewerSavedPost]);

  async function handleLikePost(e: React.MouseEvent) {
    e.stopPropagation();

    if (!viewerProfileId) {
      return;
    }

    const previousIsLiked = isLiked;
    const previousLikeCount = likeCount;

    try {
      if (isLiked) {
        setIsLiked(false);
        setLikeCount((currentCount) => Math.max(0, currentCount - 1));

        await deleteViewerPostLike({
          postId: post.id,
        });

        return;
      }

      setIsLiked(true);
      setLikeCount((currentCount) => currentCount + 1);

      await createViewerPostLike({
        postId: post.id,
      });
    } catch {
      setIsLiked(previousIsLiked);
      setLikeCount(previousLikeCount);
    }
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
      <div className="flex gap-2 mr-5">
        <img
          src={isLiked ? '/assets/icons/liked.svg' : '/assets/icons/like.svg'}
          alt="like"
          width={20}
          height={20}
          onClick={(e) => handleLikePost(e)}
          className="cursor-pointer"
        />
        <p>{likeCount}</p>
      </div>
      <div className="flex gap-2">
        <img
          src={isSaved ? '/assets/icons/saved.svg' : '/assets/icons/save.svg'}
          alt="save"
          width={20}
          height={20}
          onClick={(e) => handleSavePost(e)}
          className="cursor-pointer"
        />
        <p>{saveCount}</p>
      </div>
    </div>
  );
}
