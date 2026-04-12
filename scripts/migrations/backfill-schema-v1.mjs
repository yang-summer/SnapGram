#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { AppwriteException, Client, Query, TablesDB } from 'node-appwrite';

const DEFAULT_BATCH_SIZE = 100;
const ENV_FILES = ['.env.migration.local', '.env.migration'];
const MODE_DRY_RUN = 'dry-run';
const MODE_RUN = 'run';
const MODE_VERIFY = 'verify';
const RETRIABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

const POSTS_BACKFILL_SELECT = [
  '$id',
  'caption',
  'tags',
  'status',
  'searchText',
  'likeCount',
  'saveCount',
  'commentCount',
  'likes.$id',
];

const POSTS_LIKES_SELECT = ['$id', 'likes.$id'];
const SAVES_SELECT = ['$id', 'user.$id', 'post.$id', 'userId', 'postId'];
const LIKES_SELECT = ['$id', 'userId', 'postId'];

function printHelp() {
  console.log(`Schema v1 backfill for Snapgram.

Usage:
  node scripts/migrations/backfill-schema-v1.mjs --dry-run
  node scripts/migrations/backfill-schema-v1.mjs --run
  node scripts/migrations/backfill-schema-v1.mjs --verify

Options:
  --dry-run            Compute changes without writing. Default mode.
  --run                Apply row updates and like imports.
  --verify             Re-scan and report mismatches after backfill.
  --limit=<1-100>      Batch size for listRows. Default: ${DEFAULT_BATCH_SIZE}
  --skip-like-import   Skip importing historical likes into the likes table.
  --help               Show this help text.

Environment:
  The script auto-loads .env.migration.local and .env.migration if present.
  Required:
    APPWRITE_ENDPOINT
    APPWRITE_PROJECT_ID
    APPWRITE_DATABASE_ID
    APPWRITE_API_KEY
  Optional:
    APPWRITE_POSTS_TABLE_ID   default: posts
    APPWRITE_SAVES_TABLE_ID   default: saves
    APPWRITE_LIKES_TABLE_ID   default: likes

Notes:
  - Pre-migration only: run this before removing legacy relationship columns such as posts.likes, users.liked, saves.user, and saves.post.
  - This script is intended for schema v1 migration before comments and new like writes go live.
  - Verify mode exits with code 1 when mismatches are found.
`);
}

