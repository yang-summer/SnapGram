import type {
  CreatePostPublishInput,
  CreatePostWithContentActionRequest,
  UpdatePostPublishInput,
  UpdatePostWithContentActionRequest,
  UploadedFileIdByClientMediaId,
} from '../types/post.type';

function readUploadedFileId(
  uploadedFileIdByClientMediaId: UploadedFileIdByClientMediaId,
  clientMediaId: string,
): string {
  const fileId = uploadedFileIdByClientMediaId[clientMediaId]?.trim() ?? '';

  if (!fileId) {
    throw new Error(`Missing uploaded file ID for media item ${clientMediaId}.`);
  }

  return fileId;
}

export function buildCreatePostActionPayload(
  input: CreatePostPublishInput,
  uploadedFileIdByClientMediaId: UploadedFileIdByClientMediaId,
): Omit<CreatePostWithContentActionRequest, 'action'> {
  return {
    caption: input.caption,
    location: input.location,
    tags: input.tags,
    media: input.mediaItems.map((mediaItem, index) => ({
      fileId: readUploadedFileId(uploadedFileIdByClientMediaId, mediaItem.clientMediaId),
      sortOrder: index,
      width: mediaItem.width,
      height: mediaItem.height,
      aspectRatioBucket: mediaItem.aspectRatioBucket,
      placeholder: mediaItem.placeholder,
    })),
  };
}

export function buildUpdatePostActionPayload(
  input: UpdatePostPublishInput,
  uploadedFileIdByClientMediaId: UploadedFileIdByClientMediaId,
): Omit<UpdatePostWithContentActionRequest, 'action'> {
  return {
    postId: input.postId,
    caption: input.caption,
    location: input.location,
    tags: input.tags,
    media: input.mediaItems.map((mediaItem, index) => {
      if (mediaItem.kind === 'existing') {
        const mediaId = mediaItem.mediaId?.trim() ?? '';

        if (!mediaId) {
          throw new Error(`Missing existing media ID for media item ${mediaItem.clientMediaId}.`);
        }

        return {
          type: 'existing' as const,
          mediaId,
          sortOrder: index,
        };
      }

      return {
        type: 'new' as const,
        fileId: readUploadedFileId(uploadedFileIdByClientMediaId, mediaItem.clientMediaId),
        sortOrder: index,
        width: mediaItem.width,
        height: mediaItem.height,
        aspectRatioBucket: mediaItem.aspectRatioBucket,
        placeholder: mediaItem.placeholder,
      };
    }),
  };
}
