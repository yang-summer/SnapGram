import { useEffect, useRef, useState } from 'react';
import { cn } from '~/lib/utils';
import type { PostAspectRatioBucket } from '../types/post.type';

const ASPECT_RATIO_VALUES: Record<PostAspectRatioBucket, number> = {
  '1:1': 1,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
};

const IMAGE_OBSERVER_ROOT_MARGIN = '250px 0px';

type ProgressiveImageStatus = 'idle' | 'placeholder' | 'full' | 'error';

function hasDecodedImage(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
}

function waitForImageLoad(image: HTMLImageElement): Promise<void> {
  if (hasDecodedImage(image)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    function cleanup() {
      image.removeEventListener('load', handleLoad);
      image.removeEventListener('error', handleError);
    }

    function handleLoad() {
      cleanup();
      resolve();
    }

    function handleError() {
      cleanup();
      reject(new Error('Failed to load image resource.'));
    }

    image.addEventListener('load', handleLoad);
    image.addEventListener('error', handleError);
  });
}

async function preloadAndDecodeImage(src: string): Promise<void> {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;

  await waitForImageLoad(image);

  if (typeof image.decode === 'function') {
    try {
      await image.decode();
    } catch {
      if (!hasDecodedImage(image)) {
        throw new Error('Failed to decode image resource.');
      }
    }
  }
}

export type ProgressiveImageProps = {
  src: string;
  alt: string;
  aspectRatioBucket: PostAspectRatioBucket;
  placeholder: string | null;
  className?: string;
};

export default function ProgressiveImage({
  src,
  alt,
  aspectRatioBucket,
  placeholder,
  className,
}: ProgressiveImageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedPlaceholder =
    typeof placeholder === 'string' && placeholder.trim().length > 0 ? placeholder.trim() : null;
  const [status, setStatus] = useState<ProgressiveImageStatus>('idle');
  const [startedSource, setStartedSource] = useState<string | null>(null);
  const hasStartedLoading = startedSource === src;

  useEffect(() => {
    // 当图片源变化时，重置组件内部状态，
    // 确保同一个组件实例切换到新图片后会重新执行渐进加载流程。
    setStatus('idle');
    setStartedSource(null);
  }, [src]);

  useEffect(() => {
    // 监听图片容器是否接近视口。
    // 一旦接近视口，就启动后续加载流程，并把“何时开始加载”的判断和真正的加载逻辑分开。
    if (hasStartedLoading) {
      return;
    }

    const node = containerRef.current;

    if (!node) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setStartedSource(src);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting) {
          return;
        }

        setStartedSource(src);
        observer.disconnect();
      },
      {
        rootMargin: IMAGE_OBSERVER_ROOT_MARGIN,
        threshold: 0.01,
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [hasStartedLoading, src]);

  useEffect(() => {
    // 在加载流程被启动后，负责执行原图预加载和 decode，
    // 并根据结果把组件从 idle/placeholder 推进到 full 或 error。
    if (!hasStartedLoading) {
      return;
    }

    let isActive = true;
    setStatus(normalizedPlaceholder ? 'placeholder' : 'idle');

    async function loadFullImage() {
      try {
        await preloadAndDecodeImage(src);

        if (!isActive) {
          return;
        }

        setStatus('full');
      } catch {
        if (!isActive) {
          return;
        }

        setStatus('error');
      }
    }

    void loadFullImage();

    return () => {
      isActive = false;
    };
  }, [hasStartedLoading, normalizedPlaceholder, src]);

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full overflow-hidden rounded-[24px] bg-surface-soft', className)}
      style={{ aspectRatio: ASPECT_RATIO_VALUES[aspectRatioBucket] }}
      data-has-placeholder={normalizedPlaceholder ? 'true' : 'false'}
      data-status={status}
    >
      {/* 基础骨架层：先稳定占位，等原图真正就绪后再淡出。 */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-500',
          status === 'full' ? 'opacity-0' : 'opacity-100',
        )}
      >
        <div className="absolute inset-0 bg-surface-soft" />
        <div
          className={cn(
            'absolute inset-0 bg-linear-to-br from-surface-soft via-background/40 to-surface-soft transition-opacity duration-500',
            status === 'error' ? 'opacity-0' : 'animate-pulse',
            status === 'idle' ? 'opacity-100' : '',
            status === 'placeholder' ? 'opacity-35' : '',
            status === 'full' ? 'opacity-0' : '',
          )}
        />
      </div>

      {/* 占位图层：只有在 observer 启动加载后才显示，并在原图接管后退出。 */}
      {hasStartedLoading && normalizedPlaceholder ? (
        <img
          src={normalizedPlaceholder}
          alt=""
          aria-hidden="true"
          className={cn(
            'absolute inset-0 h-full w-full object-cover blur-sm transition-[opacity,filter,transform] duration-500',
            status === 'placeholder' ? 'scale-105 opacity-100' : 'scale-100 opacity-0',
          )}
        />
      ) : null}

      {/* 原图层：observer 触发后才开始挂载，只有 preload + decode 完成后才显示。 */}
      <img
        src={hasStartedLoading ? src : undefined}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setStatus('error')}
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
          status === 'full' ? 'opacity-100' : 'opacity-0',
        )}
      />

      {/* 错误覆盖层：原图加载或 decode 失败时，给出明确的降级结果，避免卡在中间态。 */}
      {status === 'error' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-surface-soft to-background/60"
        />
      ) : null}
    </div>
  );
}
