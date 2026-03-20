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
      queries: [Query.equal('accountId', currentAccount.$id)],
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
    const fileUrl = await getFilePreview(uploadedFile.$id);

    if (!fileUrl) {
      await deleteFile(uploadedFile.$id);
      throw Error;
    }

    // Convert tags into array
    const tags = post.tags?.replace(/ /g, '').split(',') || [];

    // Save post to database
    const newPost = await tablesDB.createRow(
      appwriteConfig.databaseId,
      appwriteConfig.postsTableId,
      ID.unique(),
      {
        creator: post.userId,
        caption: post.caption,
        imageUrl: fileUrl,
        imageId: uploadedFile.$id,
        location: post.location,
        tags: tags,
      },
    );

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

export async function getFilePreview(fileId: string) {
  try {
    const fileUrl = storage.getFilePreview({
      bucketId: appwriteConfig.storageId,
      fileId: fileId,
      width: 2000,
      height: 2000,
      gravity: ImageGravity.Top,
      quality: 100,
    });
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
