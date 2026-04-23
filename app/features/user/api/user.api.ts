import { AppwriteException, ID, Query } from 'appwrite';
import type { Models } from 'appwrite';
import { appwriteConfig, avatars, storage, tablesDB } from '~/lib/appwrite/config';
import { buildPublicOwnerPermissions } from '~/lib/appwrite/permissions';
import type {
  CreateUserProfileInput,
  RepairUserProfileInput,
  UpdateEditableUserProfileInput,
  UserProfileRecord,
  UserSaveRecord,
} from '../types/user.type';

export const USER_PROFILE_AUTH_SELECT = [
  '$id',
  'accountId',
  'email',
  'name',
  'username',
  'imageUrl',
  'bio',
];

export const USER_PROFILE_PUBLIC_SELECT = ['$id', 'name', 'username', 'imageUrl', 'bio'];

export const USER_PROFILE_EDIT_SELECT = [
  '$id',
  'accountId',
  'email',
  'name',
  'username',
  'imageId',
  'imageUrl',
  'bio',
];

export function getDefaultUserProfileImageUrl(name: string): string {
  return avatars.getInitials({ name });
}

export function getUserAvatarImageView(fileId: string): string {
  return storage.getFileView({
    bucketId: appwriteConfig.storageId,
    fileId,
  });
}

export async function uploadUserAvatar(file: File, ownerAccountId: string): Promise<Models.File> {
  if (!file) {
    throw new Error('A user avatar file is required.');
  }

  if (!ownerAccountId) {
    throw new Error('Owner account ID is required to upload a user avatar.');
  }

  try {
    return await storage.createFile({
      bucketId: appwriteConfig.storageId,
      fileId: ID.unique(),
      file,
      permissions: buildPublicOwnerPermissions(ownerAccountId),
    });
  } catch (error) {
    console.error('[UserApi.uploadUserAvatar] Failed to upload user avatar.', error);
    throw error;
  }
}

export async function deleteUserAvatarImage(fileId: string): Promise<void> {
  if (!fileId) {
    throw new Error('File ID is required to delete a user avatar image.');
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

    console.error('[UserApi.deleteUserAvatarImage] Failed to delete user avatar image.', error);
    throw error;
  }
}

export async function createUserProfile(input: CreateUserProfileInput): Promise<UserProfileRecord> {
  if (!input.accountId) {
    throw new Error('Account ID is required to create a user profile.');
  }

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
      permissions: buildPublicOwnerPermissions(input.accountId),
    });
  } catch (error) {
    console.error('[UserApi.createUserProfile] Failed to create user profile.', error);
    throw error;
  }
}

export async function updateUserProfile(
  profileId: string,
  input: RepairUserProfileInput,
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

export async function updateEditableUserProfile(
  profileId: string,
  input: UpdateEditableUserProfileInput,
): Promise<UserProfileRecord> {
  if (!profileId) {
    throw new Error('Profile ID is required to update an editable user profile.');
  }

  try {
    return await tablesDB.updateRow<UserProfileRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.usersTableId,
      rowId: profileId,
      data: {
        name: input.name,
        imageId: input.imageId ?? null,
        imageUrl: input.imageUrl,
        bio: input.bio ?? null,
      },
    });
  } catch (error) {
    console.error('[UserApi.updateEditableUserProfile] Failed to update editable user profile.', error);
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
        Query.select(USER_PROFILE_AUTH_SELECT),
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

export async function getPublicUserProfileById(
  profileId: string,
): Promise<UserProfileRecord | null> {
  if (!profileId) {
    throw new Error('Profile ID is required to load a public user profile.');
  }

  try {
    return await tablesDB.getRow<UserProfileRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.usersTableId,
      rowId: profileId,
      queries: [Query.select(USER_PROFILE_PUBLIC_SELECT)],
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return null;
    }

    console.error('[UserApi.getPublicUserProfileById] Failed to load public user profile.', error);
    throw error;
  }
}

export async function getEditableUserProfileById(
  profileId: string,
): Promise<UserProfileRecord | null> {
  if (!profileId) {
    throw new Error('Profile ID is required to load an editable user profile.');
  }

  try {
    return await tablesDB.getRow<UserProfileRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.usersTableId,
      rowId: profileId,
      queries: [Query.select(USER_PROFILE_EDIT_SELECT)],
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return null;
    }

    console.error(
      '[UserApi.getEditableUserProfileById] Failed to load editable user profile.',
      error,
    );
    throw error;
  }
}
