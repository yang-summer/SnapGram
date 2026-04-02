import type { Models } from 'appwrite';
import type { PostCardViewModel, RawPostRow } from '../types/post.type';

export function mapPostRowToCardViewModel(row: RawPostRow): PostCardViewModel | null {
  // 拦截坏数据：如果 row 不存在或者 creator 不存在，直接返回 null
  if (!row || !row.creator) {
    return null;
  }

  return {
    id: row.$id,
    createdAt: row.$createdAt,
    caption: row.caption,
    imageUrl: row.imageUrl,
    location: row.location ?? null,
    tags: row.tags ?? [],
    creator: {
      id: row.creator.$id,
      name: row.creator.name,
      imageUrl: row.creator.imageUrl,
    },
    likes: row.likes,
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
