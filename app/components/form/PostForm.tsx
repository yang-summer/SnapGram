import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import * as z from 'zod';
import { Field, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { PostValidation } from '~/lib/validation';
import FileUploader from '../shared/FileUploader';
import { Button } from '../ui/button';
import type { Models } from 'appwrite';
import { useCreatePostMutation } from '~/lib/react-query/queriesAndMutations';
import { useUserContext } from '~/context/AuthContext';
import { useNavigate } from 'react-router';

type PostFormProps = {
  post?: Models.Row;
};

export default function PostForm({ post }: PostFormProps) {
  const navigate = useNavigate();
  const { user } = useUserContext();
  const { mutateAsync: createPost, isPending: isLoadingCreate } = useCreatePostMutation();

  const form = useForm<z.infer<typeof PostValidation>>({
    resolver: zodResolver(PostValidation),
    defaultValues: {
      caption: post ? post?.caption : '',
      file: [],
      location: post ? post.location : '',
      tags: post ? post.tags.join(',') : '',
    },
  });

  async function onSubmit(values: z.infer<typeof PostValidation>) {
    const newPost = await createPost({
      ...values,
      userId: user.id,
    });

    if (!newPost) {
      console.error('create post failed');
    }

    navigate('/');
  }
  return (
    <form id="form-createPost" onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-5xl">
      <FieldGroup className="flex flex-col w-full max-w-5xl gap-9">
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
              <FileUploader fieldChange={field.onChange} />
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
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit">Submit</Button>
      </div>
    </form>
  );
}
