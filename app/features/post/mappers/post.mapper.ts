import type { Models } from 'appwrite';
import {
  DEFAULT_POST_ASPECT_RATIO_BUCKET,
  POST_ASPECT_RATIO_BUCKETS,
} from '../types/post.type';
import type {
  CursorPage,
  ExistingPostMediaEditorItem,
  HomeFeedPostViewModel,
  PostAspectRatioBucket,
  PostCardViewModel,
  PostDetailViewModel,
  PostEditorInitialData,
  PostGridItemViewModel,
  PostMediaViewModel,
  RawPostEditorRow,
  RawPostMediaRow,
  RawPostHomeFeedRow,
  RawPostListRow,
  RawPostRow,
} from '../types/post.type';

type PostRowWithCreator = RawPostRow | RawPostListRow | RawPostHomeFeedRow;

function mapPostCreator(row: PostRowWithCreator) {
  if (!row.creator) {
    return null;
  }

  return {
    id: row.creator.$id,
    name: row.creator.name ?? 'Unknown user',
    imageUrl: row.creator.imageUrl ?? null,
  };
}

function mapPostLikeCount(row: PostRowWithCreator): number {
  if (typeof row.likeCount === 'number' && Number.isFinite(row.likeCount)) {
    return Math.max(0, Math.trunc(row.likeCount));
  }

  return 0;
}

function mapPostSaveCount(row: RawPostRow | RawPostListRow): number {
  if (typeof row.saveCount === 'number' && Number.isFinite(row.saveCount)) {
    return Math.max(0, Math.trunc(row.saveCount));
  }

  return 0;
}

export function normalizePostAspectRatioBucket(
  value: string | null | undefined,
): PostAspectRatioBucket {
  if (
    typeof value === 'string' &&
    (POST_ASPECT_RATIO_BUCKETS as readonly string[]).includes(value)
  ) {
    return value as PostAspectRatioBucket;
  }

  return DEFAULT_POST_ASPECT_RATIO_BUCKET;
}

