const REQUIRED_RESOURCE_ENV_KEYS = [
  'APPWRITE_DATABASE_ID',
  'APPWRITE_STORAGE_ID',
  'APPWRITE_USERS_TABLE_ID',
  'APPWRITE_POSTS_TABLE_ID',
  'APPWRITE_SAVES_TABLE_ID',
  'APPWRITE_LIKES_TABLE_ID',
  'APPWRITE_POST_MEDIA_TABLE_ID',
] as const;

export type AppwriteResourceConfig = {
  endpoint: string;
  projectId: string;
  databaseId: string;
  storageId: string;
  usersTableId: string;
  postsTableId: string;
  savesTableId: string;
  likesTableId: string;
  postMediaTableId: string;
};

export class ConfigError extends Error {
  constructor(readonly missingKeys: string[]) {
    super('Function environment is incomplete.');
    this.name = 'ConfigError';
  }
}

function readEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

function readEndpoint(): string {
  return readEnv('APPWRITE_ENDPOINT') || readEnv('APPWRITE_FUNCTION_API_ENDPOINT');
}

function readProjectId(): string {
  return readEnv('APPWRITE_PROJECT_ID') || readEnv('APPWRITE_FUNCTION_PROJECT_ID');
}

export function getMissingConfigKeys(): string[] {
  const missingKeys: string[] = REQUIRED_RESOURCE_ENV_KEYS.filter((key) => !readEnv(key));

  if (!readEndpoint()) {
    missingKeys.push('APPWRITE_ENDPOINT');
  }

  if (!readProjectId()) {
    missingKeys.push('APPWRITE_PROJECT_ID');
  }

  return missingKeys;
}

export function readConfig(): AppwriteResourceConfig {
  const missingKeys = getMissingConfigKeys();

  if (missingKeys.length > 0) {
    throw new ConfigError(missingKeys);
  }

  return {
    endpoint: readEndpoint(),
    projectId: readProjectId(),
    databaseId: readEnv('APPWRITE_DATABASE_ID'),
    storageId: readEnv('APPWRITE_STORAGE_ID'),
    usersTableId: readEnv('APPWRITE_USERS_TABLE_ID'),
    postsTableId: readEnv('APPWRITE_POSTS_TABLE_ID'),
    savesTableId: readEnv('APPWRITE_SAVES_TABLE_ID'),
    likesTableId: readEnv('APPWRITE_LIKES_TABLE_ID'),
    postMediaTableId: readEnv('APPWRITE_POST_MEDIA_TABLE_ID'),
  };
}
