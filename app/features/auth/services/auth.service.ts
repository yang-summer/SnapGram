import { AppwriteException } from 'appwrite';
import {
  createEmailAccount,
  createEmailPasswordSession,
  deleteCurrentSession,
  getCurrentAccount,
} from '../api/auth.api';
import type {
  AuthAccountDto,
  AuthAccountRecord,
  AuthenticatedCurrentUserResult,
  CurrentUserDto,
  CurrentUserResult,
  ProfileMissingCurrentUserResult,
  SignInInput,
  SignUpInput,
} from '../types/auth.type';
import {
  createUserProfile,
  getDefaultUserProfileImageUrl,
  getUserProfileByAccountId,
  updateUserProfile,
} from '~/features/user/api/user.api';
import type { RepairUserProfileInput, UserProfileRecord } from '~/features/user/types/user.type';

function mapAuthAccountRecordToDto(record: AuthAccountRecord): AuthAccountDto {
  return {
    accountId: record.$id,
    email: record.email,
    name: record.name,
    emailVerified: record.emailVerification,
  };
}

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof AppwriteException && error.code === 401;
}

function hasCompleteUserProfile(profile: UserProfileRecord | null): profile is UserProfileRecord {
  return !!profile && profile.$id.length > 0 && typeof profile.username === 'string' && profile.username.trim().length > 0;
}

function buildGuestResult(): CurrentUserResult {
  return {
    status: 'guest',
    account: null,
    user: null,
  };
}

function buildProfileMissingResult(account: AuthAccountDto): ProfileMissingCurrentUserResult {
  return {
    status: 'profile_missing',
    account,
    user: null,
  };
}

function buildCurrentUser(account: AuthAccountDto, profile: UserProfileRecord): CurrentUserDto {
  return {
    accountId: account.accountId,
    profileId: profile.$id,
    email: profile.email || account.email,
    name: profile.name?.trim() || account.name,
    username: profile.username?.trim() || '',
    imageUrl: profile.imageUrl ?? null,
    bio: profile.bio ?? null,
  };
}

function buildAuthenticatedResult(
  account: AuthAccountDto,
  profile: UserProfileRecord,
): AuthenticatedCurrentUserResult {
  return {
    status: 'authenticated',
    account,
    user: buildCurrentUser(account, profile),
  };
}

function normalizeUsernameSeed(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '')
    .slice(0, 20);
}

function buildRecoveryUsername(account: AuthAccountDto, profile: UserProfileRecord | null): string {
  const existingUsername = profile?.username?.trim() ?? '';

  if (existingUsername.length >= 2) {
    return existingUsername;
  }

  const emailPrefix = account.email.split('@')[0] ?? '';
  const baseSeed =
    normalizeUsernameSeed(emailPrefix) || normalizeUsernameSeed(account.name) || 'user';
  const suffix = account.accountId.slice(0, 6).toLowerCase();
  const candidate = `${baseSeed}_${suffix}`.slice(0, 32);

  if (candidate.length >= 2) {
    return candidate;
  }

  return `user_${suffix}`;
}

async function initializeMissingUserProfile(account: AuthAccountDto): Promise<UserProfileRecord> {
  const existingProfile = await getUserProfileByAccountId(account.accountId);
  const profilePayload: RepairUserProfileInput = {
    email: existingProfile?.email?.trim() || account.email,
    name: existingProfile?.name?.trim() || account.name,
    username: buildRecoveryUsername(account, existingProfile),
    imageUrl: existingProfile?.imageUrl ?? getDefaultUserProfileImageUrl(account.name),
    bio: existingProfile?.bio ?? null,
  };

  if (existingProfile?.$id) {
    return updateUserProfile(existingProfile.$id, profilePayload);
  }

  return createUserProfile({
    accountId: account.accountId,
    ...profilePayload,
  });
}

async function resolveCurrentUserForAccount(
  accountRecord: AuthAccountRecord,
): Promise<AuthenticatedCurrentUserResult | ProfileMissingCurrentUserResult> {
  const account = mapAuthAccountRecordToDto(accountRecord);
  const profile = await getUserProfileByAccountId(account.accountId);

  if (!hasCompleteUserProfile(profile)) {
    return buildProfileMissingResult(account);
  }

  return buildAuthenticatedResult(account, profile);
}

export async function signUpWithEmail(input: SignUpInput): Promise<CurrentUserResult> {
  const accountRecord = await createEmailAccount({
    email: input.email,
    password: input.password,
    name: input.name,
  });

  await createEmailPasswordSession({
    email: input.email,
    password: input.password,
  });

  try {
    await createUserProfile({
      accountId: accountRecord.$id,
      email: accountRecord.email,
      name: input.name,
      username: input.username,
      imageUrl: getDefaultUserProfileImageUrl(input.name),
      bio: null,
    });
  } catch (error) {
    console.error('[AuthService.signUpWithEmail] Failed to create user profile.', error);
  }

  return resolveCurrentUserForAccount(accountRecord);
}

export async function signInWithEmail(input: SignInInput): Promise<CurrentUserResult> {
  await createEmailPasswordSession(input);

  return getCurrentUser();
}

export async function getCurrentUser(): Promise<CurrentUserResult> {
  try {
    const accountRecord = await getCurrentAccount();

    return await resolveCurrentUserForAccount(accountRecord);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return buildGuestResult();
    }

    console.error('[AuthService.getCurrentUser] Failed to resolve current user.', error);
    throw error;
  }
}

export async function signOut(): Promise<void> {
  try {
    await deleteCurrentSession();
  } catch (error) {
    console.error('[AuthService.signOut] Failed to delete current session.', error);
    throw error;
  }
}

export async function retryInitializeCurrentUserProfile(): Promise<CurrentUserResult> {
  try {
    const accountRecord = await getCurrentAccount();
    const account = mapAuthAccountRecordToDto(accountRecord);

    await initializeMissingUserProfile(account);

    return await resolveCurrentUserForAccount(accountRecord);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return buildGuestResult();
    }

    console.error(
      '[AuthService.retryInitializeCurrentUserProfile] Failed to initialize missing user profile.',
      error,
    );
    throw error;
  }
}
