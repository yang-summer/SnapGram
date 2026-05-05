import {
  DEFAULT_HOME_FEED_PAGE_SIZE,
  DEFAULT_PROFILE_FEED_PAGE_SIZE,
  DEFAULT_SEARCH_POST_PAGE_SIZE,
  countProfilePublishedPosts,
  getPostImageView,
  getPostEditorRow,
  getPostById,
  getRecentPosts,
  listHomeFeedPostRows,
  listExplorePostRows,
  listProfilePublishedPostRows,
  listSearchPostRows,
  searchPostRows,
  updatePostRow,
} from '../api/post.api';
import {
  createPostWithContentAction,
  deletePostWithContentAction,
} from '../api/post.actions.api';
import { getImageMetadata } from '../lib/image-metadata';
import { buildCreatePostActionPayload } from '../lib/post-publish-payload';
import {
  buildUploadedFileIdMap,
  cleanupUploadedMediaFiles,
  uploadNewMediaItems,
} from '../lib/post-upload-cleanup';
import {
  mapHomeFeedRowsToCursorPage,
  mapPostRowsToCardViewModels,
  mapPostRowsToCursorPage,
  mapPostRowsToGridItemViewModels,
  mapPostEditorRowToInitialData,
  mapPostRowToDetailViewModel,
} from '../mappers/post.mapper';
import type {
  CreatePostPublishInput,
  CreatePostPublishResult,
  CursorPage,
  DeletePostResult,
  HomeFeedPostViewModel,
  ImageMetadataResult,
  ListPostRowsParams,
  PostCardViewModel,
  PostDetailViewModel,
  PostEditorInitialData,
  ProfileFeedPage,
  ProfilePostPageParams,
  PostGridItemViewModel,
  RawPostMutationRow,
  UploadedPostMediaFile,
  SearchFeedPage,
  SearchPostPageParams,
  SearchPostRowsParams,
  UpdatePostPublishInput,
  UpdatePostPublishResult,
} from '../types/post.type';
import { DEFAULT_POST_ASPECT_RATIO_BUCKET } from '../types/post.type';

const DEFAULT_EXPLORE_POST_PAGE_SIZE = 9;
const DEFAULT_SEARCH_RESULTS_LIMIT = 20;
const APPWRITE_MAX_LIST_LIMIT = 100;

function clampListLimit(limit: number | undefined, fallback: number): number {
  if (typeof limit !== 'number' || Number.isNaN(limit)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), APPWRITE_MAX_LIST_LIMIT);
}

function mapLegacyUpdateResult(row: RawPostMutationRow): UpdatePostPublishResult {
  return {
    postId: row.$id,
    mediaCount: 1,
    filePublicationFailed: false,
    removedFileCleanupFailed: false,
  };
}

function createFallbackImageMetadata(): ImageMetadataResult {
  return {
    width: null,
    height: null,
    aspectRatioBucket: DEFAULT_POST_ASPECT_RATIO_BUCKET,
    placeholder: null,
  };
}

function hasUsablePreparedImageMetadata(
  metadata: ImageMetadataResult | null | undefined,
): metadata is ImageMetadataResult {
  if (!metadata) {
    return false;
  }

  return metadata.width !== null && metadata.height !== null;
}

async function resolveImageMetadata(
  file: File,
  preparedImageMetadata?: ImageMetadataResult | null,
): Promise<ImageMetadataResult> {
  if (hasUsablePreparedImageMetadata(preparedImageMetadata)) {
    return preparedImageMetadata;
  }

  try {
    const resolvedMetadata = await getImageMetadata(file);

    if (hasUsablePreparedImageMetadata(resolvedMetadata)) {
      return resolvedMetadata;
    }
  } catch (error) {
    console.error('[PostService.resolveImageMetadata] Failed to compute image metadata.', error);
  }

  return createFallbackImageMetadata();
}

export async function getRecentPostCards(): Promise<PostCardViewModel[]> {
  try {
    // 1. 调用 API 获取原始数据
    const response = await getRecentPosts();

    // 2. 业务规则：防御性编程，处理空列表或无效响应
    // 如果有 total 为 0 的情况，在这里提前拦截，返回空数组
    if (!response || !response.rows || response.rows.length === 0) {
      return [];
    }

    // 3. 将 raw rows 交给 mapper 进行转换
    const viewModels = mapPostRowsToCardViewModels(response);

    return viewModels;
  } catch (error) {
    // 记录 Service 层错误日志
    console.error(`[PostService.getRecentPostCards] Error:`, error);

    throw error;
  }
}

export async function getPostDetail(postId: string): Promise<PostDetailViewModel | null> {
  try {
    // 1. 调用 API 获取原始数据
    const response = await getPostById(postId);

    // 2. 业务规则：防御性编程，处理空结果或无效响应
    if (!response) {
      return null;
    }

    // 3. 将 raw row 交给 mapper 进行转换
    const viewModel = mapPostRowToDetailViewModel(response);

    return viewModel;
  } catch (error) {
    // 记录 Service 层错误日志
    console.error(`[PostService.getPostDetail] Error:`, error);

    throw error;
  }
}

