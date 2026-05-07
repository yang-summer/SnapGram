import { Link } from 'react-router';
import { Button } from '~/components/ui/button';
import PostMediaCarousel from './PostMediaCarousel';
import PostStats from './PostStats';
import type { PostDetailViewModel } from '../types/post.type';

type PostDetailsContentProps = {
  post: PostDetailViewModel;
  viewerProfileId: string;
  onDeletePost: () => void;
};

export default function PostDetailsContent({
  post,
  viewerProfileId,
  onDeletePost,
}: PostDetailsContentProps) {
  return (
    <div className="flex w-full max-w-5xl flex-col rounded-[30px] border xl:flex-row xl:rounded-l-[24px]">
      <div className="p-5 xl:w-[48%] xl:shrink-0">
        <PostMediaCarousel
          media={post.media}
          altBase={post.caption || `${post.creator.name}'s post media`}
          className="rounded-[24px]"
        />
      </div>

      <div className="flex flex-1 flex-col items-start gap-5 rounded-[30px] p-8 lg:gap-7">
        <div className="flex w-full items-center justify-between">
          <Link to={`/profile/${post.creator.id}`} className="flex items-center gap-3">
            <img
              src={post.creator.imageUrl || '/assets/icons/profile-placeholder.svg'}
              alt="creator"
              className="h-8 w-8 rounded-full lg:h-12 lg:w-12"
            />
            <div className="flex flex-col gap-1">
              <p>{post.creator.name}</p>
              <div className="flex items-center justify-center gap-2">
                <p>{post.createdAt}</p>•<p>{post.location}</p>
              </div>
            </div>
          </Link>

          <div className="flex items-center justify-center gap-4">
            <Link
              to={`/update-post/${post.id}`}
              className={viewerProfileId !== post.creator.id ? 'hidden' : ''}
            >
              <img src={'/assets/icons/edit.svg'} alt="edit" width={24} height={24} />
            </Link>
            <Button
              onClick={onDeletePost}
              variant="ghost"
              className={viewerProfileId !== post.creator.id ? 'hidden' : ''}
            >
              <img src={'/assets/icons/delete.svg'} alt="delete" width={24} height={24} />
            </Button>
          </div>
        </div>

        <hr className="w-full border" />

        <div className="flex w-full flex-1 flex-col">
          <p>{post.caption}</p>
          <ul className="mt-2 flex gap-1">
            {post.tags.map((tag, index) => (
              <li key={`${tag}${index}`}>#{tag}</li>
            ))}
          </ul>
        </div>

        <div className="w-full">
          <PostStats post={post} viewerProfileId={viewerProfileId} />
        </div>
      </div>
    </div>
  );
}
