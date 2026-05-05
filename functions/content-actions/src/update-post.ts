import { AppwriteException, ID, Query, Storage, TablesDB, type Models } from 'node-appwrite';
import type { PostUpdateActionRequest } from './action.js';
import type { CurrentUserProfile } from './auth.js';
import type { AppwriteResourceConfig } from './config.js';
import { ContentActionError } from './errors.js';
import { buildPublishedPostMediaRowPermissions } from './permissions.js';
import { buildPostSearchText } from './post-search.js';
import {
  assertOwnedStagedFiles,
  buildPostCoverProjectionFromMedia,
  cleanupMediaFiles,
  listPostMediaRowsByPostId,
  normalizeUpdateMediaPayload,
  publishMediaFiles,
  resolvePostMediaDiff,
} from './post-media.js';
import { runTransaction } from './transactions.js';

const POST_UPDATE_SELECT = ['$id', 'creator.$id'];

type PostUpdateSnapshot = Models.Row & {
  creator?: string | (Models.Row & { $id: string }) | null;
};

export type UpdatePostResult = {
  postId: string;
  mediaCount: number;
  filePublicationFailed: boolean;
  removedFileCleanupFailed: boolean;
};

function resolveCreatorProfileId(post: PostUpdateSnapshot): string | null {
  if (typeof post.creator === 'string') {
    const creatorProfileId = post.creator.trim();
    return creatorProfileId.length > 0 ? creatorProfileId : null;
  }

  if (post.creator && typeof post.creator.$id === 'string') {
    const creatorProfileId = post.creator.$id.trim();
    return creatorProfileId.length > 0 ? creatorProfileId : null;
  }

  return null;
}

async function getPostUpdateSnapshot(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  postId: string,
): Promise<PostUpdateSnapshot | null> {
  try {
    return await tablesDB.getRow<PostUpdateSnapshot>({
      databaseId: config.databaseId,
      tableId: config.postsTableId,
      rowId: postId,
      queries: [Query.select(POST_UPDATE_SELECT)],
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return null;
    }

    throw error;
  }
}

function assertCanUpdatePost(post: PostUpdateSnapshot, profile: CurrentUserProfile): void {
  const creatorProfileId = resolveCreatorProfileId(post);

  if (!creatorProfileId || creatorProfileId !== profile.id) {
    throw new ContentActionError(
      'POST_UPDATE_FORBIDDEN',
      403,
      'You do not have permission to update this post.',
      {
        postId: post.$id,
        viewerProfileId: profile.id,
        creatorProfileId,
      },
    );
  }
}

export async function updatePostForCurrentUser(
  tablesDB: TablesDB,
  storage: Storage,
  config: AppwriteResourceConfig,
  profile: CurrentUserProfile,
  request: PostUpdateActionRequest,
  log: (message: string) => void,
  error: (message: string) => void,
): Promise<UpdatePostResult> {
  const post = await getPostUpdateSnapshot(tablesDB, config, request.postId);

  if (!post) {
    throw new ContentActionError('POST_NOT_FOUND', 404, 'Post not found.', {
      postId: request.postId,
    });
  }

  assertCanUpdatePost(post, profile);

  const existingRows = await listPostMediaRowsByPostId(tablesDB, config, request.postId);
  const normalizedMedia = normalizeUpdateMediaPayload(request.media);
  const mediaDiff = resolvePostMediaDiff(existingRows, normalizedMedia);
  const newFileIds = mediaDiff.newMedia.map((mediaItem) => mediaItem.fileId);
  const removedFileIds = mediaDiff.removedRows.map((mediaRow) => mediaRow.fileId);

  await assertOwnedStagedFiles(storage, config, newFileIds, profile.accountId);

  const coverProjection = buildPostCoverProjectionFromMedia(mediaDiff.finalMedia, config);

  await runTransaction(tablesDB, async (transactionId) => {
    await tablesDB.updateRow({
      databaseId: config.databaseId,
      tableId: config.postsTableId,
      rowId: request.postId,
      data: {
        caption: request.caption,
        imageId: coverProjection.imageId,
        imageUrl: coverProjection.imageUrl,
        aspectRatioBucket: coverProjection.aspectRatioBucket,
        imagePlaceholder: coverProjection.imagePlaceholder,
        imageWidth: coverProjection.imageWidth,
        imageHeight: coverProjection.imageHeight,
        location: request.location,
        tags: request.tags,
        searchText: buildPostSearchText(request.caption, request.tags),
        mediaCount: coverProjection.mediaCount,
      },
      transactionId,
    });

    for (const retainedMedia of mediaDiff.retainedRows) {
      await tablesDB.updateRow({
        databaseId: config.databaseId,
        tableId: config.postMediaTableId,
        rowId: retainedMedia.row.$id,
        data: {
          sortOrder: retainedMedia.sortOrder,
        },
        transactionId,
      });
    }

    for (const newMedia of mediaDiff.newMedia) {
      await tablesDB.createRow({
        databaseId: config.databaseId,
        tableId: config.postMediaTableId,
        rowId: ID.unique(),
        data: {
          postId: request.postId,
          fileId: newMedia.fileId,
          sortOrder: newMedia.sortOrder,
          width: newMedia.width,
          height: newMedia.height,
          aspectRatioBucket: newMedia.aspectRatioBucket,
          placeholder: newMedia.placeholder,
        },
        permissions: buildPublishedPostMediaRowPermissions(),
        transactionId,
      });
    }

    for (const removedRow of mediaDiff.removedRows) {
      await tablesDB.deleteRow({
        databaseId: config.databaseId,
        tableId: config.postMediaTableId,
        rowId: removedRow.$id,
        transactionId,
      });
    }
  });

  const filePublicationFailed = await publishMediaFiles(storage, config, newFileIds, log, error, {
    eventPrefix: 'content-actions.post-update',
  });
  const removedFileCleanupFailed = await cleanupMediaFiles(
    storage,
    config,
    removedFileIds,
    log,
    error,
    {
      eventPrefix: 'content-actions.post-update',
    },
  );

  return {
    postId: request.postId,
    mediaCount: mediaDiff.finalMedia.length,
    filePublicationFailed,
    removedFileCleanupFailed,
  };
}
