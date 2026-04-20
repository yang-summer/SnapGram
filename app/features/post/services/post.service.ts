import {
  createPostRow,
  DEFAULT_HOME_FEED_PAGE_SIZE,
  deletePost,
  deletePostImage,
  getPostImageView,
  getPostEditorRow,
  getPostById,
  getRecentPosts,
  listHomeFeedPostRows,
  listExplorePostRows,
  searchPostRows,
  updatePostRow,
  uploadPostImage,
} from '../api/post.api';
import { getImageMetadata } from '../lib/image-metadata';
import {
  mapHomeFeedRowsToCursorPage,
  mapPostRowsToCardViewModels,
  mapPostRowsToCursorPage,
  mapPostRowsToGridItemViewModels,
  mapPostEditorRowToInitialData,
  mapPostRowToDetailViewModel,
} from '../mappers/post.mapper';
import type {
  CursorPage,
  CreatePostInput,
  DeletePostResult,
  HomeFeedPostViewModel,
  ImageMetadataResult,
  ListPostRowsParams,
  PostCardViewModel,
  PostDetailViewModel,
  PostEditorInitialData,
  PostGridItemViewModel,
  PostMutationResult,
  RawPostMutationRow,
  SearchPostRowsParams,
  UpdatePostInput,
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

function mapPostMutationRowToResult(row: RawPostMutationRow): PostMutationResult {
  return {
    id: row.$id,
    imageId: row.imageId,
    imageUrl: row.imageUrl,
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

async function cleanupUploadedImage(fileId: string | null, context: string): Promise<void> {
  if (!fileId) {
    return;
  }

  try {
    await deletePostImage(fileId);
  } catch (error) {
    console.error(`[PostService.${context}] Failed to clean up uploaded post image.`, error);
  }
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

export async function createPost(input: CreatePostInput): Promise<PostMutationResult> {
  let uploadedFileId: string | null = null;

  try {
    const imageMetadata = await resolveImageMetadata(input.file, input.preparedImageMetadata);
    const uploadedFile = await uploadPostImage(input.file, input.ownerAccountId);
    uploadedFileId = uploadedFile.$id;

    const createdPost = await createPostRow({
      creatorProfileId: input.creatorProfileId,
      ownerAccountId: input.ownerAccountId,
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

    return mapPostMutationRowToResult(createdPost);
  } catch (error) {
    await cleanupUploadedImage(uploadedFileId, 'createPost');
    console.error(`[PostService.createPost] Error:`, error);
    throw error;
  }
}

export async function updatePost(input: UpdatePostInput): Promise<PostMutationResult> {
  const nextFile = input.nextFile ?? null;

  if (!nextFile) {
    try {
      const updatedPost = await updatePostRow({
        postId: input.postId,
        caption: input.caption,
        imageId: input.currentImageId,
        imageUrl: input.currentImageUrl,
        aspectRatioBucket: input.currentAspectRatioBucket,
        imagePlaceholder: input.currentImagePlaceholder,
        imageWidth: input.currentImageWidth,
        imageHeight: input.currentImageHeight,
        location: input.location,
        tags: input.tags,
      });

      return mapPostMutationRowToResult(updatedPost);
    } catch (error) {
      console.error(`[PostService.updatePost] Error:`, error);
      throw error;
    }
  }

  let uploadedFileId: string | null = null;

  try {
    const imageMetadata = await resolveImageMetadata(nextFile, input.nextPreparedImageMetadata);
    const uploadedFile = await uploadPostImage(nextFile, input.ownerAccountId);
    uploadedFileId = uploadedFile.$id;

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

    if (input.currentImageId && input.currentImageId !== uploadedFileId) {
      try {
        await deletePostImage(input.currentImageId);
      } catch (error) {
        console.error('[PostService.updatePost] Failed to delete previous post image.', error);
      }
    }

    return mapPostMutationRowToResult(updatedPost);
  } catch (error) {
    await cleanupUploadedImage(uploadedFileId, 'updatePost');
    console.error(`[PostService.updatePost] Error:`, error);
    throw error;
  }
}

export async function deletePostById(postId: string): Promise<DeletePostResult> {
  try {
    return await deletePost(postId);
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
