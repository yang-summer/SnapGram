import type { Models } from 'appwrite';
import { AppwriteException, ID, Query } from 'appwrite';
import { appwriteConfig, storage, tablesDB } from '~/lib/appwrite/config';
import {
  buildPublicOwnerPermissions,
  buildTransitionalPostPermissions,
} from '~/lib/appwrite/permissions';
import { buildPostSearchText } from '../lib/post-search';
import type {
  CreatePostApiInput,
  DeletePostResult,
  ListPostRowsParams,
  PostDeleteSnapshot,
  RawPostEditorRow,
  RawPostHomeFeedRow,
  RawPostListRow,
  RawPostMutationRow,
  RawPostRow,
  RawPostWriteRow,
  SearchPostRowsParams,
  UpdatePostApiInput,
} from '../types/post.type';

const DEFAULT_EXPLORE_POSTS_LIMIT = 9;
const DEFAULT_SEARCH_POSTS_LIMIT = 20;
const APPWRITE_MAX_LIST_LIMIT = 100;
const PUBLISHED_POST_STATUS = 'published';

const POST_CARD_SELECT = [
  '$id',
  '$createdAt',
  '$updatedAt',
  'caption',
  'imageId',
  'imageUrl',
  'location',
  'tags',
  'likeCount',
  'saveCount',
  'creator.$id',
  'creator.name',
  'creator.imageUrl',
];
const POST_GRID_SELECT = [
  '$id',
  '$createdAt',
  '$updatedAt',
  'caption',
  'imageUrl',
  'location',
  'tags',
  'likeCount',
  'saveCount',
  'creator.$id',
  'creator.name',
  'creator.imageUrl',
];
const POST_DETAIL_SELECT = [
  '$id',
  '$createdAt',
  '$updatedAt',
  'caption',
  'imageId',
  'imageUrl',
  'location',
  'tags',
  'likeCount',
  'saveCount',
  'creator.$id',
  'creator.name',
  'creator.imageUrl',
];
const POST_EDITOR_SELECT = ['$id', 'caption', 'imageId', 'imageUrl', 'location', 'tags'];
export const POST_HOME_FEED_SELECT = [
  '$id',
  '$createdAt',
  'caption',
  'imageUrl',
  'imagePlaceholder',
  'aspectRatioBucket',
  'imageWidth',
  'imageHeight',
  'likeCount',
  'creator.$id',
  'creator.name',
  'creator.imageUrl',
];

function clampListLimit(limit: number | undefined, fallback: number): number {
  if (typeof limit !== 'number' || Number.isNaN(limit)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), APPWRITE_MAX_LIST_LIMIT);
}

function createEmptyRowList<Row extends Models.Row>(): Models.RowList<Row> {
  return {
    total: 0,
    rows: [],
  };
}

export async function getRecentPosts(): Promise<Models.RowList<RawPostRow>> {
  try {
    const posts = await tablesDB.listRows<RawPostRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      queries: [
        Query.select(POST_CARD_SELECT),
        Query.equal('status', PUBLISHED_POST_STATUS),
        Query.orderDesc('$createdAt'),
        Query.limit(20),
      ],
    });

    if (!posts) throw Error;
    return posts;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function listHomeFeedPostRows({
  cursor = null,
  limit = DEFAULT_EXPLORE_POSTS_LIMIT,
}: ListPostRowsParams = {}): Promise<Models.RowList<RawPostHomeFeedRow>> {
  const normalizedLimit = clampListLimit(limit, DEFAULT_EXPLORE_POSTS_LIMIT);
  const queries = [
    Query.select(POST_HOME_FEED_SELECT),
    Query.equal('status', PUBLISHED_POST_STATUS),
    Query.orderDesc('$createdAt'),
    Query.limit(normalizedLimit),
  ];

  if (cursor) {
    queries.push(Query.cursorAfter(cursor));
  }

  try {
    const posts = await tablesDB.listRows<RawPostHomeFeedRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      queries,
      total: false,
    });

    if (!posts) {
      throw new Error('Failed to load home feed posts.');
    }

    return posts;
  } catch (error) {
    console.error('[PostApi.listHomeFeedPostRows] Failed to list home feed posts.', error);
    throw error;
  }
}

export async function getPostById(postId: string): Promise<RawPostRow> {
  if (!postId) throw Error;

  try {
    const post = await tablesDB.getRow<RawPostRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: postId,
      queries: [Query.select(POST_DETAIL_SELECT)],
    });

    if (!post) throw Error;

    return post;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getPostEditorRow(postId: string): Promise<RawPostEditorRow> {
  if (!postId) {
    throw new Error('Post ID is required to load post editor data.');
  }

  try {
    const post = await tablesDB.getRow<RawPostEditorRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: postId,
      queries: [Query.select(POST_EDITOR_SELECT)],
    });

    if (!post) {
      throw new Error('Failed to load post editor data.');
    }

    return post;
  } catch (error) {
    console.error('[PostApi.getPostEditorRow] Failed to load post editor data.', error);
    throw error;
  }
}

export function getPostImageView(fileId: string): string {
  return storage.getFileView({
    bucketId: appwriteConfig.storageId,
    fileId,
  });
}

export async function uploadPostImage(file: File, ownerAccountId: string): Promise<Models.File> {
  if (!file) {
    throw new Error('A post image file is required.');
  }

  if (!ownerAccountId) {
    throw new Error('Owner account ID is required to upload a post image.');
  }

  try {
    return await storage.createFile({
      bucketId: appwriteConfig.storageId,
      fileId: ID.unique(),
      file,
      permissions: buildPublicOwnerPermissions(ownerAccountId),
    });
  } catch (error) {
    console.error('[PostApi.uploadPostImage] Failed to upload post image.', error);
    throw error;
  }
}

