import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import InlineErrorAlert from '~/components/feedback/inline-error-alert';
import FileUploader from '~/components/shared/FileUploader';
import { Button } from '~/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import { PostValidation } from '~/lib/validation';
import type { PostEditorInitialData, PostFormValues } from '../types/post.type';
import { useCreatePostMutation, useUpdatePostMutation } from '../queries/post.mutation';

type PostFormProps = {
  action: 'Create' | 'Update';
  post?: PostEditorInitialData;
};

function getDefaultValues(post?: PostEditorInitialData): PostFormValues {
  return {
    caption: post?.caption ?? '',
    file: [],
    location: post?.location ?? '',
    tags: post?.tags ?? '',
  };
}

function normalizeTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to save post. Please try again.';
}

export default function PostForm({ action, post }: PostFormProps) {
  const navigate = useNavigate();
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;
  const { mutateAsync: createPost, isPending: isLoadingCreate } = useCreatePostMutation();
  const { mutateAsync: updatePost, isPending: isLoadingUpdate } = useUpdatePostMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditMode = action === 'Update';

  const form = useForm<PostFormValues>({
    resolver: zodResolver(PostValidation),
    defaultValues: getDefaultValues(post),
  });

  async function onSubmit(values: PostFormValues) {
    setSubmitError(null);

    const normalizedTags = normalizeTags(values.tags);
    const nextFile = values.file[0] ?? null;

    if (isEditMode) {
      if (!post) {
        setSubmitError('Unable to load the post data for editing.');
        return;
      }

      if (nextFile && !currentUser) {
        setSubmitError('Unable to resolve the current user.');
        return;
      }

      try {
        const updatedPost = await updatePost({
          postId: post.id,
          ownerAccountId: currentUser?.accountId ?? '',
          caption: values.caption,
          location: values.location,
          tags: normalizedTags,
          nextFile,
          currentImageId: post.imageId,
          currentImageUrl: post.imageUrl,
        });

        toast.success('Post updated successfully.');
        navigate(`/posts/${updatedPost.id}`);
        return;
      } catch (error) {
        setSubmitError(getErrorMessage(error));
        return;
      }
    }

    if (!nextFile) {
      setSubmitError('Please select an image before creating a post.');
      return;
    }

    try {
      if (!currentUser) {
        setSubmitError('Unable to resolve the current user.');
        return;
      }

      const newPost = await createPost({
        creatorProfileId: currentUser.profileId,
        ownerAccountId: currentUser.accountId,
        caption: values.caption,
        file: nextFile,
        location: values.location,
        tags: normalizedTags,
      });

      toast.success('Post published successfully.');
      navigate(`/posts/${newPost.id}`);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  }

  if (isEditMode && !post) {
    return (
      <div className="w-full max-w-5xl rounded-2xl border p-6 text-center">
        <p>Unable to load the post data for editing.</p>
      </div>
    );
  }

  return (
    <form id="form-createPost" onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-5xl">
      <FieldGroup className="flex flex-col w-full max-w-5xl gap-9">
        {submitError ? (
          <InlineErrorAlert
            title={isEditMode ? 'Unable to update post' : 'Unable to create post'}
            message={submitError}
          />
        ) : null}
        <Controller
          name="caption"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="w-full">
              <FieldLabel htmlFor="form-createPost-caption">Caption</FieldLabel>
              <Textarea
                {...field}
                id="form-createPost-caption"
                aria-invalid={fieldState.invalid}
                placeholder=""
                autoComplete="off"
                className="h-36 rounded-xl border-none focus-visible:ring-1 focus-visible:ring-offset-1 ring-offset-light-3"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="file"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="w-full">
              <FieldLabel htmlFor="form-createPost-file">Add Photos</FieldLabel>
              <FileUploader fieldChange={field.onChange} mediaUrl={post?.imageUrl ?? ''} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="location"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="w-full">
              <FieldLabel htmlFor="form-createPost-location">Add Location</FieldLabel>
              <Input
                {...field}
                type="text"
                id="form-createPost-location"
                aria-invalid={fieldState.invalid}
                placeholder=""
                autoComplete="off"
                className="h-12 border-none placeholder:text-light-4 focus-visible:ring-1 focus-visible:ring-offset-1 ring-offset-light-3"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="tags"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="w-full">
              <FieldLabel htmlFor="form-createPost-tags">Add Tags</FieldLabel>
              <Input
                {...field}
                type="text"
                id="form-createPost-tags"
                aria-invalid={fieldState.invalid}
                placeholder=""
                autoComplete="off"
                className="h-12 border-none placeholder:text-light-4 focus-visible:ring-1 focus-visible:ring-offset-1 ring-offset-light-3"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <div className="flex gap-4 items-center justify-end">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoadingCreate || isLoadingUpdate}>
          {isLoadingCreate || isLoadingUpdate ? 'Loading...' : action} Post
        </Button>
      </div>
    </form>
  );
}
