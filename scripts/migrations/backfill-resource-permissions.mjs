#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  AppwriteException,
  Client,
  Permission,
  Query,
  Role,
  Storage,
  TablesDB,
} from 'node-appwrite';

const DEFAULT_BATCH_SIZE = 100;
const ENV_FILES = ['.env.migration.local', '.env.migration'];
const MODE_DRY_RUN = 'dry-run';
const MODE_RUN = 'run';
const MODE_VERIFY = 'verify';
const RETRIABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

const USERS_SELECT = ['$id', '$permissions', 'accountId'];
const POSTS_SELECT = ['$id', '$permissions', 'creator.*', 'imageId'];
const LIKES_SELECT = ['$id', '$permissions', 'userId'];
const SAVES_SELECT = ['$id', '$permissions', 'userId', 'user.*'];

function printHelp() {
  console.log(`Resource permission backfill for Snapgram.

Usage:
  node scripts/migrations/backfill-resource-permissions.mjs --dry-run
  node scripts/migrations/backfill-resource-permissions.mjs --run
  node scripts/migrations/backfill-resource-permissions.mjs --verify

Options:
  --dry-run            Compute required permission changes without writing. Default mode.
  --run                Apply permission updates to historical rows and files.
  --verify             Re-scan and fail when mismatches remain.
  --skip-files         Skip media file permission backfill. Useful when the API key lacks file scopes.
  --limit=<1-100>      Batch size for list operations. Default: ${DEFAULT_BATCH_SIZE}
  --help               Show this help text.

Environment:
  The script auto-loads .env.migration.local and .env.migration if present.
  Required:
    APPWRITE_ENDPOINT
    APPWRITE_PROJECT_ID
    APPWRITE_DATABASE_ID
    APPWRITE_API_KEY
    APPWRITE_STORAGE_ID
  Optional:
    APPWRITE_USERS_TABLE_ID   default: users
    APPWRITE_POSTS_TABLE_ID   default: posts
    APPWRITE_SAVES_TABLE_ID   default: saves
    APPWRITE_LIKES_TABLE_ID   default: likes

Notes:
  - Pre-migration only: run this before removing legacy relationship columns that historical rows may still depend on during backfill.
  - This script backfills row/file-level permissions for historical data only.
  - It assumes posts.creator, likes.userId, and saves.userId refer to profile row IDs.
  - Verify mode exits with code 1 when permissions are still out of sync or owner mapping is missing.
`);
}

