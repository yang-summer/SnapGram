import { Query } from 'appwrite';
import { appwriteConfig, tablesDB } from '~/lib/appwrite/config';

export async function getRecentPosts() {
  try {
    // 需要通过Queries选择加载的字段来加载关系数据, 首先需要加载全部字段, 之后选择关系的字段
    const posts = await tablesDB.listRows({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      queries: [
        Query.select(['*', 'creator.*', 'likes.*']),
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
