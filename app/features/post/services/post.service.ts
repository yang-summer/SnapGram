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
  listPostMediaRowsByPostIdForEditor,
  listProfilePublishedPostRows,
  listSearchPostRows,
  searchPostRows,
} from '../api/post.api';
import {
  createPostWithContentAction,
  deletePostWithContentAction,
  updatePostWithContentAction,
} from '../api/post.actions.api';
import {
  buildCreatePostActionPayload,
  buildUpdatePostActionPayload,
} from '../lib/post-publish-payload';
import {
  buildUploadedFileIdMap,
  cleanupUploadedMediaFiles,
  uploadNewMediaItems,
} from '../lib/post-upload-cleanup';
import {
  mapHomeFeedRowsToCursorPage,
  mapPostMediaRowsToExistingEditorItems,
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
  ListPostRowsParams,
  PostCardViewModel,
  PostDetailViewModel,
  PostEditorInitialData,
  ProfileFeedPage,
  ProfilePostPageParams,
  PostGridItemViewModel,
  UploadedPostMediaFile,
  SearchFeedPage,
  SearchPostPageParams,
  SearchPostRowsParams,
  UpdatePostPublishInput,
  UpdatePostPublishResult,
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
    const [postRow, postMediaRows] = await Promise.all([
      getPostEditorRow(postId),
      listPostMediaRowsByPostIdForEditor(postId),
    ]);

    if (!postRow) {
      return null;
    }

    const existingMediaItems = mapPostMediaRowsToExistingEditorItems(
      postMediaRows,
      getPostImageView,
    );

    return mapPostEditorRowToInitialData(postRow, existingMediaItems);
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
  let uploadedFiles: UploadedPostMediaFile[] = [];

  try {
    uploadedFiles = await uploadNewMediaItems(
      input.mediaItems
        .filter(
          (mediaItem): mediaItem is Extract<typeof mediaItem, { kind: 'local' }> =>
            mediaItem.kind === 'local',
        )
        .map((mediaItem) => ({
          clientMediaId: mediaItem.clientMediaId,
          file: mediaItem.file,
        })),
      input.ownerAccountId,
    );
    const uploadedFileIdByClientMediaId = buildUploadedFileIdMap(uploadedFiles);
    const payload = buildUpdatePostActionPayload(input, uploadedFileIdByClientMediaId);

    return await updatePostWithContentAction(payload);
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
