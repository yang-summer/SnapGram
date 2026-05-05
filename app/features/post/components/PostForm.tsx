import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import InlineErrorAlert from '~/components/feedback/inline-error-alert';
import { Button } from '~/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import { PostValidation } from '~/lib/validation';
import { useCreatePostMutation, useUpdatePostMutation } from '../queries/post.mutation';
import type {
  CreatePostPublishMediaItem,
  ExistingPostMediaEditorItem,
  ExistingUpdatePostPublishMediaItem,
  NewUpdatePostPublishMediaItem,
  PostEditorInitialData,
  PostMediaEditorItem,
  PostFormValues,
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

function getInitialMediaItems(post?: PostEditorInitialData): PostMediaEditorItem[] {
  if (!post) {
    return [];
  }

  return post.existingMediaItems.map((item) => ({ ...item }));
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
  item: PostMediaEditorItem,
): item is Extract<PostMediaEditorItem, { kind: 'local'; status: 'ready' }> {
  return item.kind === 'local' && item.status === 'ready';
}

function isFailedLocalMediaItem(
  item: PostMediaEditorItem,
): item is Extract<PostMediaEditorItem, { kind: 'local'; status: 'failed' }> {
  return item.kind === 'local' && item.status === 'failed';
}

function isExistingMediaItem(item: PostMediaEditorItem): item is ExistingPostMediaEditorItem {
  return item.kind === 'existing';
}

function mapReadyLocalMediaItemToCreatePublishMediaItem(
  item: Extract<PostMediaEditorItem, { kind: 'local'; status: 'ready' }>,
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

function getOrderedReadyCreatePublishMediaItems(
  items: PostMediaEditorItem[],
): CreatePostPublishMediaItem[] {
  return items.filter(isReadyLocalMediaItem).map(mapReadyLocalMediaItemToCreatePublishMediaItem);
}

function mapExistingMediaItemToUpdatePublishMediaItem(
  item: ExistingPostMediaEditorItem,
): ExistingUpdatePostPublishMediaItem {
  return {
    kind: 'existing',
    clientMediaId: item.clientMediaId,
    mediaId: item.mediaId,
    fileId: item.fileId,
    imageUrl: item.imageUrl,
    width: item.width,
    height: item.height,
    aspectRatioBucket: item.aspectRatioBucket,
    placeholder: item.placeholder,
  };
}

function mapReadyLocalMediaItemToUpdatePublishMediaItem(
  item: Extract<PostMediaEditorItem, { kind: 'local'; status: 'ready' }>,
): NewUpdatePostPublishMediaItem {
  return {
    kind: 'local',
    clientMediaId: item.clientMediaId,
    file: item.file,
    width: item.width,
    height: item.height,
    aspectRatioBucket: item.aspectRatioBucket,
    placeholder: item.placeholder,
  };
}

function getOrderedReadyUpdatePublishMediaItems(
  items: PostMediaEditorItem[],
): Array<ExistingUpdatePostPublishMediaItem | NewUpdatePostPublishMediaItem> {
  return items
    .filter(
      (
        item,
      ): item is ExistingPostMediaEditorItem | Extract<PostMediaEditorItem, { kind: 'local'; status: 'ready' }> =>
        isExistingMediaItem(item) || isReadyLocalMediaItem(item),
    )
    .map((item) =>
      item.kind === 'existing'
        ? mapExistingMediaItemToUpdatePublishMediaItem(item)
        : mapReadyLocalMediaItemToUpdatePublishMediaItem(item),
    );
}

function validatePostMediaItemsForSubmit(
  items: PostMediaEditorItem[],
  mode: 'create' | 'update',
): string | null {
  if (items.length === 0) {
    return mode === 'create'
      ? 'Please add at least one image before creating a post.'
      : 'Keep at least one image before updating the post.';
  }

  if (items.some((item) => item.kind === 'local' && item.status === 'processing')) {
    return 'Please wait for image processing to finish before submitting the post.';
  }

  if (items.some(isFailedLocalMediaItem)) {
    return 'Remove or retry failed images before submitting the post.';
  }

  if (mode === 'update' && items.some((item) => item.kind === 'existing' && !item.mediaId)) {
    return 'This post still uses legacy media data. Remove the legacy image and upload a replacement before saving.';
  }

  const readyItemsCount = items.filter(
    (item) => item.kind === 'existing' || isReadyLocalMediaItem(item),
  ).length;

  if (readyItemsCount === 0) {
    return mode === 'create'
      ? 'Keep at least one successfully prepared image before creating a post.'
      : 'Keep at least one image before updating the post.';
  }

  return null;
}

export default function PostForm({ action, post }: PostFormProps) {
  const navigate = useNavigate();
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;
  const { mutateAsync: createPost, isPending: isLoadingCreate } = useCreatePostMutation();
  const { mutateAsync: updatePost, isPending: isLoadingUpdate } = useUpdatePostMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<PostMediaEditorItem[]>(() => getInitialMediaItems(post));
  const [mediaError, setMediaError] = useState<string | null>(null);
  const isEditMode = action === 'Update';
  const hasProcessingMediaItems = mediaItems.some(
    (item) => item.kind === 'local' && item.status === 'processing',
  );
  const isSubmitting = isLoadingCreate || isLoadingUpdate;

  const form = useForm<PostFormValues>({
    resolver: zodResolver(PostValidation),
    defaultValues: getDefaultValues(post),
  });

  useEffect(() => {
    if (!isEditMode || !post) {
      return;
    }

    form.reset(getDefaultValues(post));
    setMediaItems(getInitialMediaItems(post));
    setMediaError(null);
    setSubmitError(null);
  }, [form, isEditMode, post?.id]);

  async function onSubmit(values: PostFormValues) {
    setSubmitError(null);

    const normalizedTags = normalizeTags(values.tags);
    const mediaValidationError = validatePostMediaItemsForSubmit(
      mediaItems,
      isEditMode ? 'update' : 'create',
    );

    if (mediaValidationError) {
      setMediaError(mediaValidationError);
      return;
    }

    if (!currentUser) {
      setSubmitError('Unable to resolve the current user.');
      return;
    }

    try {
      setMediaError(null);

      if (isEditMode) {
        if (!post) {
          setSubmitError('Unable to load the post data for editing.');
          return;
        }

        const updatedPost = await updatePost({
          postId: post.id,
          ownerAccountId: currentUser.accountId,
          caption: values.caption,
          location: values.location,
          tags: normalizedTags,
          mediaItems: getOrderedReadyUpdatePublishMediaItems(mediaItems),
        });

        toast.success('Post updated successfully.');

        if (updatedPost.filePublicationFailed) {
          toast.warning('Post was updated, but media publication is still incomplete.');
        }

        if (updatedPost.removedFileCleanupFailed) {
          toast.warning(
            'Post was updated, but some removed media files could not be cleaned up.',
          );
        }

        navigate(`/posts/${updatedPost.postId}`);
        return;
      }

      const readyMediaItems = getOrderedReadyCreatePublishMediaItems(mediaItems);
      const newPost = await createPost({
        creatorProfileId: currentUser.profileId,
        ownerAccountId: currentUser.accountId,
        caption: values.caption,
        location: values.location,
        tags: normalizedTags,
        mediaItems: readyMediaItems,
      });

      toast.success('Post published successfully.');

      if (newPost.filePublicationFailed) {
        toast.warning('Post was published, but media publication is still incomplete.');
      }

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
            <FieldLabel>Edit Photos</FieldLabel>
            <FieldDescription>
              {post?.hasLegacyMediaFallback
                ? 'Remove the legacy image and upload replacement media before saving this post.'
                : 'Reorder current media, remove existing items, or add new images before saving.'}
            </FieldDescription>
            <PostMediaEditor
              items={mediaItems}
              error={mediaError}
              onItemsChange={setMediaItems}
              onErrorChange={setMediaError}
            />
          </Field>
        ) : (
          <Field className="w-full">
            <FieldLabel>Add Photos</FieldLabel>
            <FieldDescription>
              Choose and order up to 6 images before publishing.
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
        <Button type="submit" disabled={isSubmitting || hasProcessingMediaItems}>
          {isSubmitting ? 'Loading...' : action} Post
        </Button>
      </div>
    </form>
  );
}
