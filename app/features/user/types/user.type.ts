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

export type UserProfileRecord = Models.Row & {
  accountId?: string | null;
  email: string;
  name?: string | null;
  username?: string | null;
  imageId?: string | null;
  imageUrl?: string | null;
  bio?: string | null;
};

export type UserSavePostReference = {
  $id: string;
};

export type UserSaveRecord = Models.Row & {
  post?: string | UserSavePostReference | null;
};
