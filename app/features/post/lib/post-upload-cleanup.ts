import { deletePostMediaFile, uploadPostMediaFile } from '../api/post.api';
import type {
  UploadedFileIdByClientMediaId,
  UploadedPostMediaFile,
  UploadablePostMediaItem,
} from '../types/post.type';

export function buildUploadedFileIdMap(
  uploadedFiles: UploadedPostMediaFile[],
): UploadedFileIdByClientMediaId {
  return uploadedFiles.reduce<UploadedFileIdByClientMediaId>((result, uploadedFile) => {
    result[uploadedFile.clientMediaId] = uploadedFile.fileId;
    return result;
  }, {});
}

export async function uploadNewMediaItems(
  mediaItems: UploadablePostMediaItem[],
  ownerAccountId: string,
): Promise<UploadedPostMediaFile[]> {
  const uploadedFiles: UploadedPostMediaFile[] = [];

  for (const mediaItem of mediaItems) {
    const uploadedFile = await uploadPostMediaFile(mediaItem.file, ownerAccountId);

    uploadedFiles.push({
      clientMediaId: mediaItem.clientMediaId,
      fileId: uploadedFile.$id,
    });
  }

  return uploadedFiles;
}

export async function cleanupUploadedMediaFiles(
  uploadedFiles: UploadedPostMediaFile[],
  context: string,
): Promise<void> {
  for (const uploadedFile of uploadedFiles) {
    try {
      await deletePostMediaFile(uploadedFile.fileId);
    } catch (error) {
      console.error(
        `[PostUploadCleanup.${context}] Failed to clean up uploaded post media file.`,
        error,
      );
    }
  }
}
