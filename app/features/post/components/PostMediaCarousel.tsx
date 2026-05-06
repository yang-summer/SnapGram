import { ChevronLeftIcon, ChevronRightIcon, ImageOffIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  DEFAULT_POST_ASPECT_RATIO_BUCKET,
  type PostAspectRatioBucket,
  type PostMediaViewModel,
} from '../types/post.type';

const ASPECT_RATIO_VALUES: Record<PostAspectRatioBucket, number> = {
  '1:1': 1,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
};

type PostMediaCarouselProps = {
  media: PostMediaViewModel[];
  altBase: string;
  className?: string;
};

// 把目标索引限制在合法范围内，避免按钮和键盘切换时越界。
function clampIndex(index: number, maxIndex: number): number {
  if (maxIndex < 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), maxIndex);
}

// 根据比例桶返回稳定视口的实际比例值，供轮播容器固定高度使用。
function getAspectRatioValue(bucket: PostAspectRatioBucket): number {
  return ASPECT_RATIO_VALUES[bucket] ?? ASPECT_RATIO_VALUES[DEFAULT_POST_ASPECT_RATIO_BUCKET];
}

// 为每张图片生成可读的 alt 文本，同时补充当前位置。
function createMediaAlt(altBase: string, index: number, count: number): string {
  const normalizedAltBase = altBase.trim();

  if (normalizedAltBase.length === 0) {
    return `Post media ${index + 1} of ${count}`;
  }

  return `${normalizedAltBase} (${index + 1} of ${count})`;
}

// 根据当前滚动位置，找到最接近视口左边界的 slide，作为滚动结束后的当前页。
function resolveSettledIndex(
  viewport: HTMLDivElement,
  slides: Array<HTMLDivElement | null>,
  maxIndex: number,
): number {
  let nextIndex = 0;
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];

    if (!slide) {
      continue;
    }

    const distance = Math.abs(slide.offsetLeft - viewport.scrollLeft);

    if (distance < shortestDistance) {
      shortestDistance = distance;
      nextIndex = index;
    }
  }

  return clampIndex(nextIndex, maxIndex);
}

