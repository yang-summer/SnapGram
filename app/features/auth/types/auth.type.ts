import type { Models } from 'appwrite';

export type AuthStatus = 'guest' | 'authenticated' | 'profile_missing';

export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  name: string;
  username: string;
  email: string;
  password: string;
};

export type CreateEmailAccountInput = Pick<SignUpInput, 'email' | 'password' | 'name'>;

export type AuthAccountRecord = Pick<
  Models.User<Models.Preferences>,
  '$id' | 'email' | 'name' | 'emailVerification'
>;

export type AuthSessionRecord = Pick<Models.Session, '$id' | 'userId' | 'expire' | 'provider'>;

export type AuthAccountDto = {
  accountId: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export type AuthSessionDto = {
  sessionId: string;
  accountId: string;
  expireAt: string;
  provider: string;
};

export type CurrentUserDto = {
  accountId: string;
  profileId: string;
  email: string;
  name: string;
  username: string;
  imageUrl: string | null;
  bio: string | null;
};

export type GuestCurrentUserResult = {
  status: 'guest';
  account: null;
  user: null;
};

export type AuthenticatedCurrentUserResult = {
  status: 'authenticated';
  account: AuthAccountDto;
  user: CurrentUserDto;
};

export type ProfileMissingCurrentUserResult = {
  status: 'profile_missing';
  account: AuthAccountDto;
  user: null;
};

export type CurrentUserResult =
  | GuestCurrentUserResult
  | AuthenticatedCurrentUserResult
  | ProfileMissingCurrentUserResult;
