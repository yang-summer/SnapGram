type FunctionRequest = {
  method: string;
  path: string;
  bodyText?: string;
  headers: Record<string, string | undefined>;
};

type FunctionResponse = {
  json: (body: unknown, statusCode?: number, headers?: Record<string, string>) => unknown;
};

type FunctionContext = {
  req: FunctionRequest;
  res: FunctionResponse;
  log: (message: string) => void;
  error: (message: string) => void;
};

const REQUIRED_ENV_KEYS = [
  'APPWRITE_DATABASE_ID',
  'APPWRITE_STORAGE_ID',
  'APPWRITE_USERS_TABLE_ID',
  'APPWRITE_POSTS_TABLE_ID',
  'APPWRITE_SAVES_TABLE_ID',
  'APPWRITE_LIKES_TABLE_ID',
] as const;

function getHeader(headers: Record<string, string | undefined>, name: string): string {
  const expectedName = name.toLowerCase();
  const matchedHeader = Object.entries(headers).find(
    ([headerName]) => headerName.toLowerCase() === expectedName,
  );

  return matchedHeader?.[1] ?? '';
}

function getMissingEnvKeys(): string[] {
  return REQUIRED_ENV_KEYS.filter((key) => !process.env[key]?.trim());
}

export default async function main({ req, res, log }: FunctionContext) {
  const accountId = getHeader(req.headers, 'x-appwrite-user-id');
  const hasDynamicApiKey = getHeader(req.headers, 'x-appwrite-key').length > 0;
  const missingEnvKeys = getMissingEnvKeys();

  log(
    JSON.stringify({
      event: 'content-actions.healthcheck',
      method: req.method,
      path: req.path,
      hasAccountId: accountId.length > 0,
      hasDynamicApiKey,
      missingEnvKeys,
    }),
  );

  if (!accountId) {
    return res.json(
      {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated execution is required.',
        },
      },
      401,
    );
  }

  if (missingEnvKeys.length > 0) {
    return res.json(
      {
        ok: false,
        error: {
          code: 'CONFIG_MISSING',
          message: 'Function environment is incomplete.',
          missingEnvKeys,
        },
      },
      500,
    );
  }

  return res.json({
    ok: true,
    action: 'healthcheck',
    accountId,
    hasDynamicApiKey,
    environment: {
      databaseId: process.env.APPWRITE_DATABASE_ID,
      storageId: process.env.APPWRITE_STORAGE_ID,
      usersTableId: process.env.APPWRITE_USERS_TABLE_ID,
      postsTableId: process.env.APPWRITE_POSTS_TABLE_ID,
      savesTableId: process.env.APPWRITE_SAVES_TABLE_ID,
      likesTableId: process.env.APPWRITE_LIKES_TABLE_ID,
    },
  });
}
