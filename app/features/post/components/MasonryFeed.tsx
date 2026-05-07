import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MASONRY_FALLBACK_CONTAINER_WIDTH,
  MASONRY_LAYOUT,
  estimateMasonryCardHeight,
  getMasonryColumnCount,
  getMasonryColumnWidth,
  normalizeMeasuredWidth,
} from '~/features/feed/lib/masonry-layout';
import MasonryPostCard from './MasonryPostCard';
import type { HomeFeedPostViewModel } from '../types/post.type';

export type MasonryFeedProps = {
  items: HomeFeedPostViewModel[];
};

type MasonryColumn = {
  items: HomeFeedPostViewModel[];
  estimatedHeight: number;
};

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
    targetColumn.estimatedHeight += estimatedCardHeight + MASONRY_LAYOUT.columnGap;
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
        gap: MASONRY_LAYOUT.columnGap,
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
          style={{ gap: MASONRY_LAYOUT.columnGap }}
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