export async function getPostEditorInitialData(
  postId: string,
): Promise<PostEditorInitialData | null> {
  try {
    const response = await getPostEditorRow(postId);

    if (!response) {
      return null;
    }

    return mapPostEditorRowToInitialData(response);
  } catch (error) {
    console.error(`[PostService.getPostEditorInitialData] Error:`, error);
    throw error;
  }
}

export async function createPost(
  input: CreatePostPublishInput,
): Promise<CreatePostPublishResult> {
  let uploadedFiles: UploadedPostMediaFile[] = [];

  try {
    uploadedFiles = await uploadNewMediaItems(
      input.mediaItems.map((mediaItem) => ({
        clientMediaId: mediaItem.clientMediaId,
        file: mediaItem.file,
      })),
      input.ownerAccountId,
    );
    const uploadedFileIdByClientMediaId = buildUploadedFileIdMap(uploadedFiles);
    const payload = buildCreatePostActionPayload(input, uploadedFileIdByClientMediaId);

    return await createPostWithContentAction(payload);
  } catch (error) {
    await cleanupUploadedMediaFiles(uploadedFiles, 'createPost');
    console.error(`[PostService.createPost] Error:`, error);
    throw error;
  }
}

export async function updatePost(
  input: UpdatePostPublishInput,
): Promise<UpdatePostPublishResult> {
  const nextLocalMediaItem = input.mediaItems.find(
    (mediaItem): mediaItem is Extract<typeof mediaItem, { kind: 'local' }> =>
      mediaItem.kind === 'local',
  );
  const nextFile = nextLocalMediaItem?.file ?? null;

  if (!nextFile) {
    try {
      const existingCoverItem = input.mediaItems[0];

      if (!existingCoverItem || existingCoverItem.kind !== 'existing') {
        throw new Error('An existing cover media item is required for legacy post updates.');
      }

      const updatedPost = await updatePostRow({
        postId: input.postId,
        caption: input.caption,
        imageId: existingCoverItem.fileId ?? '',
        imageUrl: existingCoverItem.imageUrl,
        aspectRatioBucket: existingCoverItem.aspectRatioBucket,
        imagePlaceholder: existingCoverItem.placeholder,
        imageWidth: existingCoverItem.width,
        imageHeight: existingCoverItem.height,
        location: input.location,
        tags: input.tags,
      });

      return mapLegacyUpdateResult(updatedPost);
    } catch (error) {
      console.error(`[PostService.updatePost] Error:`, error);
      throw error;
    }
  }

  let uploadedFileId: string | null = null;
  let uploadedFiles: UploadedPostMediaFile[] = [];

  try {
    const imageMetadata = await resolveImageMetadata(nextFile, {
      width: nextLocalMediaItem?.width ?? null,
      height: nextLocalMediaItem?.height ?? null,
      aspectRatioBucket: nextLocalMediaItem?.aspectRatioBucket ?? DEFAULT_POST_ASPECT_RATIO_BUCKET,
      placeholder: nextLocalMediaItem?.placeholder ?? null,
    });
    uploadedFiles = await uploadNewMediaItems(
      nextLocalMediaItem
        ? [{ clientMediaId: nextLocalMediaItem.clientMediaId, file: nextLocalMediaItem.file }]
        : [],
      input.ownerAccountId,
    );
    const uploadedFileIdByClientMediaId = buildUploadedFileIdMap(uploadedFiles);
    uploadedFileId = nextLocalMediaItem
      ? uploadedFileIdByClientMediaId[nextLocalMediaItem.clientMediaId] ?? null
      : null;

    if (!uploadedFileId) {
      throw new Error(
        `Uploaded file ID is missing for media item ${nextLocalMediaItem?.clientMediaId ?? 'unknown'}.`,
      );
    }

    const updatedPost = await updatePostRow({
      postId: input.postId,
      caption: input.caption,
      imageId: uploadedFileId,
      imageUrl: getPostImageView(uploadedFileId),
      aspectRatioBucket: imageMetadata.aspectRatioBucket,
      imagePlaceholder: imageMetadata.placeholder,
      imageWidth: imageMetadata.width,
      imageHeight: imageMetadata.height,
      location: input.location,
      tags: input.tags,
    });

    const existingCoverItem = input.mediaItems.find(
      (mediaItem): mediaItem is Extract<typeof mediaItem, { kind: 'existing' }> =>
        mediaItem.kind === 'existing',
    );

    if (existingCoverItem?.fileId && existingCoverItem.fileId !== uploadedFileId) {
      try {
        await cleanupUploadedMediaFiles(
          [{ clientMediaId: existingCoverItem.clientMediaId, fileId: existingCoverItem.fileId }],
          'updatePost.removeLegacyCover',
        );
      } catch (error) {
        console.error('[PostService.updatePost] Failed to delete previous post image.', error);
      }
    }

    return mapLegacyUpdateResult(updatedPost);
  } catch (error) {
    await cleanupUploadedMediaFiles(uploadedFiles, 'updatePost');
    console.error(`[PostService.updatePost] Error:`, error);
    throw error;
  }
}

