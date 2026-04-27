import type { Models } from 'node-appwrite';
import { Query, TablesDB } from 'node-appwrite';
import type { AppwriteResourceConfig } from './config.js';

const CURRENT_PROFILE_SELECT = ['$id', 'accountId', 'name', 'username', 'imageUrl'];

type UserProfileRow = Models.Row & {
  accountId?: string | null;
  name?: string | null;
  username?: string | null;
  imageUrl?: string | null;
};

export type CurrentUserProfile = {
  id: string;
  accountId: string;
  name: string;
  username: string;
  imageUrl: string | null;
};

export class ProfileMissingError extends Error {
  constructor(readonly accountId: string) {
    super('Current account profile is missing.');
    this.name = 'ProfileMissingError';
  }
}

function normalizeProfile(row: UserProfileRow, accountId: string): CurrentUserProfile {
  return {
    id: row.$id,
    accountId: row.accountId?.trim() || accountId,
    name: row.name?.trim() || '',
    username: row.username?.trim() || '',
    imageUrl: row.imageUrl?.trim() || null,
  };
}

export async function getCurrentUserProfile(
  tablesDB: TablesDB,
  config: AppwriteResourceConfig,
  accountId: string,
): Promise<CurrentUserProfile> {
  const result = await tablesDB.listRows<UserProfileRow>({
    databaseId: config.databaseId,
    tableId: config.usersTableId,
    queries: [
      Query.select(CURRENT_PROFILE_SELECT),
      Query.equal('accountId', accountId),
      Query.limit(1),
    ],
    total: false,
  });

  const profile = result.rows[0] ?? null;

  if (!profile) {
    throw new ProfileMissingError(accountId);
  }

  return normalizeProfile(profile, accountId);
}