export async function deletePostImage(fileId: string): Promise<void> {
  if (!fileId) {
    throw new Error('File ID is required to delete a post image.');
  }

  try {
    await storage.deleteFile({
      bucketId: appwriteConfig.storageId,
      fileId,
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return;
    }

    console.error('[PostApi.deletePostImage] Failed to delete post image.', error);
    throw error;
  }
}

export async function createPostRow(input: CreatePostApiInput): Promise<RawPostMutationRow> {
  if (!input.creatorProfileId) {
    throw new Error('Creator profile ID is required to create a post.');
  }

  if (!input.ownerAccountId) {
    throw new Error('Owner account ID is required to create a post.');
  }

  try {
    const row = await tablesDB.createRow<RawPostWriteRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: ID.unique(),
      data: {
        creator: input.creatorProfileId,
        caption: input.caption,
        imageId: input.imageId,
        imageUrl: input.imageUrl,
        location: input.location,
        tags: input.tags,
        status: PUBLISHED_POST_STATUS,
        searchText: buildPostSearchText(input.caption, input.tags),
      },
      permissions: buildTransitionalPostPermissions(input.ownerAccountId),
    });

    return {
      $id: row.$id,
      $createdAt: row.$createdAt,
      $databaseId: row.$databaseId,
      $permissions: row.$permissions,
      $sequence: row.$sequence,
      $tableId: row.$tableId,
      $updatedAt: row.$updatedAt,
      imageId: row.imageId,
      imageUrl: row.imageUrl,
    };
  } catch (error) {
    console.error('[PostApi.createPostRow] Failed to create post row.', error);
    throw error;
  }
}

export async function updatePostRow(input: UpdatePostApiInput): Promise<RawPostMutationRow> {
  try {
    const row = await tablesDB.updateRow<RawPostWriteRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: input.postId,
      data: {
        caption: input.caption,
        imageId: input.imageId,
        imageUrl: input.imageUrl,
        location: input.location,
        tags: input.tags,
        searchText: buildPostSearchText(input.caption, input.tags),
      },
    });

    return {
      $id: row.$id,
      $createdAt: row.$createdAt,
      $databaseId: row.$databaseId,
      $permissions: row.$permissions,
      $sequence: row.$sequence,
      $tableId: row.$tableId,
      $updatedAt: row.$updatedAt,
      imageId: row.imageId,
      imageUrl: row.imageUrl,
    };
  } catch (error) {
    console.error('[PostApi.updatePostRow] Failed to update post row.', error);
    throw error;
  }
}

export async function listExplorePostRows({
  cursor = null,
  limit = DEFAULT_EXPLORE_POSTS_LIMIT,
}: ListPostRowsParams = {}): Promise<Models.RowList<RawPostListRow>> {
  const normalizedLimit = clampListLimit(limit, DEFAULT_EXPLORE_POSTS_LIMIT);
  const queries = [
    Query.select(POST_GRID_SELECT),
    Query.equal('status', PUBLISHED_POST_STATUS),
    Query.orderDesc('$updatedAt'),
    Query.limit(normalizedLimit),
  ];

  if (cursor) {
    queries.push(Query.cursorAfter(cursor));
  }

  try {
    const posts = await tablesDB.listRows<RawPostListRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      queries,
      total: false,
    });

    if (!posts) {
      throw new Error('Failed to load explore posts.');
    }

    return posts;
  } catch (error) {
    console.error('[PostApi.listExplorePostRows] Failed to list explore posts.', error);
    throw error;
  }
}

export async function searchPostRows({
  term,
  limit = DEFAULT_SEARCH_POSTS_LIMIT,
}: SearchPostRowsParams): Promise<Models.RowList<RawPostListRow>> {
  const normalizedTerm = term.trim();

  if (normalizedTerm.length < 3) {
    return createEmptyRowList<RawPostListRow>();
  }

  const normalizedLimit = clampListLimit(limit, DEFAULT_SEARCH_POSTS_LIMIT);

  try {
    const posts = await tablesDB.listRows<RawPostListRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      queries: [
        Query.select(POST_GRID_SELECT),
        Query.equal('status', PUBLISHED_POST_STATUS),
        Query.search('searchText', normalizedTerm),
        Query.orderDesc('$updatedAt'),
        Query.limit(normalizedLimit),
      ],
      total: false,
    });

    if (!posts) {
      throw new Error('Failed to search posts.');
    }

    return posts;
  } catch (error) {
    console.error('[PostApi.searchPostRows] Failed to search posts.', error);
    throw error;
  }
}

export async function deletePost(postId: string): Promise<DeletePostResult> {
  if (!postId) {
    throw new Error('Post ID is required to delete a post.');
  }

  try {
    const post = await tablesDB.getRow<PostDeleteSnapshot>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: postId,
      queries: [Query.select(['imageId'])],
    });

    await tablesDB.deleteRow({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: postId,
    });

    let imageCleanupFailed = false;

    if (post.imageId) {
      try {
        await storage.deleteFile({
          bucketId: appwriteConfig.storageId,
          fileId: post.imageId,
        });
      } catch (error) {
        if (!(error instanceof AppwriteException && error.code === 404)) {
          imageCleanupFailed = true;
          console.error('[PostApi.deletePost] Failed to delete post image.', error);
        }
      }
    }

    return {
      postId,
      imageCleanupFailed,
    };
  } catch (error) {
    console.error('[PostApi.deletePost] Failed to delete post.', error);
    throw error;
  }
}
