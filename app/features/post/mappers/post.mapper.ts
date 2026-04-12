import type { Models } from 'appwrite';
import type {
  CursorPage,
  PostCardViewModel,
  PostDetailViewModel,
  PostGridItemViewModel,
  RawPostListRow,
  RawPostRow,
} from '../types/post.type';

function mapPostCreator(row: RawPostRow | RawPostListRow) {
  if (!row.creator) {
    return null;
  }

  return {
    id: row.creator.$id,
    name: row.creator.name ?? 'Unknown user',
    imageUrl: row.creator.imageUrl ?? null,
  };
}

function mapPostLikeCount(row: RawPostRow | RawPostListRow): number {
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
