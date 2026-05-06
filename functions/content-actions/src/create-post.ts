import { ID, TablesDB, Storage } from 'node-appwrite';
import type { PostCreateActionRequest } from './action.js';
import type { CurrentUserProfile } from './auth.js';
import type { AppwriteResourceConfig } from './config.js';
import { buildPublishedPostMediaRowPermissions, buildPublishedPostPermissions } from './permissions.js';
import { buildPostSearchText } from './post-search.js';
import {
  assertOwnedStagedFiles,
  buildPostCoverProjectionFromMedia,
  normalizeCreateMediaPayload,
  publishMediaFiles,
} from './post-media.js';
import { runTransaction } from './transactions.js';

const PUBLISHED_POST_STATUS = 'published';

type CreatePostResult = {
  postId: string;
  mediaCount: number;
  filePublicationFailed: boolean;
};

export async function createPostForCurrentUser(
  tablesDB: TablesDB,
  storage: Storage,
  config: AppwriteResourceConfig,
  profile: CurrentUserProfile,
  request: PostCreateActionRequest,
  log: (message: string) => void,
  error: (message: string) => void,
): Promise<CreatePostResult> {
  const media = normalizeCreateMediaPayload(request.media);
  const fileIds = media.map((mediaItem) => mediaItem.fileId);

  await assertOwnedStagedFiles(storage, config, fileIds, profile.accountId);

  const coverProjection = buildPostCoverProjectionFromMedia(media, config);
  const postId = ID.unique();

  await runTransaction(tablesDB, async (transactionId) => {
    await tablesDB.createRow({
      databaseId: config.databaseId,
      tableId: config.postsTableId,
      rowId: postId,
      data: {
        creator: profile.id,
        caption: request.caption,
        imageId: coverProjection.imageId,
        imageUrl: coverProjection.imageUrl,
        aspectRatioBucket: coverProjection.aspectRatioBucket,
        imagePlaceholder: coverProjection.imagePlaceholder,
        imageWidth: coverProjection.imageWidth,
        imageHeight: coverProjection.imageHeight,
        location: request.location,
        tags: request.tags,
        status: PUBLISHED_POST_STATUS,
        searchText: buildPostSearchText(request.caption, request.tags),
        mediaCount: coverProjection.mediaCount,
      },
      permissions: buildPublishedPostPermissions(profile.accountId),
      transactionId,
    });

    for (const mediaItem of media) {
      await tablesDB.createRow({
        databaseId: config.databaseId,
        tableId: config.postMediaTableId,
        rowId: ID.unique(),
        data: {
          postId,
          fileId: mediaItem.fileId,
          sortOrder: mediaItem.sortOrder,
          width: mediaItem.width,
          height: mediaItem.height,
          aspectRatioBucket: mediaItem.aspectRatioBucket,
          placeholder: mediaItem.placeholder,
        },
        permissions: buildPublishedPostMediaRowPermissions(),
        transactionId,
      });
    }
  });

  const filePublicationFailed = await publishMediaFiles(storage, config, fileIds, log, error, {
    eventPrefix: 'content-actions.post-create',
  });

  return {
    postId,
    mediaCount: media.length,
    filePublicationFailed,
  };
}
