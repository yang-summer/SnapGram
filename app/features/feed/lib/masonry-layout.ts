import type { PostAspectRatioBucket } from '~/features/post/types/post.type';

export const MASONRY_LAYOUT = {
  defaultColumnWidth: 240,
  minColumnCount: 2,
  maxColumnCount: 5,
  minColumnWidth: 220,
  cardHorizontalPadding: 12,
  cardVerticalPadding: 12,
  cardContentGap: 8,
  cardMetaHeight: 24,
  captionLineHeight: 20,
  captionMaxLines: 2,
  minCharsPerLine: 12,
  estimatedCharWidth: 8,
  columnGap: 16,
} as const;

export const MASONRY_FALLBACK_CONTAINER_WIDTH =
  MASONRY_LAYOUT.defaultColumnWidth * MASONRY_LAYOUT.minColumnCount +
  MASONRY_LAYOUT.columnGap;

const ASPECT_RATIO_VALUES: Record<PostAspectRatioBucket, number> = {
  '1:1': 1,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
};

export type MasonryCardHeightEstimateInput = {
  caption: string;
  aspectRatioBucket: PostAspectRatioBucket;
};

// 将任意列数约束到瀑布流允许的 2-5 列范围内。
export function clampMasonryColumnCount(columnCount: number): number {
  if (!Number.isFinite(columnCount)) {
    return MASONRY_LAYOUT.minColumnCount;
  }

  return Math.min(
    Math.max(Math.trunc(columnCount), MASONRY_LAYOUT.minColumnCount),
    MASONRY_LAYOUT.maxColumnCount,
  );
}

// 根据容器真实宽度推导当前应该使用的列数。
export function getMasonryColumnCount(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return MASONRY_LAYOUT.minColumnCount;
  }

  const rawColumnCount = Math.floor(
    (containerWidth + MASONRY_LAYOUT.columnGap) /
      (MASONRY_LAYOUT.minColumnWidth + MASONRY_LAYOUT.columnGap),
  );

  return clampMasonryColumnCount(rawColumnCount);
}

// 根据容器宽度、列数和列间距计算每一列的实际可用宽度。
export function getMasonryColumnWidth(containerWidth: number, columnCount: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return MASONRY_LAYOUT.defaultColumnWidth;
  }

  const normalizedColumnCount = clampMasonryColumnCount(columnCount);
  const totalGapWidth = MASONRY_LAYOUT.columnGap * (normalizedColumnCount - 1);

  return Math.max(1, (containerWidth - totalGapWidth) / normalizedColumnCount);
}

// 归一化 ResizeObserver 或 DOM 测量得到的宽度，避免亚像素抖动反复触发重排。
export function normalizeMeasuredWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) {
    return 0;
  }

  return Math.round(width);
}

// 将图片比例桶转换为 CSS aspect-ratio 和高度估算可使用的数值比例。
export function getAspectRatioValue(bucket: PostAspectRatioBucket): number {
  return ASPECT_RATIO_VALUES[bucket];
}

// 根据 caption 长度和列宽估算两行截断后的文案高度。
export function estimateCaptionHeight(caption: string, columnWidth: number): number {
  const normalizedCaption = caption.trim();

  if (normalizedCaption.length === 0) {
    return 0;
  }

  const contentWidth = Math.max(columnWidth - MASONRY_LAYOUT.cardHorizontalPadding * 2, 1);
  const estimatedCharsPerLine = Math.max(
    MASONRY_LAYOUT.minCharsPerLine,
    Math.floor(contentWidth / MASONRY_LAYOUT.estimatedCharWidth),
  );
  const estimatedLineCount = Math.min(
    Math.ceil(normalizedCaption.length / estimatedCharsPerLine),
    MASONRY_LAYOUT.captionMaxLines,
  );

  return estimatedLineCount * MASONRY_LAYOUT.captionLineHeight;
}

// 估算单张首页卡片的整体高度，用于决定它应该进入当前最短列。
export function estimateMasonryCardHeight(
  item: MasonryCardHeightEstimateInput,
  columnWidth: number,
): number {
  const aspectRatio = getAspectRatioValue(item.aspectRatioBucket);
  const imageHeight = columnWidth / aspectRatio;
  const captionHeight = estimateCaptionHeight(item.caption, columnWidth);
  const contentHeight =
    captionHeight > 0 ? captionHeight + MASONRY_LAYOUT.cardContentGap : 0;

  return (
    imageHeight +
    MASONRY_LAYOUT.cardMetaHeight +
    contentHeight +
    MASONRY_LAYOUT.cardVerticalPadding * 2
  );
}
