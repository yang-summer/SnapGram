import type { Models } from 'appwrite';
import { AppwriteException, Query } from 'appwrite';
import { appwriteConfig, storage, tablesDB } from '~/lib/appwrite/config';
import type { DeletePostResult, PostDeleteSnapshot, RawPostRow } from '../types/post.type';

export async function getRecentPosts(): Promise<Models.RowList<RawPostRow>> {
  try {
    // 需要通过Queries选择加载的字段来加载关系数据, 首先需要加载全部字段, 之后选择关系的字段
    const posts = await tablesDB.listRows<RawPostRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      queries: [
        // 只要关系被展开成 row，对象就会带系统字段，所以 likes.$id 会带上其他系统字段
        Query.select(['*', 'creator.*', 'likes.$id']),
        Query.orderDesc('$createdAt'),
        Query.limit(20),
      ],
    });

    if (!posts) throw Error;
    console.log('posts: ', posts);
    return posts;
  } catch (error) {
    console.error(error);
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
      queries: [Query.select(['*', 'creator.*', 'likes.$id'])],
    });

    if (!post) throw Error;

    return post;
  } catch (error) {
    console.error(error);
    throw Error;
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
