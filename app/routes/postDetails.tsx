import { Link, useNavigate, useParams } from 'react-router';
import PostStats from '~/components/shared/PostStats';
import { Button } from '~/components/ui/button';
import { useUserContext } from '~/context/AuthContext';
import { useDeletePostMutation, useGetPostByIdQuery } from '~/lib/react-query/queriesAndMutations';

export default function PostDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useUserContext();
  const { data: post, isPending } = useGetPostByIdQuery(id || '');
  const { mutateAsync: deletePost } = useDeletePostMutation();

  async function handleDeletePost() {
    await deletePost({ postId: id, imageId: post?.imageId });
    navigate(-1);
  }

  return (
    <div className="flex flex-col items-center gap-10 overflow-scroll py-10 px-5 md:p-14 ">
      {isPending ? (
        <div>Loading...</div>
      ) : (
        <div className="flex flex-col xl:flex-row w-full max-w-5xl rounded-[30px] border xl:rounded-l-[24px]">
          <img
            src={post?.imageUrl}
            alt="creator"
            className="h-80 lg:h-120 xl:w-[48%] rounded-t-[30px] xl:rounded-l-[24px] xl:rounded-tr-none object-cover p-5"
          />
          <div className="flex flex-col gap-5 lg:gap-7 flex-1 items-start p-8 rounded-[30px]">
            <div className="flex justify-between items-center w-full">
              <Link to={`/profile/${post?.creator.$id}`} className="flex items-center gap-3">
                <img
                  src={post?.creator.imageUrl || '/assets/icons/profile-placeholder.svg'}
                  alt="creator"
                  className="w-8 h-8 lg:w-12 lg:h-12 rounded-full"
                />
                <div className="flex gap-1 flex-col">
                  <p>{post?.creator.name}</p>
                  <div className="flex justify-center items-center gap-2">
                    <p>{post?.$createdAt}</p>•<p>{post?.location}</p>
                  </div>
                </div>
              </Link>
              <div className="flex justify-center items-center gap-4">
                <Link
                  to={`/update-post/${post?.$id}`}
                  className={`${user.id !== post?.creator.$id && 'hidden'}`}
                >
                  <img src={'/assets/icons/edit.svg'} alt="edit" width={24} height={24} />
                </Link>
                <Button
                  onClick={handleDeletePost}
                  variant="ghost"
                  className={`${user.id !== post?.creator.$id && 'hidden'}`}
                >
                  <img src={'/assets/icons/delete.svg'} alt="delete" width={24} height={24} />
                </Button>
              </div>
            </div>

            <hr className="border w-full" />

            <div className="flex flex-col flex-1 w-full">
              <p>{post?.caption}</p>
              <ul className="flex gap-1 mt-2">
                {post?.tags.map((tag: string, index: string) => (
                  <li key={`${tag}${index}`}>#{tag}</li>
                ))}
              </ul>
            </div>

            <div className="w-full">
              <PostStats post={post} userId={user.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
