import type { Models } from 'appwrite';
import { AppwriteException, ID, Query } from 'appwrite';
import { appwriteConfig, tablesDB } from '~/lib/appwrite/config';
import { buildPrivateOwnerPermissions } from '~/lib/appwrite/permissions';
import type {
  CreateViewerPostSaveInput,
  DeleteViewerPostSaveInput,
  DeleteViewerPostSaveResult,
  ProfileEngagementPageParams,
  RawViewerLikeRecord,
  RawViewerSaveRecord,
} from '../types/post.type';

const VIEWER_ENGAGEMENT_RECORD_SELECT = ['$id', 'postId', 'userId'];
const PROFILE_ENGAGEMENT_RECORD_SELECT = ['$id', '$createdAt', '$sequence', 'postId', 'userId'];
const VIEWER_RECORD_LIMIT = 100;
const DEFAULT_PROFILE_ENGAGEMENT_PAGE_SIZE = 20;
const APPWRITE_MAX_LIST_LIMIT = 100;
const POST_LIKE_COUNT_COLUMN = 'likeCount';
const POST_LIKE_COUNT_STEP = 1;
const POST_SAVE_COUNT_COLUMN = 'saveCount';
const POST_SAVE_COUNT_STEP = 1;

function normalizePostIds(postIds: string[]): string[] {
  return Array.from(
    new Set(postIds.map((postId) => postId.trim()).filter((postId) => postId.length > 0)),
  );
}

function clampListLimit(limit: number | undefined, fallback: number): number {
  if (typeof limit !== 'number' || Number.isNaN(limit)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), APPWRITE_MAX_LIST_LIMIT);
}

function createViewerRecordLookupQueries(viewerProfileId: string, postId: string) {
  return [
    Query.select(VIEWER_ENGAGEMENT_RECORD_SELECT),
    Query.equal('userId', viewerProfileId),
    Query.equal('postId', postId),
    Query.limit(1),
  ];
}

async function listAllViewerRecords<Row extends RawViewerLikeRecord | RawViewerSaveRecord>(
  tableId: string,
  viewerProfileId: string,
): Promise<Row[]> {
  if (!viewerProfileId) {
    return [];
  }

  const result = await tablesDB.listRows<Row>({
    databaseId: appwriteConfig.databaseId,
    tableId,
    queries: [
      Query.select(VIEWER_ENGAGEMENT_RECORD_SELECT),
      Query.equal('userId', viewerProfileId),
      Query.limit(VIEWER_RECORD_LIMIT),
    ],
    total: false,
  });

  return result.rows;
}

async function findViewerRecord<Row extends RawViewerLikeRecord | RawViewerSaveRecord>(
  tableId: string,
  viewerProfileId: string,
  postId: string,
): Promise<Row | null> {
  if (!viewerProfileId || !postId) {
    return null;
  }

  const result = await tablesDB.listRows<Row>({
    databaseId: appwriteConfig.databaseId,
    tableId,
    queries: createViewerRecordLookupQueries(viewerProfileId, postId),
    total: false,
  });

  return result.rows[0] ?? null;
}

async function listViewerRecordsByPostIds<Row extends RawViewerLikeRecord | RawViewerSaveRecord>(
  tableId: string,
  viewerProfileId: string,
  postIds: string[],
): Promise<Row[]> {
  const normalizedPostIds = normalizePostIds(postIds);

  if (!viewerProfileId || normalizedPostIds.length === 0) {
    return [];
  }

  const rows: Row[] = [];

  for (let index = 0; index < normalizedPostIds.length; index += VIEWER_RECORD_LIMIT) {
    const postIdsBatch = normalizedPostIds.slice(index, index + VIEWER_RECORD_LIMIT);
    const result = await tablesDB.listRows<Row>({
      databaseId: appwriteConfig.databaseId,
      tableId,
      queries: [
        Query.select(VIEWER_ENGAGEMENT_RECORD_SELECT),
        Query.equal('userId', viewerProfileId),
        Query.equal('postId', postIdsBatch),
        Query.limit(postIdsBatch.length),
      ],
      total: false,
    });

    rows.push(...result.rows);
  }

  return rows;
}

async function listProfileEngagementRecordsPage<
  Row extends RawViewerLikeRecord | RawViewerSaveRecord,
