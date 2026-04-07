import { useParams } from 'react-router';
import PostForm from '~/features/post/components/PostForm';
import { useGetPostEditorQuery } from '~/features/post/queries/post.queries';

export default function EditPost() {
  const { id } = useParams();
  const postId = id ?? '';
  const { data: post, isPending } = useGetPostEditorQuery(postId);

  if (isPending) return <div>Loading...</div>;

  return (
    <div className="flex">
      <div className="flex flex-col flex-1 items-center gap-10 overflow-scroll py-10 px-5 md:px-8 lg:p-14">
        <div className="flex justify-start items-center gap-3 max-w-5xl w-full">
          <img src="/assets/icons/add-post.svg" width={36} height={36} alt="add" />
          <h2 className="text-[24px] font-bold leading-[140%] tracking-tighter w-full text-left">
            Edit Post
          </h2>
        </div>
        <PostForm action="Update" post={post ?? undefined} />
      </div>
    </div>
  );
}
