import { ID, Query } from 'appwrite';
import { appwriteConfig, avatars, tablesDB } from '~/lib/appwrite/config';
import type {
  CreateUserProfileInput,
  UpdateUserProfileInput,
  UserProfileRecord,
  UserSaveRecord,
} from '../types/user.type';

const USER_PROFILE_SELECT = ['$id', 'accountId', 'email', 'name', 'username', 'imageUrl', 'bio'];

export function getDefaultUserProfileImageUrl(name: string): string {
  return avatars.getInitials({ name });
}

export async function createUserProfile(
  input: CreateUserProfileInput,
): Promise<UserProfileRecord> {
  try {
    return await tablesDB.createRow<UserProfileRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.usersTableId,
      rowId: ID.unique(),
      data: {
        accountId: input.accountId,
        email: input.email,
        name: input.name,
        username: input.username,
        imageUrl: input.imageUrl,
        bio: input.bio ?? null,
      },
    });
  } catch (error) {
    console.error('[UserApi.createUserProfile] Failed to create user profile.', error);
    throw error;
  }
}

export async function updateUserProfile(
  profileId: string,
  input: UpdateUserProfileInput,
): Promise<UserProfileRecord> {
  if (!profileId) {
    throw new Error('Profile ID is required to update a user profile.');
  }

  try {
    return await tablesDB.updateRow<UserProfileRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.usersTableId,
      rowId: profileId,
      data: {
        email: input.email,
        name: input.name,
        username: input.username,
        imageUrl: input.imageUrl,
        bio: input.bio ?? null,
      },
    });
  } catch (error) {
    console.error('[UserApi.updateUserProfile] Failed to update user profile.', error);
    throw error;
  }
}

export async function getUserProfileByAccountId(
  accountId: string,
): Promise<UserProfileRecord | null> {
  if (!accountId) {
    throw new Error('Account ID is required to load a user profile.');
  }

  try {
    const result = await tablesDB.listRows<UserProfileRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.usersTableId,
      queries: [
        Query.select(USER_PROFILE_SELECT),
        Query.equal('accountId', accountId),
        Query.limit(1),
      ],
      total: false,
    });

    return result.rows[0] ?? null;
  } catch (error) {
    console.error('[UserApi.getUserProfileByAccountId] Failed to load user profile.', error);
    throw error;
  }
}

export async function listUserSaveRecords(profileId: string): Promise<UserSaveRecord[]> {
  if (!profileId) {
    return [];
  }

  try {
    const result = await tablesDB.listRows<UserSaveRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.saveTableId,
      queries: [
        Query.select(['*', 'post.$id']),
        Query.equal('user', profileId),
        Query.limit(100),
      ],
      total: false,
    });

    return result.rows;
  } catch (error) {
    console.error('[UserApi.listUserSaveRecords] Failed to load save records.', error);
    throw error;
  }
}