>(
  tableId: string,
  { profileId, cursor = null, limit = DEFAULT_PROFILE_ENGAGEMENT_PAGE_SIZE }: ProfileEngagementPageParams,
): Promise<Models.RowList<Row>> {
  if (!profileId) {
    throw new Error('Profile ID is required to list profile engagement records.');
  }

  const normalizedLimit = clampListLimit(limit, DEFAULT_PROFILE_ENGAGEMENT_PAGE_SIZE);
  const queries = [
    Query.select(PROFILE_ENGAGEMENT_RECORD_SELECT),
    Query.equal('userId', profileId),
    Query.orderDesc('$sequence'),
    Query.limit(normalizedLimit),
  ];

  if (cursor) {
    queries.push(Query.cursorAfter(cursor));
  }

  return await tablesDB.listRows<Row>({
    databaseId: appwriteConfig.databaseId,
    tableId,
    queries,
    total: false,
  });
}

async function countProfileEngagementRecords(
  tableId: string,
  profileId: string,
  recordName: string,
): Promise<number> {
  if (!profileId) {
    throw new Error(`Profile ID is required to count profile ${recordName} records.`);
  }

  const result = await tablesDB.listRows<Models.Row>({
    databaseId: appwriteConfig.databaseId,
    tableId,
    queries: [Query.select(['$id']), Query.equal('userId', profileId), Query.limit(1)],
  });

  return result.total;
}

export async function listAllViewerLikeRecords(
  viewerProfileId: string,
): Promise<RawViewerLikeRecord[]> {
  try {
    return await listAllViewerRecords<RawViewerLikeRecord>(appwriteConfig.likesTableId, viewerProfileId);
  } catch (error) {
    console.error(
      '[PostEngagementApi.listAllViewerLikeRecords] Failed to load viewer like records.',
      error,
    );
    throw error;
  }
}

export async function listAllViewerSaveRecords(
  viewerProfileId: string,
): Promise<RawViewerSaveRecord[]> {
  try {
    return await listAllViewerRecords<RawViewerSaveRecord>(appwriteConfig.saveTableId, viewerProfileId);
  } catch (error) {
    console.error(
      '[PostEngagementApi.listAllViewerSaveRecords] Failed to load viewer save records.',
      error,
    );
    throw error;
  }
}

export async function listProfileLikeRecordsPage(
  params: ProfileEngagementPageParams,
): Promise<Models.RowList<RawViewerLikeRecord>> {
  try {
    return await listProfileEngagementRecordsPage<RawViewerLikeRecord>(
      appwriteConfig.likesTableId,
      params,
    );
  } catch (error) {
    console.error(
      '[PostEngagementApi.listProfileLikeRecordsPage] Failed to load profile like records.',
      error,
    );
    throw error;
  }
}

export async function listProfileSaveRecordsPage(
  params: ProfileEngagementPageParams,
): Promise<Models.RowList<RawViewerSaveRecord>> {
  try {
    return await listProfileEngagementRecordsPage<RawViewerSaveRecord>(
      appwriteConfig.saveTableId,
      params,
    );
  } catch (error) {
    console.error(
      '[PostEngagementApi.listProfileSaveRecordsPage] Failed to load profile save records.',
      error,
    );
    throw error;
  }
}

export async function countProfileLikeRecords(profileId: string): Promise<number> {
  try {
    return await countProfileEngagementRecords(
      appwriteConfig.likesTableId,
      profileId,
      'like',
    );
  } catch (error) {
    console.error(
      '[PostEngagementApi.countProfileLikeRecords] Failed to count profile like records.',
      error,
    );
    throw error;
  }
}

export async function countProfileSaveRecords(profileId: string): Promise<number> {
  try {
    return await countProfileEngagementRecords(
      appwriteConfig.saveTableId,
      profileId,
      'save',
    );
  } catch (error) {
    console.error(
      '[PostEngagementApi.countProfileSaveRecords] Failed to count profile save records.',
      error,
    );
    throw error;
  }
}

export async function findViewerLikeRecord(
  viewerProfileId: string,
  postId: string,
): Promise<RawViewerLikeRecord | null> {
  try {
    return await findViewerRecord<RawViewerLikeRecord>(
      appwriteConfig.likesTableId,
      viewerProfileId,
      postId,
    );
  } catch (error) {
    console.error('[PostEngagementApi.findViewerLikeRecord] Failed to load viewer like record.', error);
    throw error;
  }
}

