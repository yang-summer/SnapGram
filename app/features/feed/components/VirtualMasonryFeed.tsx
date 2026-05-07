import type { ReactNode } from 'react';
import type { VirtualMasonryFeedItem, VirtualMasonryFeedState } from '../hooks/useVirtualMasonryFeedState';

type VirtualMasonryFeedProps<TItem extends VirtualMasonryFeedItem> = {
  state: VirtualMasonryFeedState<TItem>;
  renderItem: (item: TItem) => ReactNode;
};

export function VirtualMasonryFeed<TItem extends VirtualMasonryFeedItem>({
  state,
  renderItem,
}: VirtualMasonryFeedProps<TItem>) {
  return (
    <div
      ref={state.containerRef}
      className="relative w-full"
      style={{ height: state.virtualizer.getTotalSize() }}
      data-feed-count={state.items.length}
      data-column-count={state.columnCount}
      data-column-width={Math.round(state.columnWidth)}
      data-container-width={state.resolvedContainerWidth}
      data-scroll-margin={state.scrollMargin}
    >
      {state.virtualItems.map((virtualItem) => {
        const item = state.items[virtualItem.index];

        if (!item) {
          return null;
        }

        return (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={state.virtualizer.measureElement}
            className="absolute top-0 left-0"
            style={{
              width: state.columnWidth,
              transform: `translate(${virtualItem.lane * (state.columnWidth + state.gap)}px, ${virtualItem.start - state.scrollMargin}px)`,
            }}
          >
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
}
