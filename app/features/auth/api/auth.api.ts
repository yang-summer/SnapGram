import { ID } from 'appwrite';
import { account } from '~/lib/appwrite/config';
import type {
  AuthAccountRecord,
  AuthSessionRecord,
  CreateEmailAccountInput,
  SignInInput,
} from '../types/auth.type';

export async function createEmailAccount(input: CreateEmailAccountInput): Promise<AuthAccountRecord> {
  try {
    const createdAccount: AuthAccountRecord = await account.create({
      userId: ID.unique(),
      email: input.email,
      password: input.password,
      name: input.name,
    });

    return createdAccount;
  } catch (error) {
    console.error('[AuthApi.createEmailAccount] Failed to create email account.', error);
    throw error;
  }
}

export async function createEmailPasswordSession(
  input: SignInInput,
): Promise<AuthSessionRecord> {
  try {
    const session: AuthSessionRecord = await account.createEmailPasswordSession({
      email: input.email,
      password: input.password,
    });

    return session;
  } catch (error) {
    console.error('[AuthApi.createEmailPasswordSession] Failed to create session.', error);
    throw error;
  }
}

export async function getCurrentAccount(): Promise<AuthAccountRecord> {
  try {
    const currentAccount: AuthAccountRecord = await account.get();

    return currentAccount;
  } catch (error) {
    console.error('[AuthApi.getCurrentAccount] Failed to fetch current account.', error);
    throw error;
  }
}

export async function deleteCurrentSession(): Promise<void> {
  try {
    await account.deleteSession({ sessionId: 'current' });
  } catch (error) {
    console.error('[AuthApi.deleteCurrentSession] Failed to delete current session.', error);
    throw error;
  }
}
