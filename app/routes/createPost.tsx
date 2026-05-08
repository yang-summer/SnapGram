import { ImagePlus } from 'lucide-react';
import PostForm from '~/features/post/components/PostForm';

export default function CreatePost() {
  return (
    <div className="flex">
      <div className="flex flex-col flex-1 items-center gap-10 py-10 px-5 md:px-8 lg:px-14 lg:pt-10 lg:pb-14">
        <div className="flex justify-start items-center gap-3 max-w-5xl w-full">
          <ImagePlus className="size-9" aria-hidden="true" />
          <h2 className="text-[24px] font-bold leading-[140%] tracking-tighter w-full text-left">
            Create Post
          </h2>
        </div>
        <PostForm action="Create" />
      </div>
    </div>
  );
}