function normalizeOptionalImagePlaceholder(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeOptionalImageDimension(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalizedValue = Math.trunc(value);

  return normalizedValue > 0 ? normalizedValue : null;
}

function normalizeMediaSortOrder(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

export function mapPostMediaRowToViewModel(
  row: RawPostMediaRow,
  resolveImageUrl: (fileId: string) => string,
): PostMediaViewModel | null {
  const fileId = row.fileId?.trim() ?? '';

  if (!fileId) {
    return null;
  }

  const imageUrl = resolveImageUrl(fileId)?.trim() ?? '';

  if (!imageUrl) {
    return null;
  }

  return {
    id: row.$id,
    fileId,
    imageUrl,
    sortOrder: normalizeMediaSortOrder(row.sortOrder),
    width: normalizeOptionalImageDimension(row.width),
    height: normalizeOptionalImageDimension(row.height),
    aspectRatioBucket: normalizePostAspectRatioBucket(row.aspectRatioBucket),
    placeholder: normalizeOptionalImagePlaceholder(row.placeholder),
  };
}

export function mapPostMediaRowsToOrderedViewModels(
  rows: RawPostMediaRow[],
  resolveImageUrl: (fileId: string) => string,
): PostMediaViewModel[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const result: PostMediaViewModel[] = [];
  const sortedRows = [...rows].sort((left, right) => left.sortOrder - right.sortOrder);

  for (let index = 0; index < sortedRows.length; index += 1) {
    const mappedItem = mapPostMediaRowToViewModel(sortedRows[index], resolveImageUrl);

    if (mappedItem !== null) {
      result.push(mappedItem);
    }
  }

  return result;
}

export function buildLegacyFallbackMediaFromPost(row: RawPostEditorRow): PostMediaViewModel | null {
  const fileId = row.imageId?.trim() ?? '';
  const imageUrl = row.imageUrl?.trim() ?? '';

  if (!fileId || !imageUrl) {
    return null;
  }

  return {
    id: `legacy-cover-${row.$id}`,
    fileId,
    imageUrl,
    sortOrder: 0,
    width: normalizeOptionalImageDimension(row.imageWidth),
    height: normalizeOptionalImageDimension(row.imageHeight),
    aspectRatioBucket: normalizePostAspectRatioBucket(row.aspectRatioBucket),
    placeholder: normalizeOptionalImagePlaceholder(row.imagePlaceholder),
  };
}

export function mapPostRowToCardViewModel(row: RawPostRow): PostCardViewModel | null {
  // 拦截坏数据：如果 row 不存在或者 creator 不存在，直接返回 null
  const creator = row ? mapPostCreator(row) : null;

  if (!row || !creator) {
    return null;
  }

  return {
    id: row.$id,
    createdAt: row.$createdAt,
    caption: row.caption ?? '',
    imageUrl: row.imageUrl,
    location: row.location ?? null,
    tags: row.tags ?? [],
    creator,
    likeCount: mapPostLikeCount(row),
    saveCount: mapPostSaveCount(row),
  };
}

export function mapPostRowsToCardViewModels(data: Models.RowList<RawPostRow>): PostCardViewModel[] {
  if (!data || !Array.isArray(data.rows)) {
    return [];
  }

  const result: PostCardViewModel[] = [];
  const length = data.rows.length;

  for (let i = 0; i < length; i++) {
    const mappedCard = mapPostRowToCardViewModel(data.rows[i]);
    // 只有当映射结果不是 null 时，才推入结果数组
    if (mappedCard !== null) {
      result.push(mappedCard);
    }
  }

  return result;
}

export function mapPostRowToDetailViewModel(
  row: RawPostRow,
  mediaRows: RawPostMediaRow[] = [],
  resolveImageUrl?: (fileId: string) => string,
): PostDetailViewModel | null {
  // 拦截坏数据：如果 row 不存在或者 creator 不存在，直接返回 null
  const creator = row ? mapPostCreator(row) : null;

  if (!row || !creator) {
    return null;
  }

  const legacyFallbackMedia = buildLegacyFallbackMediaFromPost(row as RawPostEditorRow);
  const media =
    Array.isArray(mediaRows) && mediaRows.length > 0 && resolveImageUrl
      ? mapPostMediaRowsToOrderedViewModels(mediaRows, resolveImageUrl)
      : [];

  const resolvedMedia = media.length > 0 ? media : legacyFallbackMedia ? [legacyFallbackMedia] : [];

  return {
    id: row.$id,
    createdAt: row.$createdAt,
    caption: row.caption ?? '',
    imageId: row.imageId,
    imageUrl: row.imageUrl,
    media: resolvedMedia,
    mediaCount: resolvedMedia.length,
    location: row.location ?? null,
    tags: row.tags ?? [],
    creator,
    likeCount: mapPostLikeCount(row),
    saveCount: mapPostSaveCount(row),
  };
}

export function mapPostRowToGridItemViewModel(row: RawPostListRow): PostGridItemViewModel | null {
  const creator = row ? mapPostCreator(row) : null;

  if (!row || !creator) {
    return null;
  }

  return {
    id: row.$id,
    imageUrl: row.imageUrl,
    creator,
    likeCount: mapPostLikeCount(row),
    saveCount: mapPostSaveCount(row),
  };
}

export function mapPostRowToHomeFeedItemViewModel(
  row: RawPostHomeFeedRow,
): HomeFeedPostViewModel | null {
  const creator = row ? mapPostCreator(row) : null;

  if (!row || !creator) {
    return null;
  }

  return {
    id: row.$id,
    createdAt: row.$createdAt,
    caption: row.caption ?? '',
    imageUrl: row.imageUrl,
    imagePlaceholder: normalizeOptionalImagePlaceholder(row.imagePlaceholder),
    aspectRatioBucket: normalizePostAspectRatioBucket(row.aspectRatioBucket),
    imageWidth: normalizeOptionalImageDimension(row.imageWidth),
    imageHeight: normalizeOptionalImageDimension(row.imageHeight),
    creator,
    likeCount: mapPostLikeCount(row),
  };
}

function mapLegacyPostEditorCoverToExistingMediaItem(
  row: RawPostEditorRow,
): ExistingPostMediaEditorItem | null {
  const legacyMedia = buildLegacyFallbackMediaFromPost(row);

  if (!legacyMedia) {
    return null;
  }

  return {
    kind: 'existing',
    clientMediaId: legacyMedia.id,
    isLegacyFallback: true,
    fileId: legacyMedia.fileId,
    imageUrl: legacyMedia.imageUrl,
    width: legacyMedia.width,
    height: legacyMedia.height,
    aspectRatioBucket: legacyMedia.aspectRatioBucket,
    placeholder: legacyMedia.placeholder,
    status: 'ready',
  };
}

export function mapPostMediaRowsToExistingEditorItems(
  rows: RawPostMediaRow[],
  resolveImageUrl: (fileId: string) => string,
): ExistingPostMediaEditorItem[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const result: ExistingPostMediaEditorItem[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const fileId = row.fileId?.trim() ?? '';

    if (!fileId) {
      continue;
    }

    result.push({
      kind: 'existing',
      clientMediaId: row.$id,
      isLegacyFallback: false,
      mediaId: row.$id,
      fileId,
      imageUrl: resolveImageUrl(fileId),
      width: normalizeOptionalImageDimension(row.width),
      height: normalizeOptionalImageDimension(row.height),
      aspectRatioBucket: normalizePostAspectRatioBucket(row.aspectRatioBucket),
      placeholder: normalizeOptionalImagePlaceholder(row.placeholder),
      status: 'ready',
    });
  }

  return result;
}

export function mapPostEditorRowToInitialData(
  row: RawPostEditorRow,
  existingMediaItems: ExistingPostMediaEditorItem[],
): PostEditorInitialData | null {
  if (!row) {
    return null;
  }

  const fallbackMediaItem =
    existingMediaItems.length === 0 ? mapLegacyPostEditorCoverToExistingMediaItem(row) : null;
  const resolvedExistingMediaItems =
    existingMediaItems.length > 0
      ? existingMediaItems
      : fallbackMediaItem
        ? [fallbackMediaItem]
        : [];

  return {
    id: row.$id,
    caption: row.caption ?? '',
    imageId: row.imageId,
    imageUrl: row.imageUrl,
    aspectRatioBucket: normalizePostAspectRatioBucket(row.aspectRatioBucket),
    imagePlaceholder: normalizeOptionalImagePlaceholder(row.imagePlaceholder),
    imageWidth: normalizeOptionalImageDimension(row.imageWidth),
    imageHeight: normalizeOptionalImageDimension(row.imageHeight),
    location: row.location ?? '',
    tags: (row.tags ?? []).join(', '),
    existingMediaItems: resolvedExistingMediaItems,
    isLegacyMediaFallback: resolvedExistingMediaItems.some((item) => item.isLegacyFallback),
    hasLegacyMediaFallback: resolvedExistingMediaItems.some((item) => item.isLegacyFallback),
  };
}

export function mapPostRowsToGridItemViewModels(data: Models.RowList<RawPostListRow>): PostGridItemViewModel[] {
  if (!data || !Array.isArray(data.rows)) {
    return [];
  }

  const result: PostGridItemViewModel[] = [];
  const length = data.rows.length;

  for (let i = 0; i < length; i++) {
    const mappedItem = mapPostRowToGridItemViewModel(data.rows[i]);

    if (mappedItem !== null) {
      result.push(mappedItem);
    }
  }

  return result;
}

export function mapPostRowsToHomeFeedItemViewModels(
  data: Models.RowList<RawPostHomeFeedRow>,
): HomeFeedPostViewModel[] {
  if (!data || !Array.isArray(data.rows)) {
    return [];
  }

  const result: HomeFeedPostViewModel[] = [];
  const length = data.rows.length;

  for (let i = 0; i < length; i++) {
    const mappedItem = mapPostRowToHomeFeedItemViewModel(data.rows[i]);

    if (mappedItem !== null) {
      result.push(mappedItem);
    }
  }

  return result;
}

export function mapPostRowsToOrderedHomeFeedItems(
  rows: RawPostHomeFeedRow[],
  orderedPostIds: string[],
): HomeFeedPostViewModel[] {
  if (!Array.isArray(rows) || rows.length === 0 || orderedPostIds.length === 0) {
    return [];
  }

  const itemByPostId: Record<string, HomeFeedPostViewModel> = {};

  for (let index = 0; index < rows.length; index += 1) {
    const mappedItem = mapPostRowToHomeFeedItemViewModel(rows[index]);

    if (mappedItem !== null) {
      itemByPostId[mappedItem.id] = mappedItem;
    }
  }

  const orderedItems: HomeFeedPostViewModel[] = [];
  const seenPostIds = new Set<string>();

  for (let index = 0; index < orderedPostIds.length; index += 1) {
    const postId = orderedPostIds[index];

    if (seenPostIds.has(postId)) {
      continue;
    }

    const item = itemByPostId[postId];

    if (item) {
      orderedItems.push(item);
      seenPostIds.add(postId);
    }
  }

  return orderedItems;
}

export function mapPostRowsToCursorPage(
  data: Models.RowList<RawPostListRow>,
  pageSize: number,
): CursorPage<PostGridItemViewModel> {
  const items = mapPostRowsToGridItemViewModels(data);
  const nextCursor =
    data.rows.length === pageSize && data.rows.length > 0 ? data.rows[data.rows.length - 1].$id : null;

  return {
    items,
    nextCursor,
  };
}

export function mapHomeFeedRowsToCursorPage(
  data: Models.RowList<RawPostHomeFeedRow>,
  pageSize: number,
): CursorPage<HomeFeedPostViewModel> {
  const items = mapPostRowsToHomeFeedItemViewModels(data);
  const nextCursor =
    data.rows.length === pageSize && data.rows.length > 0 ? data.rows[data.rows.length - 1].$id : null;

  return {
    items,
    nextCursor,
  };
}