export async function findViewerSaveRecord(
  viewerProfileId: string,
  postId: string,
): Promise<RawViewerSaveRecord | null> {
  try {
    return await findViewerRecord<RawViewerSaveRecord>(
      appwriteConfig.saveTableId,
      viewerProfileId,
      postId,
    );
  } catch (error) {
    console.error('[PostEngagementApi.findViewerSaveRecord] Failed to load viewer save record.', error);
    throw error;
  }
}

export async function listViewerLikeRecordsByPostIds(
  viewerProfileId: string,
  postIds: string[],
): Promise<RawViewerLikeRecord[]> {
  try {
    return await listViewerRecordsByPostIds<RawViewerLikeRecord>(
      appwriteConfig.likesTableId,
      viewerProfileId,
      postIds,
    );
  } catch (error) {
    console.error(
      '[PostEngagementApi.listViewerLikeRecordsByPostIds] Failed to load viewer like records.',
      error,
    );
    throw error;
  }
}

export async function listViewerSaveRecordsByPostIds(
  viewerProfileId: string,
  postIds: string[],
): Promise<RawViewerSaveRecord[]> {
  try {
    return await listViewerRecordsByPostIds<RawViewerSaveRecord>(
      appwriteConfig.saveTableId,
      viewerProfileId,
      postIds,
    );
  } catch (error) {
    console.error(
      '[PostEngagementApi.listViewerSaveRecordsByPostIds] Failed to load viewer save records.',
      error,
    );
    throw error;
  }
}

async function getRequiredViewerSaveRecord(
  viewerProfileId: string,
  postId: string,
): Promise<RawViewerSaveRecord> {
  const existingRecord = await findViewerSaveRecord(viewerProfileId, postId);

  if (!existingRecord) {
    throw new Error('The save record already exists, but it could not be loaded.');
  }

  return existingRecord;
}

export async function createViewerSaveRecord(
  input: CreateViewerPostSaveInput,
): Promise<RawViewerSaveRecord> {
  if (!input.viewerProfileId) {
    throw new Error('Viewer profile ID is required to save a post.');
  }

  if (!input.viewerAccountId) {
    throw new Error('Viewer account ID is required to save a post.');
  }

  if (!input.postId) {
    throw new Error('Post ID is required to save a post.');
  }

  try {
    const createdRecord = await tablesDB.createRow<RawViewerSaveRecord>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.saveTableId,
      rowId: ID.unique(),
      data: {
        userId: input.viewerProfileId,
        postId: input.postId,
      },
      permissions: buildPrivateOwnerPermissions(input.viewerAccountId),
    });

    await tablesDB.incrementRowColumn({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: input.postId,
      column: POST_SAVE_COUNT_COLUMN,
      value: POST_SAVE_COUNT_STEP,
    });

    return createdRecord;
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      return await getRequiredViewerSaveRecord(input.viewerProfileId, input.postId);
    }

    console.error(
      '[PostEngagementApi.createViewerSaveRecord] Failed to create a viewer save record.',
      error,
    );
    throw error;
  }
}

export async function deleteViewerSaveRecord(
  input: DeleteViewerPostSaveInput,
): Promise<DeleteViewerPostSaveResult> {
  if (!input.viewerProfileId) {
    throw new Error('Viewer profile ID is required to delete a saved post.');
  }

  if (!input.postId) {
    throw new Error('Post ID is required to delete a saved post.');
  }

  try {
    const existingRecord = await findViewerSaveRecord(input.viewerProfileId, input.postId);
    const resolvedSaveRecordId = existingRecord?.$id ?? null;

    if (!existingRecord) {
      return {
        saveRecordId: resolvedSaveRecordId,
        deleted: false,
      };
    }

    await tablesDB.deleteRow({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.saveTableId,
      rowId: existingRecord.$id,
    });

    await tablesDB.decrementRowColumn({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.postsTableId,
      rowId: input.postId,
      column: POST_SAVE_COUNT_COLUMN,
      value: POST_SAVE_COUNT_STEP,
      min: 0,
    });

    return {
      saveRecordId: resolvedSaveRecordId,
      deleted: true,
    };
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return {
        saveRecordId: null,
        deleted: false,
      };
    }

    console.error(
      '[PostEngagementApi.deleteViewerSaveRecord] Failed to delete a viewer save record.',
      error,
    );
    throw error;
  }
}
