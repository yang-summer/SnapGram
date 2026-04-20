import { useEffect, useMemo, useRef, useState } from 'react';
import MasonryPostCard from './MasonryPostCard';
import type { HomeFeedPostViewModel, PostAspectRatioBucket } from '../types/post.type';

const DEFAULT_MASONRY_COLUMN_WIDTH = 240;
const MASONRY_MIN_COLUMN_COUNT = 2;
const MASONRY_MAX_COLUMN_COUNT = 5;
const MASONRY_MIN_COLUMN_WIDTH = 220;
const MASONRY_CARD_HORIZONTAL_PADDING = 12;
const MASONRY_CARD_VERTICAL_PADDING = 12;
const MASONRY_CARD_CONTENT_GAP = 10;
const MASONRY_CARD_META_HEIGHT = 44;
const MASONRY_CAPTION_LINE_HEIGHT = 20;
const MASONRY_CAPTION_MAX_LINES = 2;
const MASONRY_MIN_CHARS_PER_LINE = 12;
const MASONRY_ESTIMATED_CHAR_WIDTH = 8;
const MASONRY_COLUMN_GAP = 16;
const MASONRY_FALLBACK_CONTAINER_WIDTH =
  DEFAULT_MASONRY_COLUMN_WIDTH * MASONRY_MIN_COLUMN_COUNT + MASONRY_COLUMN_GAP;

const ASPECT_RATIO_VALUES: Record<PostAspectRatioBucket, number> = {
  '1:1': 1,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
};

export type MasonryFeedProps = {
  items: HomeFeedPostViewModel[];
};

type MasonryColumn = {
  items: HomeFeedPostViewModel[];
  estimatedHeight: number;
};

// 将任意列数约束到瀑布流允许的 2-5 列范围内。
function clampMasonryColumnCount(columnCount: number): number {
  if (!Number.isFinite(columnCount)) {
    return MASONRY_MIN_COLUMN_COUNT;
  }

  return Math.min(
    Math.max(Math.trunc(columnCount), MASONRY_MIN_COLUMN_COUNT),
    MASONRY_MAX_COLUMN_COUNT,
  );
}

// 根据容器真实宽度推导当前应该使用的列数。
function getMasonryColumnCount(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return MASONRY_MIN_COLUMN_COUNT;
  }

  const rawColumnCount = Math.floor(
    (containerWidth + MASONRY_COLUMN_GAP) / (MASONRY_MIN_COLUMN_WIDTH + MASONRY_COLUMN_GAP),
  );

  return clampMasonryColumnCount(rawColumnCount);
}

// 根据容器宽度、列数和列间距计算每一列的实际可用宽度。
function getMasonryColumnWidth(containerWidth: number, columnCount: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return DEFAULT_MASONRY_COLUMN_WIDTH;
  }

  const normalizedColumnCount = clampMasonryColumnCount(columnCount);
  const totalGapWidth = MASONRY_COLUMN_GAP * (normalizedColumnCount - 1);

  return Math.max(1, (containerWidth - totalGapWidth) / normalizedColumnCount);
}

// 归一化 ResizeObserver 或 DOM 测量得到的宽度，避免亚像素抖动反复触发重排。
function normalizeMeasuredWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) {
    return 0;
  }

  return Math.round(width);
}

// 将图片比例桶转换为 CSS aspect-ratio 和高度估算可使用的数值比例。
function getAspectRatioValue(bucket: PostAspectRatioBucket): number {
  return ASPECT_RATIO_VALUES[bucket];
}

// 根据 caption 长度和列宽估算两行截断后的文案高度。
function estimateCaptionHeight(caption: string, columnWidth: number): number {
  const normalizedCaption = caption.trim();

  if (normalizedCaption.length === 0) {
    return 0;
  }

  const contentWidth = Math.max(columnWidth - MASONRY_CARD_HORIZONTAL_PADDING * 2, 1);
  const estimatedCharsPerLine = Math.max(
    MASONRY_MIN_CHARS_PER_LINE,
    Math.floor(contentWidth / MASONRY_ESTIMATED_CHAR_WIDTH),
  );
  const estimatedLineCount = Math.min(
    Math.ceil(normalizedCaption.length / estimatedCharsPerLine),
    MASONRY_CAPTION_MAX_LINES,
  );

  return estimatedLineCount * MASONRY_CAPTION_LINE_HEIGHT;
}