export async function deletePostById(postId: string): Promise<DeletePostResult> {
  try {
    return await deletePostWithContentAction(postId);
  } catch (error) {
    console.error(`[PostService.deletePostById] Error:`, error);
    throw error;
  }
}

export async function getExplorePostPage({
  cursor = null,
  limit = DEFAULT_EXPLORE_POST_PAGE_SIZE,
}: ListPostRowsParams = {}): Promise<CursorPage<PostGridItemViewModel>> {
  const normalizedLimit = clampListLimit(limit, DEFAULT_EXPLORE_POST_PAGE_SIZE);

  try {
    const response = await listExplorePostRows({
      cursor,
      limit: normalizedLimit,
    });

    if (!response || !Array.isArray(response.rows) || response.rows.length === 0) {
      return {
        items: [],
        nextCursor: null,
      };
    }

    return mapPostRowsToCursorPage(response, normalizedLimit);
  } catch (error) {
    console.error(`[PostService.getExplorePostPage] Error:`, error);
    throw error;
  }
}

export async function getHomeFeedPage({
  cursor = null,
  limit = DEFAULT_HOME_FEED_PAGE_SIZE,
}: ListPostRowsParams = {}): Promise<CursorPage<HomeFeedPostViewModel>> {
  const normalizedLimit = clampListLimit(limit, DEFAULT_HOME_FEED_PAGE_SIZE);

  try {
    const response = await listHomeFeedPostRows({
      cursor,
      limit: normalizedLimit,
    });

    if (!response || !Array.isArray(response.rows) || response.rows.length === 0) {
      return {
        items: [],
        nextCursor: null,
      };
    }

    return mapHomeFeedRowsToCursorPage(response, normalizedLimit);
  } catch (error) {
    console.error(`[PostService.getHomeFeedPage] Error:`, error);
    throw error;
  }
}

export async function getProfilePostPage({
  profileId,
  cursor = null,
  limit = DEFAULT_PROFILE_FEED_PAGE_SIZE,
}: ProfilePostPageParams): Promise<ProfileFeedPage> {
  const normalizedLimit = clampListLimit(limit, DEFAULT_PROFILE_FEED_PAGE_SIZE);

  try {
    const response = await listProfilePublishedPostRows({
      profileId,
      cursor,
      limit: normalizedLimit,
    });

    if (!response || !Array.isArray(response.rows) || response.rows.length === 0) {
      return {
        items: [],
        nextCursor: null,
      };
    }

    return mapHomeFeedRowsToCursorPage(response, normalizedLimit);
  } catch (error) {
    console.error(`[PostService.getProfilePostPage] Error:`, error);
    throw error;
  }
}

export async function getProfilePostCount(profileId: string): Promise<number> {
  try {
    return await countProfilePublishedPosts(profileId);
  } catch (error) {
    console.error(`[PostService.getProfilePostCount] Error:`, error);
    throw error;
  }
}

export async function getSearchPostPage({
  keyword,
  cursor = null,
  limit = DEFAULT_SEARCH_POST_PAGE_SIZE,
}: SearchPostPageParams): Promise<SearchFeedPage> {
  const normalizedLimit = clampListLimit(limit, DEFAULT_SEARCH_POST_PAGE_SIZE);

  try {
    const response = await listSearchPostRows({
      keyword,
      cursor,
      limit: normalizedLimit,
    });

    if (!response || !Array.isArray(response.rows) || response.rows.length === 0) {
      return {
        items: [],
        nextCursor: null,
      };
    }

    return mapHomeFeedRowsToCursorPage(response, normalizedLimit);
  } catch (error) {
    console.error(`[PostService.getSearchPostPage] Error:`, error);
    throw error;
  }
}

export async function searchExplorePosts({
  term,
  limit = DEFAULT_SEARCH_RESULTS_LIMIT,
}: SearchPostRowsParams): Promise<PostGridItemViewModel[]> {
  const normalizedLimit = clampListLimit(limit, DEFAULT_SEARCH_RESULTS_LIMIT);

  try {
    const response = await searchPostRows({
      term,
      limit: normalizedLimit,
    });

    if (!response || !Array.isArray(response.rows) || response.rows.length === 0) {
      return [];
    }

    return mapPostRowsToGridItemViewModels(response);
  } catch (error) {
    console.error(`[PostService.searchExplorePosts] Error:`, error);
    throw error;
  }
}
