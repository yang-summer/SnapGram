import type { Models } from 'appwrite';
import {
  DEFAULT_POST_ASPECT_RATIO_BUCKET,
  POST_ASPECT_RATIO_BUCKETS,
} from '../types/post.type';
import type {
  CursorPage,
  HomeFeedPostViewModel,
  PostAspectRatioBucket,
  PostCardViewModel,
  PostDetailViewModel,
  PostEditorInitialData,
  PostGridItemViewModel,
  RawPostEditorRow,
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

export function mapPostRowToDetailViewModel(row: RawPostRow): PostDetailViewModel | null {
  // 拦截坏数据：如果 row 不存在或者 creator 不存在，直接返回 null
  const creator = row ? mapPostCreator(row) : null;

  if (!row || !creator) {
    return null;
  }

  return {
    id: row.$id,
    createdAt: row.$createdAt,
    caption: row.caption ?? '',
    imageId: row.imageId,
    imageUrl: row.imageUrl,
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

export function mapPostEditorRowToInitialData(row: RawPostEditorRow): PostEditorInitialData | null {
  if (!row) {
    return null;
  }

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