// 估算单张首页卡片的整体高度，用于决定它应该进入当前最短列。
function estimateMasonryCardHeight(
  item: HomeFeedPostViewModel,
  columnWidth: number,
): number {
  const aspectRatio = getAspectRatioValue(item.aspectRatioBucket);
  const imageHeight = columnWidth / aspectRatio;
  const captionHeight = estimateCaptionHeight(item.caption, columnWidth);
  const contentHeight = captionHeight > 0 ? captionHeight + MASONRY_CARD_CONTENT_GAP : 0;

  return (
    imageHeight +
    MASONRY_CARD_META_HEIGHT +
    contentHeight +
    MASONRY_CARD_VERTICAL_PADDING * 2
  );
}

// 创建固定数量的空列，后续分配算法会逐个填充 items 和累计估算高度。
function createEmptyColumns(columnCount: number): MasonryColumn[] {
  return Array.from({ length: Math.max(1, Math.trunc(columnCount)) }, () => ({
    items: [],
    estimatedHeight: 0,
  }));
}

// 从当前列集合中找出累计估算高度最小的列。
function getShortestColumnIndex(columns: MasonryColumn[]): number {
  let shortestColumnIndex = 0;
  let shortestColumnHeight = columns[0]?.estimatedHeight ?? 0;

  for (let index = 1; index < columns.length; index += 1) {
    if (columns[index].estimatedHeight < shortestColumnHeight) {
      shortestColumnHeight = columns[index].estimatedHeight;
      shortestColumnIndex = index;
    }
  }

  return shortestColumnIndex;
}

// 按“估算高度进入最短列”的策略，将首页帖子分配到各个瀑布流列中。
function distributeItemsToColumns(
  items: HomeFeedPostViewModel[],
  columnCount: number,
  columnWidth: number,
): MasonryColumn[] {
  const normalizedColumnWidth = Math.max(1, columnWidth);
  const columns = createEmptyColumns(columnCount);

  for (const item of items) {
    const targetColumnIndex = getShortestColumnIndex(columns);
    const targetColumn = columns[targetColumnIndex];
    const estimatedCardHeight = estimateMasonryCardHeight(item, normalizedColumnWidth);

    targetColumn.items.push(item);
    targetColumn.estimatedHeight += estimatedCardHeight + MASONRY_COLUMN_GAP;
  }

  return columns;
}

export default function MasonryFeed({ items }: MasonryFeedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const resolvedContainerWidth = containerWidth || MASONRY_FALLBACK_CONTAINER_WIDTH;
  const columnCount = getMasonryColumnCount(resolvedContainerWidth);

  // 当帖子集合、列数或容器宽度变化时，重新计算列宽和每列分配结果。
  const layout = useMemo(() => {
    const columnWidth = getMasonryColumnWidth(resolvedContainerWidth, columnCount);
    const columns = distributeItemsToColumns(items, columnCount, columnWidth);

    return {
      columnWidth,
      columns,
    };
  }, [items, columnCount, resolvedContainerWidth]);

  // 监听瀑布流自身容器宽度，驱动响应式列数和分列结果重排。
  useEffect(() => {
    const node = containerRef.current;

    if (!node) {
      return;
    }

    function updateContainerWidth(width: number) {
      setContainerWidth(normalizeMeasuredWidth(width));
    }

    updateContainerWidth(node.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      updateContainerWidth(entry.contentRect.width);
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="grid w-full"
      style={{
        gridTemplateColumns: `repeat(${layout.columns.length}, minmax(0, 1fr))`,
        gap: MASONRY_COLUMN_GAP,
      }}
      data-feed-count={items.length}
      data-column-count={layout.columns.length}
      data-column-width={Math.round(layout.columnWidth)}
      data-container-width={resolvedContainerWidth}
    >
      {layout.columns.map((column, columnIndex) => (
        <div
          key={columnIndex}
          className="flex min-w-0 flex-col"
          style={{ gap: MASONRY_COLUMN_GAP }}
          data-column-index={columnIndex}
          data-column-height={Math.round(column.estimatedHeight)}
        >
          {column.items.map((item) => (
            <MasonryPostCard key={item.id} post={item} />
          ))}
        </div>
      ))}
    </div>
  );
}
