import type { Models } from 'appwrite';

export type CreateUserProfileInput = {
  accountId: string;
  email: string;
  name: string;
  username: string;
  imageUrl: string;
  bio?: string | null;
};

export type UpdateUserProfileInput = {
  email: string;
  name: string;
  username: string;
  imageUrl: string;
  bio?: string | null;
};

export type UserProfileRecord = Models.Row & {
  accountId?: string | null;
  email: string;
  name?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  bio?: string | null;
};

export type UserSavePostReference = {
  $id: string;
};

export type UserSaveRecord = Models.Row & {
  post?: string | UserSavePostReference | null;
};
