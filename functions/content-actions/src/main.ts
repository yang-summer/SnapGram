import { AppwriteException } from 'node-appwrite';
import { createAppwriteClients } from './appwrite.js';
import { ConfigError, getMissingConfigKeys, readConfig } from './config.js';
import { getCurrentUserProfile, ProfileMissingError } from './auth.js';
import type { FunctionContext } from './request.js';
import { getHeader } from './request.js';

function createErrorBody(code: string, message: string, extra?: Record<string, unknown>) {
  return {
    ok: false,
    error: {
      code,
      message,
      ...extra,
    },
  };
}

export default async function main({ req, res, log, error }: FunctionContext) {
  const accountId = getHeader(req.headers, 'x-appwrite-user-id');
  const dynamicApiKey = getHeader(req.headers, 'x-appwrite-key');
  const missingEnvKeys = getMissingConfigKeys();

  log(
    JSON.stringify({
      event: 'content-actions.healthcheck',
      method: req.method,
      path: req.path,
      hasAccountId: accountId.length > 0,
      hasDynamicApiKey: dynamicApiKey.length > 0,
      missingEnvKeys,
    }),
  );

  if (!accountId) {
    return res.json(
      createErrorBody('UNAUTHORIZED', 'Authenticated execution is required.'),
      401,
    );
  }

  if (!dynamicApiKey) {
    return res.json(
      createErrorBody('DYNAMIC_API_KEY_MISSING', 'Function dynamic API key is unavailable.'),
      500,
    );
  }

  try {
    const config = readConfig();
    const { tablesDB } = createAppwriteClients(config, dynamicApiKey);
    const profile = await getCurrentUserProfile(tablesDB, config, accountId);

    log(
      JSON.stringify({
        event: 'content-actions.identity-resolved',
        accountId,
        profileId: profile.id,
      }),
    );

    return res.json({
      ok: true,
      action: 'healthcheck',
      accountId,
      profile,
      hasDynamicApiKey: true,
      environment: {
        projectId: config.projectId,
        databaseId: config.databaseId,
        storageId: config.storageId,
        usersTableId: config.usersTableId,
        postsTableId: config.postsTableId,
        savesTableId: config.savesTableId,
        likesTableId: config.likesTableId,
      },
    });
  } catch (caughtError) {
    if (caughtError instanceof ConfigError) {
      return res.json(
        createErrorBody('CONFIG_MISSING', caughtError.message, {
          missingEnvKeys: caughtError.missingKeys,
        }),
        500,
      );
    }

    if (caughtError instanceof ProfileMissingError) {
      return res.json(
        createErrorBody('PROFILE_MISSING', caughtError.message, {
          accountId: caughtError.accountId,
        }),
        409,
      );
    }

    if (caughtError instanceof AppwriteException) {
      error(
        JSON.stringify({
          event: 'content-actions.appwrite-error',
          code: caughtError.code,
          type: caughtError.type,
          message: caughtError.message,
        }),
      );

      return res.json(
        createErrorBody('APPWRITE_ERROR', 'Failed to resolve current user identity.'),
        502,
      );
    }

    error(
      JSON.stringify({
        event: 'content-actions.unhandled-error',
        message: caughtError instanceof Error ? caughtError.message : String(caughtError),
      }),
    );

    return res.json(
      createErrorBody('INTERNAL_ERROR', 'Unexpected server error.'),
      500,
    );
  }
}
