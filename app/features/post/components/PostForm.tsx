import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import InlineErrorAlert from '~/components/feedback/inline-error-alert';
import FileUploader from '~/components/shared/FileUploader';
import { Button } from '~/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import { PostValidation } from '~/lib/validation';
import { useCreatePostMutation, useUpdatePostMutation } from '../queries/post.mutation';
import type {
  CreatePostPublishMediaItem,
  ExistingUpdatePostPublishMediaItem,
  LocalPostMediaEditorItem,
  NewUpdatePostPublishMediaItem,
  PostEditorInitialData,
  PostFormValues,
  PreparedImageDraft,
} from '../types/post.type';
import PostMediaEditor from './PostMediaEditor';

type PostFormProps = {
  action: 'Create' | 'Update';
  post?: PostEditorInitialData;
};

function getDefaultValues(post?: PostEditorInitialData): PostFormValues {
  return {
    caption: post?.caption ?? '',
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

function isReadyLocalMediaItem(
  item: LocalPostMediaEditorItem,
): item is Extract<LocalPostMediaEditorItem, { status: 'ready' }> {
  return item.status === 'ready';
}

function mapReadyLocalMediaItemToCreatePublishMediaItem(
  item: Extract<LocalPostMediaEditorItem, { status: 'ready' }>,
): CreatePostPublishMediaItem {
  return {
    clientMediaId: item.clientMediaId,
    file: item.file,
    width: item.width,
    height: item.height,
    aspectRatioBucket: item.aspectRatioBucket,
    placeholder: item.placeholder,
  };
}

function mapPostToLegacyExistingUpdatePublishMediaItem(
  post: PostEditorInitialData,
): ExistingUpdatePostPublishMediaItem {
  return {
    kind: 'existing',
    clientMediaId: post.id,
    fileId: post.imageId,
    imageUrl: post.imageUrl,
    width: post.imageWidth,
    height: post.imageHeight,
    aspectRatioBucket: post.aspectRatioBucket,
    placeholder: post.imagePlaceholder,
  };
}

function mapPreparedDraftToNewUpdatePublishMediaItem(
  draft: PreparedImageDraft,
): NewUpdatePostPublishMediaItem | null {
  if (draft.metadataStatus !== 'ready' || !draft.metadata) {
    return null;
  }

  const { metadata } = draft;

  if (metadata.width === null || metadata.height === null) {
    return null;
  }

  return {
    kind: 'local',
    clientMediaId: `replacement-${draft.file.name}-${draft.file.lastModified}`,
    file: draft.file,
    width: metadata.width,
    height: metadata.height,
    aspectRatioBucket: metadata.aspectRatioBucket,
    placeholder: metadata.placeholder,
  };
}

export default function PostForm({ action, post }: PostFormProps) {
  const navigate = useNavigate();
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;
  const { mutateAsync: createPost, isPending: isLoadingCreate } = useCreatePostMutation();
  const { mutateAsync: updatePost, isPending: isLoadingUpdate } = useUpdatePostMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<LocalPostMediaEditorItem[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [updateSelectedFiles, setUpdateSelectedFiles] = useState<File[]>([]);
  const [updatePreparedImageDraft, setUpdatePreparedImageDraft] = useState<PreparedImageDraft | null>(
    null,
  );
  const isEditMode = action === 'Update';
  const hasProcessingMediaItems = mediaItems.some((item) => item.status === 'processing');

  const form = useForm<PostFormValues>({
    resolver: zodResolver(PostValidation),
    defaultValues: getDefaultValues(post),
  });

  async function onSubmit(values: PostFormValues) {
    setSubmitError(null);

    const normalizedTags = normalizeTags(values.tags);

    if (isEditMode) {
      if (!post) {
        setSubmitError('Unable to load the post data for editing.');
        return;
      }

      if (updateSelectedFiles.length > 0 && !currentUser) {
        setSubmitError('Unable to resolve the current user.');
        return;
      }

      try {
        const mediaItems: Array<
          ExistingUpdatePostPublishMediaItem | NewUpdatePostPublishMediaItem
        > = [mapPostToLegacyExistingUpdatePublishMediaItem(post)];
        const replacementMediaItem =
          updatePreparedImageDraft && updateSelectedFiles[0]
            ? mapPreparedDraftToNewUpdatePublishMediaItem(updatePreparedImageDraft)
            : null;

        if (replacementMediaItem) {
          mediaItems.unshift(replacementMediaItem);
        }

        const updatedPost = await updatePost({
          postId: post.id,
          ownerAccountId: currentUser?.accountId ?? '',
          caption: values.caption,
          location: values.location,
          tags: normalizedTags,
          mediaItems,
        });

        toast.success('Post updated successfully.');
        navigate(`/posts/${updatedPost.postId}`);
        return;
      } catch (error) {
        setSubmitError(getErrorMessage(error));
        return;
      }
    }

    if (mediaItems.length === 0) {
      setMediaError('Please add at least one image before creating a post.');
      return;
    }

    if (hasProcessingMediaItems) {
      setMediaError('Please wait for image processing to finish before submitting the post.');
      return;
    }

    const coverItem = mediaItems.find(isReadyLocalMediaItem);

    if (!coverItem) {
      setMediaError('Keep at least one successfully prepared image before creating a post.');
      return;
    }

    try {
      if (!currentUser) {
        setSubmitError('Unable to resolve the current user.');
        return;
      }

      setMediaError(null);

      const newPost = await createPost({
        creatorProfileId: currentUser.profileId,
        ownerAccountId: currentUser.accountId,
        caption: values.caption,
        location: values.location,
        tags: normalizedTags,
        mediaItems: [mapReadyLocalMediaItemToCreatePublishMediaItem(coverItem)],
      });

      toast.success('Post published successfully.');
      navigate(`/posts/${newPost.postId}`);
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
      <FieldGroup className="flex w-full max-w-5xl flex-col gap-9">
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
                className="h-36 rounded-xl border-none ring-offset-light-3 focus-visible:ring-1 focus-visible:ring-offset-1"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {isEditMode ? (
          <Field className="w-full">
            <FieldLabel htmlFor="form-createPost-file">Replace Photo</FieldLabel>
            <FieldDescription>
              Editing still uses the current single-image replacement flow.
            </FieldDescription>
            <FileUploader
              fieldChange={(files) => {
                setUpdateSelectedFiles(files);

                if (files.length === 0) {
                  setUpdatePreparedImageDraft(null);
                }
              }}
              mediaUrl={post?.imageUrl ?? ''}
              onPreparedChange={setUpdatePreparedImageDraft}
            />
          </Field>
        ) : (
          <Field className="w-full">
            <FieldLabel>Add Photos</FieldLabel>
            <FieldDescription>
              The current submit path still uses the first ready image as the temporary cover.
            </FieldDescription>
            <PostMediaEditor
              items={mediaItems}
              error={mediaError}
              onItemsChange={setMediaItems}
              onErrorChange={setMediaError}
            />
          </Field>
        )}

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
                className="h-12 border-none placeholder:text-light-4 ring-offset-light-3 focus-visible:ring-1 focus-visible:ring-offset-1"
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
                className="h-12 border-none placeholder:text-light-4 ring-offset-light-3 focus-visible:ring-1 focus-visible:ring-offset-1"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <div className="flex items-center justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoadingCreate || isLoadingUpdate || (!isEditMode && hasProcessingMediaItems)}
        >
          {isLoadingCreate || isLoadingUpdate ? 'Loading...' : action} Post
        </Button>
      </div>
    </form>
  );
}
