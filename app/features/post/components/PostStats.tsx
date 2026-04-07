import type { Models } from 'appwrite';
import { useState } from 'react';
import {
  useDeleteSavedPostMutation,
  useGetCurrentUserQuery,
  useLikePostMutation,
  useSavePostMutation,
} from '~/lib/react-query/queriesAndMutations';
import type { PostCardViewModel } from '../types/post.type';

type SaveRecord = Models.Row & {
  post?: string | { $id: string } | null;
};

type CurrentUserWithSaves = Models.Row & {
  save?: SaveRecord[] | null;
};

type PostStatsProps = {
  post: PostCardViewModel;
  userId: string;
};

export default function PostStats({ post, userId }: PostStatsProps) {
  const likesList = post.likes ? post.likes.map((value) => value.$id) : [];

  const [likes, setLikes] = useState<string[]>(likesList);
  const [isSaved, setIsSaved] = useState(false);

  const { data: currentUser } = useGetCurrentUserQuery();
  const { mutateAsync: likePost } = useLikePostMutation();
  const { mutateAsync: savePost } = useSavePostMutation();
  const { mutateAsync: deleteSavePost } = useDeleteSavedPostMutation();

  const saveRecords = (currentUser as CurrentUserWithSaves | undefined)?.save ?? [];

  const savedPostRecord = saveRecords.find((record) => {
    const savedPostId = typeof record.post === 'string' ? record.post : record.post?.$id;
    return savedPostId === post.id;
  });

  const handleLikePost = (e: React.MouseEvent) => {
    e.stopPropagation();

    let newLikes = [...likes];

    const hasLiked = newLikes.includes(userId);

    if (hasLiked) {
      newLikes = newLikes.filter((id) => id !== userId);
    } else {
      newLikes.push(userId);
    }

    setLikes(newLikes);
    likePost({ postId: post.id, likesArray: newLikes });
  };

  const handleSavePost = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (savedPostRecord) {
      setIsSaved(false);
      return deleteSavePost(savedPostRecord.$id);
    }

    savePost({ userId: userId, postId: post.id });
    setIsSaved(true);
  };

  const checkIsLiked = (userId: string) => {
    return likesList.includes(userId);
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
