import { ID, Query } from 'appwrite';
import type { NewUser } from '../types';
import { account, appwriteConfig, avatars, tablesDB } from './config';

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
