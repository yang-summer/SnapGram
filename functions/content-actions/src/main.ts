import { AppwriteException } from 'node-appwrite';
import { createAppwriteClients } from './appwrite.js';
import { parseContentActionRequest } from './action.js';
import { ConfigError, getMissingConfigKeys, readConfig } from './config.js';
import { createPostForCurrentUser } from './create-post.js';
import { getCurrentUserProfile, ProfileMissingError } from './auth.js';
import { deletePostForCurrentUser } from './delete-post.js';
import {
  likePostForCurrentUser,
  savePostForCurrentUser,
  unlikePostForCurrentUser,
  unsavePostForCurrentUser,
} from './engagement.js';
import { ContentActionError } from './errors.js';
import type { FunctionContext } from './request.js';
import { getHeader } from './request.js';
import { updatePostForCurrentUser } from './update-post.js';

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
  const fallbackApiKey = process.env.APPWRITE_API_KEY?.trim() ?? '';
  const resolvedApiKey = dynamicApiKey || fallbackApiKey;
  const apiKeySource = dynamicApiKey ? 'dynamic' : fallbackApiKey ? 'env' : 'missing';
  const missingEnvKeys = getMissingConfigKeys();

  log(
    JSON.stringify({
      event: 'content-actions.healthcheck',
      method: req.method,
      path: req.path,
      hasAccountId: accountId.length > 0,
      hasDynamicApiKey: dynamicApiKey.length > 0,
      hasFallbackApiKey: fallbackApiKey.length > 0,
      apiKeySource,
      missingEnvKeys,
    }),
  );

  if (!accountId) {
    return res.json(
      createErrorBody('UNAUTHORIZED', 'Authenticated execution is required.'),
      401,
    );
  }

  if (!resolvedApiKey) {
    return res.json(
      createErrorBody('API_KEY_MISSING', 'Function API key is unavailable.'),
      500,
    );
  }

  try {
    const actionRequest = parseContentActionRequest(req);
    const config = readConfig();
    const { tablesDB, storage } = createAppwriteClients(config, resolvedApiKey);
    const profile = await getCurrentUserProfile(tablesDB, config, accountId);

    log(
      JSON.stringify({
        event: 'content-actions.identity-resolved',
        accountId,
        profileId: profile.id,
        action: actionRequest.action,
      }),
    );

    switch (actionRequest.action) {
      case 'healthcheck':
        return res.json({
          ok: true,
          action: 'healthcheck',
          accountId,
          profile,
          hasDynamicApiKey: dynamicApiKey.length > 0,
          apiKeySource,
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
      case 'post.like': {
        const result = await likePostForCurrentUser(tablesDB, config, profile, actionRequest.postId);

        return res.json({
          ok: true,
          action: actionRequest.action,
          data: result,
        });
      }
      case 'post.unlike': {
        const result = await unlikePostForCurrentUser(
          tablesDB,
          config,
          profile,
          actionRequest.postId,
        );

        return res.json({
          ok: true,
          action: actionRequest.action,
          data: result,
        });
      }
      case 'post.save': {
        const result = await savePostForCurrentUser(tablesDB, config, profile, actionRequest.postId);

        return res.json({
          ok: true,
          action: actionRequest.action,
          data: result,
        });
      }
      case 'post.unsave': {
        const result = await unsavePostForCurrentUser(
          tablesDB,
          config,
          profile,
          actionRequest.postId,
        );

        return res.json({
          ok: true,
          action: actionRequest.action,
          data: result,
        });
      }
      case 'post.delete': {
        const result = await deletePostForCurrentUser(
          tablesDB,
          storage,
          config,
          profile,
          actionRequest.postId,
          log,
          error,
        );

        return res.json({
          ok: true,
          action: actionRequest.action,
          data: result,
        });
      }
      case 'post.create': {
        const result = await createPostForCurrentUser(
          tablesDB,
          storage,
          config,
          profile,
          actionRequest,
          log,
          error,
        );

        return res.json({
          ok: true,
          action: actionRequest.action,
          data: result,
        });
      }
      case 'post.update': {
        const result = await updatePostForCurrentUser(
          tablesDB,
          storage,
          config,
          profile,
          actionRequest,
          log,
          error,
        );

        return res.json({
          ok: true,
          action: actionRequest.action,
          data: result,
        });
      }
      default:
        throw new ContentActionError(
          'ACTION_NOT_IMPLEMENTED',
          501,
          'This action is not implemented yet.',
        );
    }
  } catch (caughtError) {
    if (caughtError instanceof ContentActionError) {
      return res.json(
        createErrorBody(caughtError.code, caughtError.message, caughtError.extra),
        caughtError.statusCode,
      );
    }

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
        createErrorBody('APPWRITE_ERROR', 'Failed to process content action.'),
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
