import {
  createPostRow,
  deletePost,
  deletePostImage,
  getPostImageView,
  getPostEditorRow,
  getPostById,
  getRecentPosts,
  listExplorePostRows,
  searchPostRows,
  updatePostRow,
  uploadPostImage,
} from '../api/post.api';
import {
  mapPostRowsToCardViewModels,
  mapPostRowsToCursorPage,
  mapPostRowsToGridItemViewModels,
  mapPostRowToDetailViewModel,
} from '../mappers/post.mapper';
import type {
  CursorPage,
  CreatePostInput,
  DeletePostResult,
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

    return {
      id: response.$id,
      caption: response.caption ?? '',
      imageId: response.imageId,
      imageUrl: response.imageUrl,
      location: response.location ?? '',
      tags: (response.tags ?? []).join(', '),
    };
  } catch (error) {
    console.error(`[PostService.getPostEditorInitialData] Error:`, error);
    throw error;
  }
}

export async function createPost(input: CreatePostInput): Promise<PostMutationResult> {
  let uploadedFileId: string | null = null;

  try {
    const uploadedFile = await uploadPostImage(input.file, input.ownerAccountId);
    uploadedFileId = uploadedFile.$id;

    const createdPost = await createPostRow({
      creatorProfileId: input.creatorProfileId,
      ownerAccountId: input.ownerAccountId,
      caption: input.caption,
      imageId: uploadedFileId,
      imageUrl: getPostImageView(uploadedFileId),
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
    const uploadedFile = await uploadPostImage(nextFile, input.ownerAccountId);
    uploadedFileId = uploadedFile.$id;

    const updatedPost = await updatePostRow({
      postId: input.postId,
      caption: input.caption,
      imageId: uploadedFileId,
      imageUrl: getPostImageView(uploadedFileId),
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