function parseArgs(argv) {
  const args = {
    mode: MODE_DRY_RUN,
    batchSize: DEFAULT_BATCH_SIZE,
    skipFiles: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      args.mode = MODE_DRY_RUN;
      continue;
    }

    if (arg === '--run') {
      args.mode = MODE_RUN;
      continue;
    }

    if (arg === '--verify') {
      args.mode = MODE_VERIFY;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    if (arg === '--skip-files') {
      args.skipFiles = true;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const rawValue = Number.parseInt(arg.slice('--limit='.length), 10);
      if (!Number.isInteger(rawValue) || rawValue < 1 || rawValue > 100) {
        throw new Error('The --limit option must be an integer between 1 and 100.');
      }

      args.batchSize = rawValue;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function loadEnvFiles(rootDir) {
  const loaded = [];

  for (const fileName of ENV_FILES) {
    const filePath = path.join(rootDir, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/u);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key || key.startsWith('#') || key in process.env) {
        continue;
      }

      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }

    loaded.push(filePath);
  }

  return loaded;
}

function readConfig() {
  const config = {
    endpoint: process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_URL ?? '',
    projectId: process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? '',
    databaseId: process.env.APPWRITE_DATABASE_ID ?? process.env.VITE_APPWRITE_DATABASE_ID ?? '',
    apiKey: process.env.APPWRITE_API_KEY ?? '',
    usersTableId:
      process.env.APPWRITE_USERS_TABLE_ID ?? process.env.VITE_APPWRITE_USERS_TABLE_ID ?? 'users',
    postsTableId:
      process.env.APPWRITE_POSTS_TABLE_ID ?? process.env.VITE_APPWRITE_POSTS_TABLE_ID ?? 'posts',
    savesTableId:
      process.env.APPWRITE_SAVES_TABLE_ID ?? process.env.VITE_APPWRITE_SAVES_TABLE_ID ?? 'saves',
    likesTableId:
      process.env.APPWRITE_LIKES_TABLE_ID ?? process.env.VITE_APPWRITE_LIKES_TABLE_ID ?? 'likes',
    storageId: process.env.APPWRITE_STORAGE_ID ?? process.env.VITE_APPWRITE_STORAGE_ID ?? '',
  };

  return config;
}

function validateConfig(config, args) {
  const required = {
    APPWRITE_ENDPOINT: config.endpoint,
    APPWRITE_PROJECT_ID: config.projectId,
    APPWRITE_DATABASE_ID: config.databaseId,
    APPWRITE_API_KEY: config.apiKey,
  };

  if (!args.skipFiles) {
    required.APPWRITE_STORAGE_ID = config.storageId;
  }

  const missing = Object.entries(required)
    .filter(([, value]) => value.trim().length === 0)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function createClients(config) {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

  return {
    tablesDB: new TablesDB(client),
    storage: new Storage(client),
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function callWithRetry(fn, label) {
  let attempt = 0;

  while (attempt < 3) {
    attempt += 1;

    try {
      return await fn();
    } catch (error) {
      const isAppwriteError = error instanceof AppwriteException;
      const shouldRetry = isAppwriteError && RETRIABLE_STATUS_CODES.has(error.code) && attempt < 3;

      if (!shouldRetry) {
        throw error;
      }

      const delay = attempt * 500;
      console.warn(`[retry] ${label} failed with ${error.code}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw new Error(`Unreachable retry state for ${label}.`);
}

function normalizeNullableText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toRelationId(value) {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (value && typeof value === 'object' && typeof value.$id === 'string' && value.$id.length > 0) {
    return value.$id;
  }

  return null;
}

function normalizePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return Array.from(new Set(permissions.filter((item) => typeof item === 'string'))).sort();
}

function hasSamePermissions(currentPermissions, targetPermissions) {
  const current = normalizePermissions(currentPermissions);
  const target = normalizePermissions(targetPermissions);

  if (current.length !== target.length) {
    return false;
  }

  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== target[index]) {
      return false;
    }
  }

  return true;
}

function buildPublicOwnerPermissions(accountId) {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.user(accountId)),
    Permission.delete(Role.user(accountId)),
  ];
}

function buildPrivateOwnerPermissions(accountId) {
  return [Permission.read(Role.user(accountId)), Permission.delete(Role.user(accountId))];
}

function buildTransitionalPostPermissions(accountId) {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.users()),
    Permission.delete(Role.user(accountId)),
  ];
}

function createStats(initial = {}) {
  return {
    scanned: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    permissionsOutOfSync: 0,
    ...initial,
  };
}

function logSection(title) {
  console.log(`\n== ${title} ==`);
}

function logStats(label, stats) {
  console.log(label);
  for (const [key, value] of Object.entries(stats)) {
    console.log(`  ${key}: ${value}`);
  }
}

async function* listRowsByCursor(tablesDB, config, tableId, select, batchSize) {
  let cursor = null;

  while (true) {
    const queries = [Query.select(select), Query.orderAsc('$id'), Query.limit(batchSize)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const response = await callWithRetry(
      () =>
        tablesDB.listRows({
          databaseId: config.databaseId,
          tableId,
          queries,
          total: false,
        }),
      `listRows:${tableId}`,
    );

    const rows = response.rows ?? [];
    if (rows.length === 0) {
      return;
    }

    yield rows;

    cursor = rows[rows.length - 1].$id;
    if (rows.length < batchSize) {
      return;
    }
  }
}

async function* listFilesByCursor(storage, config, batchSize) {
  let cursor = null;

  while (true) {
    const queries = [Query.orderAsc('$id'), Query.limit(batchSize)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const response = await callWithRetry(
      () =>
        storage.listFiles({
          bucketId: config.storageId,
          queries,
          total: false,
        }),
      `listFiles:${config.storageId}`,
    );

    const files = response.files ?? [];
    if (files.length === 0) {
      return;
    }

    yield files;

    cursor = files[files.length - 1].$id;
    if (files.length < batchSize) {
      return;
    }
  }
}

async function updateRowPermissionsIfNeeded(
  tablesDB,
  config,
  tableId,
  rowId,
  targetPermissions,
  applyWrites,
) {
  if (!applyWrites) {
    return true;
  }

  await callWithRetry(
    () =>
      tablesDB.updateRow({
        databaseId: config.databaseId,
        tableId,
        rowId,
        permissions: targetPermissions,
      }),
    `updateRowPermissions:${tableId}:${rowId}`,
  );

  return true;
}

async function updateFilePermissionsIfNeeded(
  storage,
  config,
  fileId,
  targetPermissions,
  applyWrites,
) {
  if (!applyWrites) {
    return true;
  }

  await callWithRetry(
    () =>
      storage.updateFile({
        bucketId: config.storageId,
        fileId,
        permissions: targetPermissions,
      }),
    `updateFilePermissions:${config.storageId}:${fileId}`,
  );

  return true;
}

async function scanUsers(tablesDB, config, batchSize, applyWrites) {
  const stats = createStats({ missingAccountId: 0 });
  const profileToAccountId = new Map();

  for await (const rows of listRowsByCursor(
    tablesDB,
    config,
    config.usersTableId,
    USERS_SELECT,
    batchSize,
  )) {
    for (const row of rows) {
      stats.scanned += 1;

      const accountId = normalizeNullableText(row.accountId);
      if (!accountId) {
        stats.missingAccountId += 1;
        continue;
      }

      profileToAccountId.set(row.$id, accountId);

      const targetPermissions = buildPublicOwnerPermissions(accountId);
      if (hasSamePermissions(row.$permissions, targetPermissions)) {
        stats.skipped += 1;
        continue;
      }

      stats.permissionsOutOfSync += 1;

      try {
        const changed = await updateRowPermissionsIfNeeded(
          tablesDB,
          config,
          config.usersTableId,
          row.$id,
          targetPermissions,
          applyWrites,
        );

        if (changed) {
          stats.updated += 1;
        }
      } catch (error) {
        stats.failed += 1;
        console.error(`[users] Failed to update permissions for ${row.$id}`, error);
      }
    }
  }

  return { stats, profileToAccountId };
}

async function scanPosts(tablesDB, config, batchSize, applyWrites, profileToAccountId) {
  const stats = createStats({
    missingCreatorProfileId: 0,
    missingOwnerAccountId: 0,
    conflictingImageOwners: 0,
  });
  const imageOwnerAccountIdByFileId = new Map();

  for await (const rows of listRowsByCursor(
    tablesDB,
    config,
    config.postsTableId,
    POSTS_SELECT,
    batchSize,
  )) {
    for (const row of rows) {
      stats.scanned += 1;

      const creatorProfileId = toRelationId(row.creator);
      if (!creatorProfileId) {
        stats.missingCreatorProfileId += 1;
        continue;
      }

      const ownerAccountId = profileToAccountId.get(creatorProfileId) ?? null;
      if (!ownerAccountId) {
        stats.missingOwnerAccountId += 1;
        continue;
      }

      const imageId = normalizeNullableText(row.imageId);
      if (imageId) {
        const existingOwnerAccountId = imageOwnerAccountIdByFileId.get(imageId);
        if (existingOwnerAccountId && existingOwnerAccountId !== ownerAccountId) {
          stats.conflictingImageOwners += 1;
        } else {
          imageOwnerAccountIdByFileId.set(imageId, ownerAccountId);
        }
      }

      const targetPermissions = buildTransitionalPostPermissions(ownerAccountId);
      if (hasSamePermissions(row.$permissions, targetPermissions)) {
        stats.skipped += 1;
        continue;
      }

      stats.permissionsOutOfSync += 1;

      try {
        const changed = await updateRowPermissionsIfNeeded(
          tablesDB,
          config,
          config.postsTableId,
          row.$id,
          targetPermissions,
          applyWrites,
        );

        if (changed) {
          stats.updated += 1;
        }
      } catch (error) {
        stats.failed += 1;
        console.error(`[posts] Failed to update permissions for ${row.$id}`, error);
      }
    }
  }

  return { stats, imageOwnerAccountIdByFileId };
}

async function scanLikes(tablesDB, config, batchSize, applyWrites, profileToAccountId) {
  const stats = createStats({ missingViewerProfileId: 0, missingOwnerAccountId: 0 });

  for await (const rows of listRowsByCursor(
    tablesDB,
    config,
    config.likesTableId,
    LIKES_SELECT,
    batchSize,
  )) {
    for (const row of rows) {
      stats.scanned += 1;

      const viewerProfileId = normalizeNullableText(row.userId);
      if (!viewerProfileId) {
        stats.missingViewerProfileId += 1;
        continue;
      }

      const ownerAccountId = profileToAccountId.get(viewerProfileId) ?? null;
      if (!ownerAccountId) {
        stats.missingOwnerAccountId += 1;
        continue;
      }

      const targetPermissions = buildPrivateOwnerPermissions(ownerAccountId);
      if (hasSamePermissions(row.$permissions, targetPermissions)) {
        stats.skipped += 1;
        continue;
      }

      stats.permissionsOutOfSync += 1;

      try {
        const changed = await updateRowPermissionsIfNeeded(
          tablesDB,
          config,
          config.likesTableId,
          row.$id,
          targetPermissions,
          applyWrites,
        );

        if (changed) {
          stats.updated += 1;
        }
      } catch (error) {
        stats.failed += 1;
        console.error(`[likes] Failed to update permissions for ${row.$id}`, error);
      }
    }
  }

  return { stats };
}

async function scanSaves(tablesDB, config, batchSize, applyWrites, profileToAccountId) {
  const stats = createStats({ missingViewerProfileId: 0, missingOwnerAccountId: 0 });

  for await (const rows of listRowsByCursor(
    tablesDB,
    config,
    config.savesTableId,
    SAVES_SELECT,
    batchSize,
  )) {
    for (const row of rows) {
      stats.scanned += 1;

      const viewerProfileId = normalizeNullableText(row.userId) ?? toRelationId(row.user);
      if (!viewerProfileId) {
        stats.missingViewerProfileId += 1;
        continue;
      }

      const ownerAccountId = profileToAccountId.get(viewerProfileId) ?? null;
      if (!ownerAccountId) {
        stats.missingOwnerAccountId += 1;
        continue;
      }

      const targetPermissions = buildPrivateOwnerPermissions(ownerAccountId);
      if (hasSamePermissions(row.$permissions, targetPermissions)) {
        stats.skipped += 1;
        continue;
      }

      stats.permissionsOutOfSync += 1;

      try {
        const changed = await updateRowPermissionsIfNeeded(
          tablesDB,
          config,
          config.savesTableId,
          row.$id,
          targetPermissions,
          applyWrites,
        );

        if (changed) {
          stats.updated += 1;
        }
      } catch (error) {
        stats.failed += 1;
        console.error(`[saves] Failed to update permissions for ${row.$id}`, error);
      }
    }
  }

  return { stats };
}

async function scanFiles(storage, config, batchSize, applyWrites, imageOwnerAccountIdByFileId) {
  const stats = createStats({ missingOwnerAccountId: 0 });

  for await (const files of listFilesByCursor(storage, config, batchSize)) {
    for (const file of files) {
      stats.scanned += 1;

      const ownerAccountId = imageOwnerAccountIdByFileId.get(file.$id) ?? null;
      if (!ownerAccountId) {
        stats.missingOwnerAccountId += 1;
        continue;
      }

      const targetPermissions = buildPublicOwnerPermissions(ownerAccountId);
      if (hasSamePermissions(file.$permissions, targetPermissions)) {
        stats.skipped += 1;
        continue;
      }

      stats.permissionsOutOfSync += 1;

      try {
        const changed = await updateFilePermissionsIfNeeded(
          storage,
          config,
          file.$id,
          targetPermissions,
          applyWrites,
        );

        if (changed) {
          stats.updated += 1;
        }
      } catch (error) {
        stats.failed += 1;
        console.error(`[files] Failed to update permissions for ${file.$id}`, error);
      }
    }
  }

  return { stats };
}

function countBlockingIssues(sectionStats) {
  return Object.entries(sectionStats).reduce((total, [key, value]) => {
    if (key === 'failed' || key.startsWith('missing') || key.startsWith('conflicting')) {
      return total + (typeof value === 'number' ? value : 0);
    }

    return total;
  }, 0);
}

function countPermissionMismatches(sectionStats) {
  return typeof sectionStats.permissionsOutOfSync === 'number'
    ? sectionStats.permissionsOutOfSync
    : 0;
}

function isMissingScopeError(error, scope) {
  return (
    error instanceof AppwriteException &&
    error.code === 401 &&
    error.type === 'general_unauthorized_scope' &&
    typeof error.response === 'string' &&
    error.response.includes(`"${scope}"`)
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const rootDir = process.cwd();
  const loadedEnvFiles = loadEnvFiles(rootDir);
  const config = readConfig();
  validateConfig(config, args);
  const { tablesDB, storage } = createClients(config);
  const applyWrites = args.mode === MODE_RUN;

  console.log(`Mode: ${args.mode}`);
  console.log(`Batch size: ${args.batchSize}`);
  console.log(`Skip files: ${args.skipFiles ? 'yes' : 'no'}`);
  if (loadedEnvFiles.length > 0) {
    console.log(`Loaded env files: ${loadedEnvFiles.join(', ')}`);
  }

  logSection('Users');
  const usersResult = await scanUsers(tablesDB, config, args.batchSize, applyWrites);
  logStats('User rows', usersResult.stats);

  logSection('Posts');
  const postsResult = await scanPosts(
    tablesDB,
    config,
    args.batchSize,
    applyWrites,
    usersResult.profileToAccountId,
  );
  logStats('Post rows', postsResult.stats);

  logSection('Likes');
  const likesResult = await scanLikes(
    tablesDB,
    config,
    args.batchSize,
    applyWrites,
    usersResult.profileToAccountId,
  );
  logStats('Like rows', likesResult.stats);

  logSection('Saves');
  const savesResult = await scanSaves(
    tablesDB,
    config,
    args.batchSize,
    applyWrites,
    usersResult.profileToAccountId,
  );
  logStats('Save rows', savesResult.stats);

  let filesResult = {
    stats: createStats({ skippedByFlag: 0, missingOwnerAccountId: 0 }),
  };

  if (args.skipFiles) {
    logSection('Files');
    filesResult.stats.skippedByFlag = 1;
    logStats('Media files', filesResult.stats);
  } else {
    logSection('Files');

    try {
      filesResult = await scanFiles(
        storage,
        config,
        args.batchSize,
        applyWrites,
        postsResult.imageOwnerAccountIdByFileId,
      );
      logStats('Media files', filesResult.stats);
    } catch (error) {
      if (isMissingScopeError(error, 'files.read')) {
        console.error(
          [
            '[files] Missing Appwrite API key scope: files.read.',
            'Create or update the server API key to include `files.read`.',
            'If you plan to run permission writes for files, also include `files.write`.',
            'Temporary workaround: rerun this script with `--skip-files` to backfill only row permissions.',
          ].join(' '),
        );
      }

      throw error;
    }
  }

  const allStats = [
    usersResult.stats,
    postsResult.stats,
    likesResult.stats,
    savesResult.stats,
    filesResult.stats,
  ];

  const blockingIssues = allStats.reduce((total, stats) => total + countBlockingIssues(stats), 0);
  const permissionMismatches = allStats.reduce(
    (total, stats) => total + countPermissionMismatches(stats),
    0,
  );

  logSection('Summary');
  console.log(`Blocking issues: ${blockingIssues}`);
  console.log(`Permission mismatches: ${permissionMismatches}`);

  if (args.mode === MODE_VERIFY && (blockingIssues > 0 || permissionMismatches > 0)) {
    process.exitCode = 1;
    return;
  }

  if (args.mode === MODE_RUN && blockingIssues > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[backfill-resource-permissions] Failed.', error);
  process.exitCode = 1;
});