export default function PostMediaCarousel({ media, altBase, className }: PostMediaCarouselProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedMediaIds, setFailedMediaIds] = useState<Set<string>>(() => new Set());
  const mediaIdsKey = useMemo(() => media.map((item) => item.id).join('|'), [media]);
  const viewportAspectRatio = getAspectRatioValue(
    media[0]?.aspectRatioBucket ?? DEFAULT_POST_ASPECT_RATIO_BUCKET,
  );
  const showControls = media.length > 1;
  const maxIndex = media.length - 1;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < maxIndex;

  useEffect(() => {
    // 当媒体列表变化时，重置轮播内部状态并回到第一页，
    // 避免切换到另一条帖子后仍停留在旧的滚动位置或错误状态。
    slideRefs.current = slideRefs.current.slice(0, media.length);
    setCurrentIndex(0);
    setFailedMediaIds(new Set());

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollTo({ left: 0, behavior: 'auto' });
  }, [media.length, mediaIdsKey]);

  useEffect(() => {
    // 只在滚动稳定后更新 currentIndex：
    // 优先监听 scrollend；若环境不支持，则退化为基于 scroll 的 debounce。
    if (media.length <= 1) {
      return;
    }

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const viewportNode = viewport;
    const supportsScrollEnd = 'onscrollend' in viewportNode;
    let fallbackTimerId = 0;
    const scrollEndTarget = viewportNode as EventTarget;

    function updateIndexFromSettledPosition() {
      const nextIndex = resolveSettledIndex(viewportNode, slideRefs.current, maxIndex);
      setCurrentIndex((previousIndex) => (previousIndex === nextIndex ? previousIndex : nextIndex));
    }

    function handleScrollEnd() {
      updateIndexFromSettledPosition();
    }

    function handleScroll() {
      if (fallbackTimerId !== 0) {
        window.clearTimeout(fallbackTimerId);
      }

      fallbackTimerId = window.setTimeout(() => {
        fallbackTimerId = 0;
        updateIndexFromSettledPosition();
      }, 120);
    }

    function attachFallbackScrollListener() {
      viewportNode.addEventListener('scroll', handleScroll, { passive: true });
    }

    function detachFallbackScrollListener() {
      viewportNode.removeEventListener('scroll', handleScroll);
    }

    if (supportsScrollEnd) {
      scrollEndTarget.addEventListener('scrollend', handleScrollEnd as EventListener);
    } else {
      attachFallbackScrollListener();
    }

    updateIndexFromSettledPosition();

    return () => {
      if (supportsScrollEnd) {
        scrollEndTarget.removeEventListener('scrollend', handleScrollEnd as EventListener);
      } else {
        detachFallbackScrollListener();
      }

      if (fallbackTimerId !== 0) {
        window.clearTimeout(fallbackTimerId);
      }
    };
  }, [maxIndex, media.length, mediaIdsKey]);

  // 把每个 slide 的 DOM 节点按索引存起来，供按钮和 dots 精确滚动到目标位置。
  function setSlideRef(index: number) {
    return (node: HTMLDivElement | null) => {
      slideRefs.current[index] = node;
    };
  }

  // 记录单张媒体的加载失败状态，只降级当前 slide，不影响整个详情页。
  function handleMediaError(mediaId: string) {
    setFailedMediaIds((currentFailedMediaIds) => {
      if (currentFailedMediaIds.has(mediaId)) {
        return currentFailedMediaIds;
      }

      const nextFailedMediaIds = new Set(currentFailedMediaIds);
      nextFailedMediaIds.add(mediaId);
      return nextFailedMediaIds;
    });
  }

  // 根据目标索引滚动到对应 slide；当前页状态交给 scrollend/fallback 在滚动结束后更新。
  function goToIndex(index: number) {
    const nextIndex = clampIndex(index, maxIndex);
    const viewport = viewportRef.current;
    const slide = slideRefs.current[nextIndex];

    if (!viewport || !slide) {
      return;
    }

    viewport.scrollTo({
      left: slide.offsetLeft,
      behavior: 'smooth',
    });
  }

  // 支持键盘左右方向键切换，补齐轮播基础可访问性。
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!showControls) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToIndex(currentIndex - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToIndex(currentIndex + 1);
    }
  }

  if (media.length === 0) {
    return (
      <section
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-[24px] bg-surface-soft',
          className,
        )}
        style={{ aspectRatio: getAspectRatioValue(DEFAULT_POST_ASPECT_RATIO_BUCKET) }}
        role="region"
        aria-label="Post media"
      >
        <div className="flex flex-col items-center gap-3 px-6 text-center text-sm text-muted-foreground">
          <div className="rounded-full bg-background/80 p-3 shadow-sm">
            <ImageOffIcon aria-hidden="true" />
          </div>
          <p>Media is unavailable for this post.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn('relative overflow-hidden rounded-[24px] bg-surface-soft', className)}
      style={{ aspectRatio: viewportAspectRatio }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Post media"
      tabIndex={showControls ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={viewportRef}
        className="size-full overflow-x-auto scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex size-full">
          {media.map((item, index) => {
            const hasFailed = failedMediaIds.has(item.id);

            return (
              <article
                key={item.id}
                ref={setSlideRef(index)}
                data-index={index}
                className="relative min-w-full snap-start"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${media.length}`}
              >
                <div className="relative flex size-full items-center justify-center overflow-hidden bg-surface-soft">
                  {item.placeholder ? (
                    <img
                      src={item.placeholder}
                      alt=""
                      aria-hidden="true"
                      className={cn(
                        'absolute inset-0 size-full object-cover blur-xl transition-opacity duration-300',
                        hasFailed ? 'opacity-0' : 'opacity-100',
                      )}
                    />
                  ) : null}

                  {hasFailed ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-linear-to-br from-surface-soft to-background/70 px-6 text-center text-sm text-muted-foreground">
                      <div className="rounded-full bg-background/80 p-3 shadow-sm">
                        <ImageOffIcon aria-hidden="true" />
                      </div>
                      <p>Failed to load this image.</p>
                    </div>
                  ) : (
                    <img
                      src={item.imageUrl}
                      alt={createMediaAlt(altBase, index, media.length)}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      onError={() => handleMediaError(item.id)}
                      className="relative size-full object-contain"
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {showControls ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full shadow-sm"
            onClick={() => goToIndex(currentIndex - 1)}
            disabled={!canGoPrev}
            aria-label="Previous image"
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full shadow-sm"
            onClick={() => goToIndex(currentIndex + 1)}
            disabled={!canGoNext}
            aria-label="Next image"
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>

          <div className="absolute right-3 top-3 rounded-full bg-background/85 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
            {currentIndex + 1} / {media.length}
          </div>

          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 px-4">
            {media.map((item, index) => {
              const isActive = currentIndex === index;

              return (
                <button
                  key={`${item.id}-dot`}
                  type="button"
                  onClick={() => goToIndex(index)}
                  aria-label={`Go to image ${index + 1}`}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'size-2.5 rounded-full border border-background/70 transition-[transform,background-color,opacity]',
                    isActive
                      ? 'scale-110 bg-background opacity-100'
                      : 'bg-background/45 opacity-80',
                  )}
                />
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
