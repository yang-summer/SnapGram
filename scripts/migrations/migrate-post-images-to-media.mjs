#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  AppwriteException,
  Client,
  ID,
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
const POST_MEDIA_LIST_LIMIT = 100;

const POSTS_SELECT = [
  '$id',
  '$permissions',
  'imageId',
  'imageUrl',
  'aspectRatioBucket',
  'imagePlaceholder',
  'imageWidth',
  'imageHeight',
  'mediaCount',
];

const POST_MEDIA_SELECT = [
  '$id',
  '$permissions',
  'postId',
  'fileId',
  'sortOrder',
  'width',
  'height',
  'aspectRatioBucket',
  'placeholder',
];

function printHelp() {
  console.log(`Legacy post image migration for Snapgram.

Usage:
  node scripts/migrations/migrate-post-images-to-media.mjs --dry-run
  node scripts/migrations/migrate-post-images-to-media.mjs --run
  node scripts/migrations/migrate-post-images-to-media.mjs --verify

Options:
  --dry-run            Compute required postMedia/mediaCount/file permission changes without writing. Default mode.
  --run                Apply migration writes.
  --verify             Re-scan and fail when mismatches remain.
  --skip-files         Skip media file permission migration and verification.
  --limit=<1-100>      Batch size for listRows/listFiles. Default: ${DEFAULT_BATCH_SIZE}
  --help               Show this help text.

Environment:
  The script auto-loads .env.migration.local and .env.migration if present.
  Required:
    APPWRITE_ENDPOINT
    APPWRITE_PROJECT_ID
    APPWRITE_DATABASE_ID
    APPWRITE_API_KEY
    APPWRITE_POSTS_TABLE_ID
    APPWRITE_POST_MEDIA_TABLE_ID
  Optional:
    APPWRITE_STORAGE_ID          required unless --skip-files is used

Notes:
  - Idempotent by design: it only creates a postMedia row when a legacy post has no postMedia rows.
  - It also backfills posts.mediaCount to the real media row count after migration.
  - Published postMedia row permissions are normalized to read(any).
  - Legacy image files are normalized to the current published file permissions: read(any).
  - Verify mode exits with code 1 when mismatches remain.
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

    if (arg === '--skip-files') {
      args.skipFiles = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      args.help = true;
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

function normalizeNullableText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalPositiveInteger(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : null;
}

function normalizeOptionalPlaceholder(value) {
  return normalizeNullableText(value);
}

function normalizeAspectRatioBucket(value) {
  if (value === '1:1' || value === '3:4' || value === '4:3') {
    return value;
  }

  return null;
}

function normalizePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return Array.from(new Set(permissions.filter((item) => typeof item === 'string'))).sort();
}

function hasSamePermissions(actualPermissions, expectedPermissions) {
  const actual = normalizePermissions(actualPermissions);
  const expected = normalizePermissions(expectedPermissions);

  if (actual.length !== expected.length) {
    return false;
  }

  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== expected[index]) {
      return false;
    }
  }

  return true;
}

function buildPublishedPostMediaRowPermissions() {
  return [Permission.read(Role.any())];
}

function buildPublishedPostMediaFilePermissions() {
  return [Permission.read(Role.any())];
}

function readConfig(args) {
  const config = {
    endpoint: process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_URL ?? '',
    projectId: process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? '',
    databaseId: process.env.APPWRITE_DATABASE_ID ?? process.env.VITE_APPWRITE_DATABASE_ID ?? '',
    apiKey: process.env.APPWRITE_API_KEY ?? '',
    postsTableId:
      process.env.APPWRITE_POSTS_TABLE_ID ?? process.env.VITE_APPWRITE_POSTS_TABLE_ID ?? 'posts',
    postMediaTableId:
      process.env.APPWRITE_POST_MEDIA_TABLE_ID ??
      process.env.VITE_APPWRITE_POST_MEDIA_TABLE_ID ??
      'postMedia',
    storageId: process.env.APPWRITE_STORAGE_ID ?? process.env.VITE_APPWRITE_STORAGE_ID ?? '',
  };

  const required = {
    APPWRITE_ENDPOINT: config.endpoint,
    APPWRITE_PROJECT_ID: config.projectId,
    APPWRITE_DATABASE_ID: config.databaseId,
    APPWRITE_API_KEY: config.apiKey,
    APPWRITE_POSTS_TABLE_ID: config.postsTableId,
    APPWRITE_POST_MEDIA_TABLE_ID: config.postMediaTableId,
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

  return config;
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

async function listPostMediaRowsByPostId(tablesDB, config, postId) {
  const response = await callWithRetry(
    () =>
      tablesDB.listRows({
        databaseId: config.databaseId,
        tableId: config.postMediaTableId,
        queries: [
          Query.select(POST_MEDIA_SELECT),
          Query.equal('postId', postId),
          Query.orderAsc('sortOrder'),
          Query.limit(POST_MEDIA_LIST_LIMIT),
        ],
        total: false,
      }),
    `listRows:${config.postMediaTableId}:${postId}`,
  );

  return response.rows ?? [];
}

function createStats(initial = {}) {
  return {
    scanned: 0,
    rowsCreated: 0,
    mediaCountUpdated: 0,
    postMediaPermissionsUpdated: 0,
    filePermissionsUpdated: 0,
    skipped: 0,
    failed: 0,
    postsMissingLegacyImage: 0,
    postsWithEmptyMediaAfterMigration: 0,
    postsWithMediaCountMismatch: 0,
    postMediaPermissionMismatches: 0,
    filePermissionMismatches: 0,
    missingLegacyImageFile: 0,
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

async function createPostMediaRowIfNeeded(tablesDB, config, postId, payload, applyWrites) {
  if (!applyWrites) {
    return true;
  }

  await callWithRetry(
    () =>
      tablesDB.createRow({
        databaseId: config.databaseId,
        tableId: config.postMediaTableId,
        rowId: ID.unique(),
        data: payload,
        permissions: buildPublishedPostMediaRowPermissions(),
      }),
    `createRow:${config.postMediaTableId}:${postId}:${payload.fileId}`,
  );

  return true;
}

async function updateRowDataIfNeeded(tablesDB, config, tableId, rowId, data, applyWrites) {
  if (Object.keys(data).length === 0) {
    return false;
  }

  if (!applyWrites) {
    return true;
  }

  await callWithRetry(
    () =>
      tablesDB.updateRow({
        databaseId: config.databaseId,
        tableId,
        rowId,
        data,
      }),
    `updateRow:${tableId}:${rowId}`,
  );

  return true;
}

async function updateRowPermissionsIfNeeded(
  tablesDB,
  config,
  tableId,
  rowId,
  permissions,
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
        permissions,
      }),
    `updateRowPermissions:${tableId}:${rowId}`,
  );

  return true;
}

async function getFileOrNull(storage, config, fileId) {
  try {
    return await callWithRetry(
      () =>
        storage.getFile({
          bucketId: config.storageId,
          fileId,
        }),
      `getFile:${config.storageId}:${fileId}`,
    );
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return null;
    }

    throw error;
  }
}

async function updateFilePermissionsIfNeeded(storage, config, fileId, permissions, applyWrites) {
  if (!applyWrites) {
    return true;
  }

  await callWithRetry(
    () =>
      storage.updateFile({
        bucketId: config.storageId,
        fileId,
        permissions,
      }),
    `updateFilePermissions:${config.storageId}:${fileId}`,
  );

  return true;
}

async function runMigration(tablesDB, storage, config, options) {
  const applyWrites = options.mode === MODE_RUN;
  const stats = createStats();
  const expectedRowPermissions = buildPublishedPostMediaRowPermissions();
  const expectedFilePermissions = buildPublishedPostMediaFilePermissions();

  logSection('Configuration');
  console.log(`mode: ${options.mode}`);
  console.log(`batchSize: ${options.batchSize}`);
  console.log(`skipFiles: ${options.skipFiles}`);
  console.log(`databaseId: ${config.databaseId}`);
  console.log(`postsTableId: ${config.postsTableId}`);
  console.log(`postMediaTableId: ${config.postMediaTableId}`);
  if (!options.skipFiles) {
    console.log(`storageId: ${config.storageId}`);
  }

  for await (const posts of listRowsByCursor(
    tablesDB,
    config,
    config.postsTableId,
    POSTS_SELECT,
    options.batchSize,
  )) {
    for (const post of posts) {
      stats.scanned += 1;

      try {
        const legacyImageId = normalizeNullableText(post.imageId);
        const mediaRows = await listPostMediaRowsByPostId(tablesDB, config, post.$id);
        let resolvedMediaRows = mediaRows;

        if (resolvedMediaRows.length === 0) {
          if (!legacyImageId) {
            stats.postsMissingLegacyImage += 1;
            stats.postsWithEmptyMediaAfterMigration += 1;
            continue;
          }

          const created = await createPostMediaRowIfNeeded(
            tablesDB,
            config,
            post.$id,
            {
              postId: post.$id,
              fileId: legacyImageId,
              sortOrder: 0,
              width: normalizeOptionalPositiveInteger(post.imageWidth),
              height: normalizeOptionalPositiveInteger(post.imageHeight),
              aspectRatioBucket: normalizeAspectRatioBucket(post.aspectRatioBucket),
              placeholder: normalizeOptionalPlaceholder(post.imagePlaceholder),
            },
            applyWrites,
          );

          if (created) {
            stats.rowsCreated += 1;
          }

          resolvedMediaRows = applyWrites
            ? await listPostMediaRowsByPostId(tablesDB, config, post.$id)
            : [
                {
                  $id: '__dry_run_legacy_row__',
                  $permissions: expectedRowPermissions,
                  postId: post.$id,
                  fileId: legacyImageId,
                  sortOrder: 0,
                  width: normalizeOptionalPositiveInteger(post.imageWidth),
                  height: normalizeOptionalPositiveInteger(post.imageHeight),
                  aspectRatioBucket: normalizeAspectRatioBucket(post.aspectRatioBucket),
                  placeholder: normalizeOptionalPlaceholder(post.imagePlaceholder),
                },
              ];
        }

        if (resolvedMediaRows.length === 0) {
          stats.postsWithEmptyMediaAfterMigration += 1;
          continue;
        }

        const expectedMediaCount = resolvedMediaRows.length;
        const normalizedMediaCount =
          typeof post.mediaCount === 'number' && Number.isFinite(post.mediaCount)
            ? Math.trunc(post.mediaCount)
            : null;

        if (normalizedMediaCount !== expectedMediaCount) {
          stats.postsWithMediaCountMismatch += 1;

          const updated = await updateRowDataIfNeeded(
            tablesDB,
            config,
            config.postsTableId,
            post.$id,
            {
              mediaCount: expectedMediaCount,
            },
            applyWrites,
          );

          if (updated) {
            stats.mediaCountUpdated += 1;
          }
        } else {
          stats.skipped += 1;
        }

        for (const mediaRow of resolvedMediaRows) {
          if (!hasSamePermissions(mediaRow.$permissions, expectedRowPermissions)) {
            stats.postMediaPermissionMismatches += 1;

            const updated = await updateRowPermissionsIfNeeded(
              tablesDB,
              config,
              config.postMediaTableId,
              mediaRow.$id,
              expectedRowPermissions,
              applyWrites,
            );

            if (updated) {
              stats.postMediaPermissionsUpdated += 1;
            }
          }
        }

        if (options.skipFiles || !legacyImageId) {
          continue;
        }

        const file = await getFileOrNull(storage, config, legacyImageId);

        if (!file) {
          stats.missingLegacyImageFile += 1;
          continue;
        }

        if (!hasSamePermissions(file.$permissions, expectedFilePermissions)) {
          stats.filePermissionMismatches += 1;

          const updated = await updateFilePermissionsIfNeeded(
            storage,
            config,
            legacyImageId,
            expectedFilePermissions,
            applyWrites,
          );

          if (updated) {
            stats.filePermissionsUpdated += 1;
          }
        }
      } catch (error) {
        stats.failed += 1;
        console.error(`[migrate-post-images-to-media] Failed for post ${post.$id}`, error);
      }
    }
  }

  logSection('Summary');
  logStats('migration summary', stats);

  return stats;
}

function countMismatches(stats, skipFiles) {
  return (
    stats.postsWithEmptyMediaAfterMigration +
    stats.postsWithMediaCountMismatch +
    stats.postMediaPermissionMismatches +
    (skipFiles ? 0 : stats.filePermissionMismatches)
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const rootDir = process.cwd();
  const loadedEnvFiles = loadEnvFiles(rootDir);
  const config = readConfig(options);
  const { tablesDB, storage } = createClients(config);

  if (loadedEnvFiles.length > 0) {
    console.log(`Loaded environment files: ${loadedEnvFiles.join(', ')}`);
  }

  const stats = await runMigration(tablesDB, storage, config, options);

  if (options.mode === MODE_DRY_RUN) {
    console.log('\nDry-run completed. No writes were sent to Appwrite.');
    return;
  }

  if (options.mode === MODE_RUN) {
    console.log('\nMigration run completed.');
    return;
  }

  const mismatches = countMismatches(stats, options.skipFiles);

  if (mismatches > 0) {
    console.error(`\nVerification failed with ${mismatches} mismatch(es).`);
    process.exitCode = 1;
    return;
  }

  console.log('\nVerification passed with no mismatches.');
}

main().catch((error) => {
  console.error('\nMigration failed.');
  console.error(error);
  process.exitCode = 1;
});
