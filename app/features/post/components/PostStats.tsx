import { useEffect, useState } from 'react';
import {
  useCreateViewerPostSaveMutation,
  useDeleteViewerPostSaveMutation,
  useUpdatePostLikesMutation,
} from '../queries/post.engagement.mutations';
import { useViewerSavedPostsQuery } from '../queries/post.engagement.queries';

type PostStatsProps = {
  post: {
    id: string;
    likes: string[];
  };
  userId: string;
};

export default function PostStats({ post, userId }: PostStatsProps) {
  const [likes, setLikes] = useState<string[]>(post.likes);
  const [isSaved, setIsSaved] = useState(false);
  const viewerId = userId;
  const { data: viewerSavedPosts } = useViewerSavedPostsQuery(viewerId);

  const { mutateAsync: updatePostLikes } = useUpdatePostLikesMutation();
  const { mutateAsync: createViewerPostSave } = useCreateViewerPostSaveMutation();
  const { mutateAsync: deleteViewerPostSave } = useDeleteViewerPostSaveMutation();

  const savedPostRecord = viewerSavedPosts?.records.find((record) => record.postId === post.id);

  useEffect(() => {
    setLikes(post.likes);
  }, [post.likes]);

  useEffect(() => {
    setIsSaved(viewerSavedPosts?.postIds.includes(post.id) ?? false);
  }, [post.id, viewerSavedPosts]);

  async function handleLikePost(e: React.MouseEvent) {
    e.stopPropagation();

    if (!viewerId) {
      return;
    }

    const previousLikes = likes;
    let nextLikes = [...previousLikes];

    const hasLiked = nextLikes.includes(viewerId);

    if (hasLiked) {
      nextLikes = nextLikes.filter((id) => id !== viewerId);
    } else {
      nextLikes.push(viewerId);
    }

    setLikes(nextLikes);

    try {
      await updatePostLikes({
        postId: post.id,
        likes: nextLikes,
      });
    } catch {
      setLikes(previousLikes);
    }
  }

  async function handleSavePost(e: React.MouseEvent) {
    e.stopPropagation();

    if (!viewerId) {
      return;
    }

    if (savedPostRecord) {
      const previousIsSaved = isSaved;
      setIsSaved(false);

      try {
        await deleteViewerPostSave({
          saveRecordId: savedPostRecord.saveRecordId,
          viewerId,
          postId: post.id,
        });
      } catch {
        setIsSaved(previousIsSaved);
      }

      return;
    }

    const previousIsSaved = isSaved;
    setIsSaved(true);

    try {
      await createViewerPostSave({
        viewerId,
        postId: post.id,
      });
    } catch {
      setIsSaved(previousIsSaved);
    }
  }

  const checkIsLiked = (userId: string) => {
    return likes.includes(userId);
  };

  return (
    <div className="flex justify-between items-center z-20">
      <div className="flex gap-2 mr-5">
        <img
          src={checkIsLiked(userId) ? '/assets/icons/liked.svg' : '/assets/icons/like.svg'}
          alt="like"
          width={20}
          height={20}
          onClick={(e) => handleLikePost(e)}
          className="cursor-pointer"
        />
        <p>{likes.length}</p>
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
      </div>
    </div>
  );
}
