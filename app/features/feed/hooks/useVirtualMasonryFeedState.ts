import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useWindowVirtualizer,
  type VirtualItem,
  type Virtualizer,
} from '@tanstack/react-virtual';
import {
  estimateMasonryCardHeight,
  getMasonryColumnCount,
  getMasonryColumnWidth,
  MASONRY_FALLBACK_CONTAINER_WIDTH,
  MASONRY_LAYOUT,
  normalizeMeasuredWidth,
} from '../lib/masonry-layout';
import type { PostAspectRatioBucket } from '~/features/post/types/post.type';

const DEFAULT_VIRTUAL_MASONRY_OVERSCAN = 6;
const DEFAULT_VIRTUAL_MASONRY_PRELOAD_THRESHOLD = 6;

export type VirtualMasonryFeedItem = {
  id: string;
  caption: string;
  aspectRatioBucket: PostAspectRatioBucket;
};

type UseVirtualMasonryFeedStateOptions<TItem extends VirtualMasonryFeedItem> = {
  items: TItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  onLoadMore: () => Promise<unknown>;
  overscan?: number;
  preloadThreshold?: number;
};

export type VirtualMasonryFeedState<TItem extends VirtualMasonryFeedItem> = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  virtualizer: Virtualizer<Window, Element>;
  virtualItems: VirtualItem[];
  items: TItem[];
  columnCount: number;
  columnWidth: number;
  resolvedContainerWidth: number;
  scrollMargin: number;
  gap: number;
};

function shouldAdjustVirtualMasonryScrollPosition(
  item: VirtualItem,
  _delta: number,
  instance: Virtualizer<Window, Element>,
): boolean {
  const currentScrollOffset = instance.scrollOffset ?? 0;

  return item.start < currentScrollOffset + instance.options.scrollMargin;
}

export function useVirtualMasonryFeedState<TItem extends VirtualMasonryFeedItem>({
  items,
  hasNextPage,
  isFetchingNextPage,
  isLoadMoreError,
  onLoadMore,
  overscan = DEFAULT_VIRTUAL_MASONRY_OVERSCAN,
  preloadThreshold = DEFAULT_VIRTUAL_MASONRY_PRELOAD_THRESHOLD,
}: UseVirtualMasonryFeedStateOptions<TItem>): VirtualMasonryFeedState<TItem> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastAutoLoadTriggerCountRef = useRef<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);
  const resolvedContainerWidth = containerWidth || MASONRY_FALLBACK_CONTAINER_WIDTH;
  const columnCount = useMemo(
    () => getMasonryColumnCount(resolvedContainerWidth),
    [resolvedContainerWidth],
  );
  const columnWidth = useMemo(
    () => getMasonryColumnWidth(resolvedContainerWidth, columnCount),
    [resolvedContainerWidth, columnCount],
  );

  const estimateSize = useCallback(
    (index: number) => estimateMasonryCardHeight(items[index], columnWidth),
    [items, columnWidth],
  );
  const getItemKey = useCallback(
    (index: number) => items[index]?.id ?? `virtual-masonry-${index}`,
    [items],
  );

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize,
    overscan,
    lanes: columnCount,
    gap: MASONRY_LAYOUT.columnGap,
    scrollMargin,
    getItemKey,
    laneAssignmentMode: 'estimate',
    useFlushSync: false,
    onChange: (instance) => {
      if (!hasNextPage || isFetchingNextPage || isLoadMoreError || items.length === 0) {
        return;
      }

      const virtualItems = instance.getVirtualItems();
      const lastVirtualItem = virtualItems[virtualItems.length - 1];

      if (!lastVirtualItem) {
        return;
      }

      const preloadStartIndex = Math.max(0, items.length - preloadThreshold);

      if (lastVirtualItem.index < preloadStartIndex) {
        return;
      }

      if (lastAutoLoadTriggerCountRef.current === items.length) {
        return;
      }

      lastAutoLoadTriggerCountRef.current = items.length;
      void onLoadMore();
    },
  });
  const virtualItems = virtualizer.getVirtualItems();

  virtualizer.shouldAdjustScrollPositionOnItemSizeChange =
    shouldAdjustVirtualMasonryScrollPosition;

  useEffect(() => {
    const node = containerRef.current;

    if (!node) {
      return;
    }

    const currentNode = node;

    function updateMeasurements() {
      const nextContainerWidth = normalizeMeasuredWidth(
        currentNode.getBoundingClientRect().width,
      );
      const nextScrollMargin = Math.max(
        0,
        Math.round(currentNode.getBoundingClientRect().top + window.scrollY),
      );

      setContainerWidth(nextContainerWidth);
      setScrollMargin(nextScrollMargin);
    }

    updateMeasurements();

    const handleWindowResize = () => {
      updateMeasurements();
    };

    window.addEventListener('resize', handleWindowResize);

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', handleWindowResize);
      };
    }

    const observer = new ResizeObserver(() => {
      updateMeasurements();
    });

    observer.observe(currentNode);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  return {
    containerRef,
    virtualizer,
    virtualItems,
    items,
    columnCount,
    columnWidth,
    resolvedContainerWidth,
    scrollMargin,
    gap: MASONRY_LAYOUT.columnGap,
  };
}
