import { Link, useLocation } from 'react-router';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import { createPostDetailNavigationState } from '../lib/post-detail-navigation';
import PostStats from './PostStats';
import type { PostCardViewModel } from '../types/post.type';

type PostCardProps = {
  post: PostCardViewModel;
};

export default function PostCard({ post }: PostCardProps) {
  const location = useLocation();
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;
  const currentUserProfileId = currentUser?.profileId ?? '';
  const postDetailState = createPostDetailNavigationState(location);

  if (!post.creator) return null;

  return (
    <div className="rounded-3xl border border-amber-900 p-5 lg:p-7 w-full max-w-screen-sm">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.creator.id}`}>
            <img
              src={post?.creator?.imageUrl || '/assets/icons/profile-placeholder.svg'}
              alt="creator"
              className="rounded-full w-12 lg:h-12"
            />
          </Link>
          <div className="flex flex-col">
            <p>{post.creator.name}</p>
            <div className="flex items-center gap-2">
              <p>{post.createdAt}</p>-<p>{post.location}</p>
            </div>
          </div>
        </div>
        <Link
          to={`/update-post/${post.id}`}
          className={currentUserProfileId !== post.creator.id ? 'hidden' : ''}
        >
          <img src={'/assets/icons/edit.svg'} alt="edit" width={20} height={20} />
        </Link>
      </div>
      <Link
        to={`/posts/${post.id}`}
        state={postDetailState}
        preventScrollReset
      >
        <div>
          <p>{post.caption}</p>
          <ul className="flex gap-1 mt-2">
            {post.tags?.map((tag: string) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        </div>
        <img
          src={post.imageUrl || '/assets/icons/profile-placeholder.svg'}
          className="h-64 xs:h-[400px] lg:h-112.5 w-full rounded-[24px] object-cover mb-5"
          alt="post image"
        />
      </Link>
      <PostStats
        post={post}
        viewerProfileId={currentUserProfileId}
      />
    </div>
  );
}
