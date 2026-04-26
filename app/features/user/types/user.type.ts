import type { Models } from 'appwrite';

export type CreateUserProfileInput = {
  accountId: string;
  email: string;
  name: string;
  username: string;
  imageUrl: string;
  bio?: string | null;
};

export type RepairUserProfileInput = {
  email: string;
  name: string;
  username: string;
  imageUrl: string;
  bio?: string | null;
};

export type UpdateEditableUserProfileInput = {
  name: string;
  imageId?: string | null;
  imageUrl: string;
  bio?: string | null;
};

export type UpdateEditableUserProfileWithAvatarInput = {
  profileId: string;
  ownerAccountId: string;
  name: string;
  bio?: string | null;
  currentImageId: string | null;
  currentImageUrl: string;
  nextAvatarFile?: File | null;
};

export type UserProfileRecord = Models.Row & {
  accountId?: string | null;
  email: string;
  name?: string | null;
  username?: string | null;
  imageId?: string | null;
  imageUrl: string;
  bio?: string | null;
};

export type PublicUserProfileViewModel = {
  id: string;
  name: string;
  username: string;
  imageUrl: string;
  bio: string | null;
};

export type EditableUserProfileViewModel = {
  id: string;
  accountId: string;
  email: string;
  name: string;
  username: string;
  imageId: string | null;
  imageUrl: string;
  bio: string | null;
};

export type EditableUserProfileFormValues = {
  name: string;
  bio: string;
  avatarFile: File | null;
};

export type UserSavePostReference = {
  $id: string;
};

export type UserSaveRecord = Models.Row & {
  post?: string | UserSavePostReference | null;
};
