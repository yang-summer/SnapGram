import { ID, ImageGravity, Query } from 'appwrite';
import type { NewPost, NewUser } from '../types';
import { account, appwriteConfig, avatars, storage, tablesDB } from './config';

export async function createUserAccount(user: NewUser) {
  try {
    const newAccount = await account.create({
      userId: ID.unique(),
      email: user.email,
      password: user.password,
      name: user.name,
    });

    if (!newAccount) throw Error;

    const avatarUrl = avatars.getInitials({ name: user.name });

    const newUser = await saveUserToDB({
      accountId: newAccount.$id,
      email: newAccount.email,
      name: newAccount.name,
      imageUrl: avatarUrl,
      username: user.username,
    });

    return newUser;
  } catch (error) {
    console.log(error);
    return error;
  }
}

export async function saveUserToDB(user: {
  accountId: string;
  email: string;
  name: string;
  imageUrl: string;
  username?: string;
}) {
  try {
    const newUser = await tablesDB.createRow({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.usersTableId,
      rowId: ID.unique(),
      data: user,
    });

    return newUser;
  } catch (error) {
    console.log(error);
  }
}

export async function signInAccount(user: { email: string; password: string }) {
  try {
    const result = await account.createEmailPasswordSession({
      email: user.email,
      password: user.password,
    });
    return result;
  } catch (error) {
    console.log(error);
  }
}

export async function getCurrentUser() {
  try {
    const currentAccount = await account.get();

    if (!currentAccount) throw Error;

    const currentUser = await tablesDB.listRows({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.usersTableId,
      queries: [Query.equal('accountId', currentAccount.$id), Query.select(['*', 'save.*'])],
    });

    if (!currentUser) throw Error;

    return currentUser.rows[0];
  } catch (error) {
    console.log(error);
  }
}

export async function signOutAccount() {
  try {
    const session = await account.deleteSession({ sessionId: 'current' });

    return session;
  } catch (error) {
    console.log(error);
  }
}

export async function createPost(post: NewPost) {
  try {
    // Upload image to storage
    const uploadedFile = await uploadFile(post.file[0]);

    if (!uploadedFile) throw Error;

    // Get file url
    const fileUrl = await getFileView(uploadedFile.$id);

    if (!fileUrl) {
      await deleteFile(uploadedFile.$id);
      throw Error;
    }

    // Convert tags into array
    const tags = post.tags?.replace(/ /g, '').split(',') || [];

    // Save post to database
    const newPost = await tablesDB.createRow({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: ID.unique(),
      data: {
        creator: post.userId,
        caption: post.caption,
        imageUrl: fileUrl,
        imageId: uploadedFile.$id,
        location: post.location,
        tags: tags,
      },
    });

    if (!newPost) {
      await deleteFile(uploadedFile.$id);
      throw Error;
    }

    return newPost;
  } catch (error) {
    console.log(error);
  }
}

export async function uploadFile(file: File) {
  try {
    const uploadedFile = await storage.createFile({
      bucketId: appwriteConfig.storageId,
      fileId: ID.unique(),
      file: file,
    });

    return uploadedFile;
  } catch (error) {
    console.log(error);
  }
}

export async function getFileView(fileId: string) {
  try {
    // getFilePreview 支持对图片进行裁剪, 需要收费, 因此使用getFileView
    const fileUrl = storage.getFileView({
      bucketId: appwriteConfig.storageId,
      fileId: fileId,
    });
    console.log('fileUrl', fileUrl);
    return fileUrl;
  } catch (error) {
    console.log(error);
  }
}

export async function deleteFile(fileId: string) {
  try {
    await storage.deleteFile({
      bucketId: appwriteConfig.storageId,
      fileId: fileId,
    });

    return { status: 'ok' };
  } catch (error) {
    console.log(error);
  }
}

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

    return posts;
  } catch (error) {
    console.log(error);
  }
}

export async function likePost(postId: string, likesArray: string[]) {
  try {
    const updatedPost = await tablesDB.updateRow({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: postId,
      data: { likes: likesArray },
    });

    if (!updatedPost) throw Error;

    return updatedPost;
  } catch (error) {
    console.log(error);
  }
}

export async function savePost(postId: string, userId: string) {
  try {
    const updatedPost = await tablesDB.createRow({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.saveTableId,
      rowId: ID.unique(),
      data: { user: userId, post: postId },
    });

    if (!updatedPost) throw Error;

    return updatedPost;
  } catch (error) {
    console.log(error);
  }
}

export async function deleteSavedPost(savedRecordId: string) {
  try {
    const statusCode = await tablesDB.deleteRow({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.saveTableId,
      rowId: savedRecordId,
    });

    if (!statusCode) throw Error;

    return { status: 'ok' };
  } catch (error) {
    console.log(error);
  }
}