function parseArgs(argv) {
  const args = {
    mode: MODE_DRY_RUN,
    batchSize: DEFAULT_BATCH_SIZE,
    skipLikeImport: false,
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

    if (arg === '--skip-like-import') {
      args.skipLikeImport = true;
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

function readConfig() {
  const config = {
    endpoint: process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_URL ?? '',
    projectId: process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? '',
    databaseId: process.env.APPWRITE_DATABASE_ID ?? process.env.VITE_APPWRITE_DATABASE_ID ?? '',
    apiKey: process.env.APPWRITE_API_KEY ?? '',
    postsTableId:
      process.env.APPWRITE_POSTS_TABLE_ID ?? process.env.VITE_APPWRITE_POSTS_TABLE_ID ?? 'posts',
    savesTableId:
      process.env.APPWRITE_SAVES_TABLE_ID ?? process.env.VITE_APPWRITE_SAVES_TABLE_ID ?? 'saves',
    likesTableId:
      process.env.APPWRITE_LIKES_TABLE_ID ?? process.env.VITE_APPWRITE_LIKES_TABLE_ID ?? 'likes',
  };

  const missing = Object.entries({
    APPWRITE_ENDPOINT: config.endpoint,
    APPWRITE_PROJECT_ID: config.projectId,
    APPWRITE_DATABASE_ID: config.databaseId,
    APPWRITE_API_KEY: config.apiKey,
  })
    .filter(([, value]) => value.trim().length === 0)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return config;
}

function createTablesClient(config) {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

  return new TablesDB(client);
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
      const shouldRetry =
        isAppwriteError && RETRIABLE_STATUS_CODES.has(error.code) && attempt < 3;

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

function normalizeSpace(value) {
  return value.replace(/\s+/gu, ' ').trim();
}

function normalizeNullableText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeSpace(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? normalizeSpace(item.replace(/^#/u, '')) : ''))
    .filter(Boolean);
}

function buildSearchText(caption, tags) {
  const parts = [];
  const normalizedCaption = typeof caption === 'string' ? normalizeSpace(caption) : '';

  if (normalizedCaption.length > 0) {
    parts.push(normalizedCaption);
  }

  const normalizedTags = normalizeTags(tags);
  if (normalizedTags.length > 0) {
    parts.push(...normalizedTags);
  }

  if (parts.length === 0) {
    return null;
  }

  return normalizeSpace(parts.join(' '));
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

function extractUniqueRelationIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueIds = new Set();

  for (const item of value) {
    const id = toRelationId(item);
    if (id) {
      uniqueIds.add(id);
    }
  }

  return Array.from(uniqueIds);
}

function toInteger(value, fallback = 0) {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
}

function pairKey(left, right) {
  return `${left}::${right}`;
}

function createLikeRowId(userId, postId) {
  const digest = createHash('sha256').update(`${userId}:${postId}`).digest('hex');
  return `lk_${digest.slice(0, 32)}`;
}

function createStats(initial = {}) {
  return {
    scanned: 0,
    updated: 0,
    created: 0,
    skipped: 0,
    failed: 0,
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

async function *listRowsByCursor(tablesDB, config, tableId, select, batchSize) {
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

async function updateRowIfNeeded(tablesDB, config, tableId, rowId, data, applyWrites) {
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

async function scanSaves(tablesDB, config, batchSize, applyWrites) {
  const stats = createStats({
    mirrorUpdatesNeeded: 0,
    missingUser: 0,
    missingPost: 0,
    duplicatePairs: 0,
  });
  const saveUsersByPost = new Map();

  for await (const rows of listRowsByCursor(
    tablesDB,
    config,
    config.savesTableId,
    SAVES_SELECT,
    batchSize,
  )) {
    for (const row of rows) {
      stats.scanned += 1;

      const relationUserId = toRelationId(row.user);
      const relationPostId = toRelationId(row.post);
      const nextUserId = relationUserId ?? normalizeNullableText(row.userId);
      const nextPostId = relationPostId ?? normalizeNullableText(row.postId);
      const data = {};

      if (nextUserId && row.userId !== nextUserId) {
        data.userId = nextUserId;
      }

      if (nextPostId && row.postId !== nextPostId) {
        data.postId = nextPostId;
      }

      if (Object.keys(data).length > 0) {
        stats.mirrorUpdatesNeeded += 1;

        try {
          const changed = await updateRowIfNeeded(
            tablesDB,
            config,
            config.savesTableId,
            row.$id,
            data,
            applyWrites,
          );

          if (changed) {
            stats.updated += 1;
          }
        } catch (error) {
          stats.failed += 1;
          console.error(`[saves] Failed to update ${row.$id}`, error);
          continue;
        }
      } else {
        stats.skipped += 1;
      }

      if (!nextUserId) {
        stats.missingUser += 1;
        continue;
      }

      if (!nextPostId) {
        stats.missingPost += 1;
        continue;
      }

      let postUsers = saveUsersByPost.get(nextPostId);
      if (!postUsers) {
        postUsers = new Set();
        saveUsersByPost.set(nextPostId, postUsers);
      }

      if (postUsers.has(nextUserId)) {
        stats.duplicatePairs += 1;
        continue;
      }

      postUsers.add(nextUserId);
    }
  }

  return {
    stats,
    saveUsersByPost,
  };
}

async function backfillPosts(tablesDB, config, batchSize, applyWrites, saveUsersByPost) {
  const stats = createStats({
    changedStatus: 0,
    changedSearchText: 0,
    changedLikeCount: 0,
    changedSaveCount: 0,
    changedCommentCount: 0,
  });

  for await (const rows of listRowsByCursor(
    tablesDB,
    config,
    config.postsTableId,
    POSTS_BACKFILL_SELECT,
    batchSize,
  )) {
    for (const row of rows) {
      stats.scanned += 1;

      const targetStatus = 'published';
      const targetSearchText = buildSearchText(row.caption, row.tags);
      const targetLikeCount = extractUniqueRelationIds(row.likes).length;
      const targetSaveCount = saveUsersByPost.get(row.$id)?.size ?? 0;
      const targetCommentCount = 0;
      const data = {};

      if (row.status !== targetStatus) {
        data.status = targetStatus;
        stats.changedStatus += 1;
      }

      if (normalizeNullableText(row.searchText) !== targetSearchText) {
        data.searchText = targetSearchText;
        stats.changedSearchText += 1;
      }

      if (toInteger(row.likeCount) !== targetLikeCount) {
        data.likeCount = targetLikeCount;
        stats.changedLikeCount += 1;
      }

      if (toInteger(row.saveCount) !== targetSaveCount) {
        data.saveCount = targetSaveCount;
        stats.changedSaveCount += 1;
      }

      if (toInteger(row.commentCount) !== targetCommentCount) {
        data.commentCount = targetCommentCount;
        stats.changedCommentCount += 1;
      }

      if (Object.keys(data).length > 0) {
        try {
          const changed = await updateRowIfNeeded(
            tablesDB,
            config,
            config.postsTableId,
            row.$id,
            data,
            applyWrites,
          );

          if (changed) {
            stats.updated += 1;
          }
        } catch (error) {
          stats.failed += 1;
          console.error(`[posts] Failed to update ${row.$id}`, error);
        }
      } else {
        stats.skipped += 1;
      }
    }
  }

  return stats;
}

async function loadExistingLikePairs(tablesDB, config, batchSize) {
  const stats = createStats({
    missingUserId: 0,
    missingPostId: 0,
    duplicatePairs: 0,
  });
  const existingLikePairs = new Set();

  for await (const rows of listRowsByCursor(
    tablesDB,
    config,
    config.likesTableId,
    LIKES_SELECT,
    batchSize,
  )) {
    for (const row of rows) {
      stats.scanned += 1;

      const userId = normalizeNullableText(row.userId);
      const postId = normalizeNullableText(row.postId);

      if (!userId) {
        stats.missingUserId += 1;
        continue;
      }

      if (!postId) {
        stats.missingPostId += 1;
        continue;
      }

      const key = pairKey(userId, postId);
      if (existingLikePairs.has(key)) {
        stats.duplicatePairs += 1;
      }

      existingLikePairs.add(key);
    }
  }

  return {
    stats,
    existingLikePairs,
  };
}

async function importHistoricalLikes(tablesDB, config, batchSize, applyWrites, existingLikePairs) {
  const stats = createStats({
    desiredPairs: 0,
    alreadyPresent: 0,
    conflictSkipped: 0,
  });

  for await (const rows of listRowsByCursor(
    tablesDB,
    config,
    config.postsTableId,
    POSTS_LIKES_SELECT,
    batchSize,
  )) {
    for (const row of rows) {
      const likedUserIds = extractUniqueRelationIds(row.likes);

      for (const userId of likedUserIds) {
        stats.desiredPairs += 1;

        const key = pairKey(userId, row.$id);
        if (existingLikePairs.has(key)) {
          stats.alreadyPresent += 1;
          continue;
        }

        if (!applyWrites) {
          existingLikePairs.add(key);
          stats.created += 1;
          continue;
        }

        try {
          await callWithRetry(
            () =>
              tablesDB.createRow({
                databaseId: config.databaseId,
                tableId: config.likesTableId,
                rowId: createLikeRowId(userId, row.$id),
                data: {
                  userId,
                  postId: row.$id,
                },
              }),
            `createRow:${config.likesTableId}:${userId}:${row.$id}`,
          );

          existingLikePairs.add(key);
          stats.created += 1;
        } catch (error) {
          if (error instanceof AppwriteException && error.code === 409) {
            existingLikePairs.add(key);
            stats.conflictSkipped += 1;
            continue;
          }

          stats.failed += 1;
          console.error(`[likes] Failed to create like pair ${userId} -> ${row.$id}`, error);
        }
      }
    }
  }

  return stats;
}

async function verifySavesMirror(tablesDB, config, batchSize) {
  const stats = {
    scanned: 0,
    userIdMismatches: 0,
    postIdMismatches: 0,
    missingUser: 0,
    missingPost: 0,
  };
  const saveUsersByPost = new Map();

  for await (const rows of listRowsByCursor(
    tablesDB,
    config,
    config.savesTableId,
    SAVES_SELECT,
    batchSize,
  )) {
    for (const row of rows) {
      stats.scanned += 1;

      const relationUserId = toRelationId(row.user);
      const relationPostId = toRelationId(row.post);
      const mirrorUserId = normalizeNullableText(row.userId);
      const mirrorPostId = normalizeNullableText(row.postId);
      const effectiveUserId = mirrorUserId ?? relationUserId;
      const effectivePostId = mirrorPostId ?? relationPostId;

      if (relationUserId !== mirrorUserId) {
        stats.userIdMismatches += 1;
      }

      if (relationPostId !== mirrorPostId) {
        stats.postIdMismatches += 1;
      }

      if (!effectiveUserId) {
        stats.missingUser += 1;
        continue;
      }

      if (!effectivePostId) {
        stats.missingPost += 1;
        continue;
      }

      let postUsers = saveUsersByPost.get(effectivePostId);
      if (!postUsers) {
        postUsers = new Set();
        saveUsersByPost.set(effectivePostId, postUsers);
      }

      postUsers.add(effectiveUserId);
    }
  }

  return {
    stats,
    saveUsersByPost,
  };
}

async function verifyPostsBackfill(tablesDB, config, batchSize, saveUsersByPost) {
  const stats = {
    scanned: 0,
    statusMismatches: 0,
    searchTextMismatches: 0,
    likeCountMismatches: 0,
    saveCountMismatches: 0,
    commentCountMismatches: 0,
  };
  const expectedLikePairs = new Set();

  for await (const rows of listRowsByCursor(
    tablesDB,
    config,
    config.postsTableId,
    POSTS_BACKFILL_SELECT,
    batchSize,
  )) {
    for (const row of rows) {
      stats.scanned += 1;

      const targetStatus = 'published';
      const targetSearchText = buildSearchText(row.caption, row.tags);
      const likedUserIds = extractUniqueRelationIds(row.likes);
      const targetLikeCount = likedUserIds.length;
      const targetSaveCount = saveUsersByPost.get(row.$id)?.size ?? 0;
      const targetCommentCount = 0;

      if (row.status !== targetStatus) {
        stats.statusMismatches += 1;
      }

      if (normalizeNullableText(row.searchText) !== targetSearchText) {
        stats.searchTextMismatches += 1;
      }

      if (toInteger(row.likeCount) !== targetLikeCount) {
        stats.likeCountMismatches += 1;
      }

      if (toInteger(row.saveCount) !== targetSaveCount) {
        stats.saveCountMismatches += 1;
      }

      if (toInteger(row.commentCount) !== targetCommentCount) {
        stats.commentCountMismatches += 1;
      }

      for (const userId of likedUserIds) {
        expectedLikePairs.add(pairKey(userId, row.$id));
      }
    }
  }

  return {
    stats,
    expectedLikePairs,
  };
}

async function verifyLikesImport(tablesDB, config, batchSize, expectedLikePairs) {
  const { stats: scanStats, existingLikePairs } = await loadExistingLikePairs(
    tablesDB,
    config,
    batchSize,
  );

  let missingPairs = 0;
  for (const key of expectedLikePairs) {
    if (!existingLikePairs.has(key)) {
      missingPairs += 1;
    }
  }

  let extraPairs = 0;
  for (const key of existingLikePairs) {
    if (!expectedLikePairs.has(key)) {
      extraPairs += 1;
    }
  }

  return {
    stats: {
      ...scanStats,
      expectedPairs: expectedLikePairs.size,
      actualPairs: existingLikePairs.size,
      missingPairs,
      extraPairs,
    },
  };
}

async function runBackfill(tablesDB, config, options) {
  const applyWrites = options.mode === MODE_RUN;

  logSection('Configuration');
  console.log(`mode: ${options.mode}`);
  console.log(`batchSize: ${options.batchSize}`);
  console.log(`skipLikeImport: ${options.skipLikeImport}`);
  console.log(`databaseId: ${config.databaseId}`);
  console.log(`postsTableId: ${config.postsTableId}`);
  console.log(`savesTableId: ${config.savesTableId}`);
  console.log(`likesTableId: ${config.likesTableId}`);

  logSection('Phase 1 - Backfill saves mirror fields');
  const { stats: savesStats, saveUsersByPost } = await scanSaves(
    tablesDB,
    config,
    options.batchSize,
    applyWrites,
  );
  logStats('saves summary', savesStats);

  logSection('Phase 2 - Backfill post counters and search fields');
  const postsStats = await backfillPosts(
    tablesDB,
    config,
    options.batchSize,
    applyWrites,
    saveUsersByPost,
  );
  logStats('posts summary', postsStats);

  if (options.skipLikeImport) {
    logSection('Phase 3 - Historical likes import skipped');
    console.log('skipLikeImport=true, no likes were scanned or created.');
    return;
  }

  logSection('Phase 3 - Load existing likes table');
  const { stats: existingLikesStats, existingLikePairs } = await loadExistingLikePairs(
    tablesDB,
    config,
    options.batchSize,
  );
  logStats('existing likes summary', existingLikesStats);

  logSection('Phase 4 - Import historical likes');
  const likesImportStats = await importHistoricalLikes(
    tablesDB,
    config,
    options.batchSize,
    applyWrites,
    existingLikePairs,
  );
  logStats('likes import summary', likesImportStats);
}

async function runVerify(tablesDB, config, options) {
  logSection('Verify - Saves mirror fields');
  const { stats: savesVerifyStats, saveUsersByPost } = await verifySavesMirror(
    tablesDB,
    config,
    options.batchSize,
  );
  logStats('saves verify summary', savesVerifyStats);

  logSection('Verify - Posts backfill fields');
  const { stats: postsVerifyStats, expectedLikePairs } = await verifyPostsBackfill(
    tablesDB,
    config,
    options.batchSize,
    saveUsersByPost,
  );
  logStats('posts verify summary', postsVerifyStats);

  logSection('Verify - Likes import');
  const { stats: likesVerifyStats } = await verifyLikesImport(
    tablesDB,
    config,
    options.batchSize,
    expectedLikePairs,
  );
  logStats('likes verify summary', likesVerifyStats);

  const mismatches =
    savesVerifyStats.userIdMismatches +
    savesVerifyStats.postIdMismatches +
    postsVerifyStats.statusMismatches +
    postsVerifyStats.searchTextMismatches +
    postsVerifyStats.likeCountMismatches +
    postsVerifyStats.saveCountMismatches +
    postsVerifyStats.commentCountMismatches +
    likesVerifyStats.missingPairs;

  if (mismatches > 0) {
    console.error(`\nVerification failed with ${mismatches} mismatch(es).`);
    process.exitCode = 1;
    return;
  }

  console.log('\nVerification passed with no mismatches.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const rootDir = process.cwd();
  const loadedEnvFiles = loadEnvFiles(rootDir);
  const config = readConfig();
  const tablesDB = createTablesClient(config);

  if (loadedEnvFiles.length > 0) {
    console.log(`Loaded environment files: ${loadedEnvFiles.join(', ')}`);
  }

  if (options.mode === MODE_VERIFY) {
    await runVerify(tablesDB, config, options);
    return;
  }

  await runBackfill(tablesDB, config, options);

  if (options.mode === MODE_DRY_RUN) {
    console.log('\nDry-run completed. No writes were sent to Appwrite.');
  } else {
    console.log('\nBackfill run completed.');
  }
}

main().catch((error) => {
  console.error('\nMigration failed.');
  console.error(error);
  process.exitCode = 1;
});
