import { Account, Avatars, Client, TablesDB, Storage } from 'appwrite';

export const appwriteConfig = {
  url: import.meta.env.VITE_APPWRITE_URL,
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID,
  storageId: import.meta.env.VITE_APPWRITE_STORAGE_ID,
  usersTableId: import.meta.env.VITE_APPWRITE_USERS_TABLE_ID,
  postsTableId: import.meta.env.VITE_APPWRITE_POSTS_TABLE_ID,
  saveTableId: import.meta.env.VITE_APPWRITE_SAVES_TABLE_ID,
  likesTableId: import.meta.env.VITE_APPWRITE_LIKES_TABLE_ID,
};

export const client = new Client();

client.setProject(appwriteConfig.projectId).setEndpoint(appwriteConfig.url);

export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
export const avatars = new Avatars(client);
