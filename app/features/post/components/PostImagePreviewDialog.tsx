import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  Maximize2Icon,
  MinusIcon,
  PlusIcon,
  RotateCwIcon,
  ScanIcon,
  XIcon,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';
import type { PostMediaViewModel } from '../types/post.type';

const DRAG_CLOSE_THRESHOLD_PX = 6;
const MIN_SCALE = 0.05;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.25;
const FIT_HORIZONTAL_INSET_PX = 32;
const FIT_TOP_INSET_PX = 24;
const FIT_BOTTOM_INSET_PX = 80;

type ImagePreviewMode = 'fit' | 'original' | 'custom';

type Size = {
  width: number;
  height: number;
};

type Offset = {
  x: number;
  y: number;
};

type FitArea = {
  size: Size;
  centerOffset: Offset;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  baseOffsetX: number;
  baseOffsetY: number;
  hasDragged: boolean;
};

type PostImagePreviewDialogProps = {
  open: boolean;
  media: PostMediaViewModel[];
  initialIndex: number;
  postId: string;
  creatorName: string;
  altBase: string;
  onOpenChange: (open: boolean) => void;
};

type ToolbarTooltipProps = {
  label: string;
  children: ReactNode;
};

// 将数值限制在给定区间内，避免索引、缩放等值越界。
function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// 将图片索引限制在媒体数组范围内，保证切图和初始索引都安全。
function clampIndex(index: number, maxIndex: number): number {
  if (maxIndex < 0) {
    return 0;
  }

  return clampNumber(index, 0, maxIndex);
}

// 将旋转角度归一化到 0 到 359 度，便于判断当前方向。
function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

// 判断当前旋转是否会交换图片的显示宽高。
function isQuarterTurn(rotation: number): boolean {
  const normalizedRotation = normalizeRotation(rotation);
  return normalizedRotation === 90 || normalizedRotation === 270;
}

// 根据图片原始尺寸、安全区域尺寸和旋转角度计算适应页面的缩放比例。
function resolveFitScale(naturalSize: Size | null, stageSize: Size, rotation: number): number {
  if (!naturalSize || stageSize.width <= 0 || stageSize.height <= 0) {
    return 1;
  }

  const renderedWidth = isQuarterTurn(rotation) ? naturalSize.height : naturalSize.width;
  const renderedHeight = isQuarterTurn(rotation) ? naturalSize.width : naturalSize.height;

  if (renderedWidth <= 0 || renderedHeight <= 0) {
    return 1;
  }

  return clampNumber(
    Math.min(stageSize.width / renderedWidth, stageSize.height / renderedHeight),
    MIN_SCALE,
    MAX_SCALE,
  );
}

// 根据预览舞台尺寸计算 fit 模式的安全显示区域和中心点偏移。
function resolveFitArea(stageSize: Size): FitArea {
  if (stageSize.width <= 0 || stageSize.height <= 0) {
    return {
      size: { width: 0, height: 0 },
      centerOffset: { x: 0, y: 0 },
    };
  }

  const requestedVerticalInset = FIT_TOP_INSET_PX + FIT_BOTTOM_INSET_PX;
  const verticalInsetScale =
    requestedVerticalInset >= stageSize.height && requestedVerticalInset > 0
      ? Math.max(stageSize.height - 1, 0) / requestedVerticalInset
      : 1;
  const topInset = FIT_TOP_INSET_PX * verticalInsetScale;
  const bottomInset = FIT_BOTTOM_INSET_PX * verticalInsetScale;
  const horizontalInset = Math.min(FIT_HORIZONTAL_INSET_PX, Math.max((stageSize.width - 1) / 2, 0));

  return {
    size: {
      width: Math.max(stageSize.width - horizontalInset * 2, 1),
      height: Math.max(stageSize.height - topInset - bottomInset, 1),
    },
    centerOffset: {
      x: 0,
      y: (topInset - bottomInset) / 2,
    },
  };
}

// 优先使用媒体元数据尺寸，缺失时回退到图片加载后记录的 natural size。
function getMediaNaturalSize(
  media: PostMediaViewModel | null,
  fallbackSizes: Record<string, Size>,
): Size | null {
  if (!media) {
    return null;
  }

  if (
    typeof media.width === 'number' &&
    media.width > 0 &&
    typeof media.height === 'number' &&
    media.height > 0
  ) {
    return {
      width: media.width,
      height: media.height,
    };
  }

  return fallbackSizes[media.id] ?? null;
}

// 生成包含图片序号的可访问 alt 文本。
function createMediaAlt(altBase: string, index: number, count: number): string {
  const normalizedAltBase = altBase.trim();

  if (normalizedAltBase.length === 0) {
    return `Post image ${index + 1} of ${count}`;
  }

  return `${normalizedAltBase} (${index + 1} of ${count})`;
}

// 将帖子 ID 或作者名转换为适合放进下载文件名的安全片段。
function sanitizeDownloadFileNamePart(value: string, fallback: string): string {
  const sanitizedValue = value
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return sanitizedValue.length > 0 ? sanitizedValue : fallback;
}

// 从图片 URL 中提取常见图片扩展名，无法识别时使用 jpg。
function getImageExtension(imageUrl: string): string {
  try {
    const pathname = new URL(imageUrl, 'https://snapgram.local').pathname;
    const extension = pathname.split('.').pop()?.toLowerCase();

    if (extension && ['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp'].includes(extension)) {
      return extension === 'jpeg' ? 'jpg' : extension;
    }
  } catch {
    // Fall back to the default extension below.
  }

  return 'jpg';
}

// 按帖子 ID、图片序号和作者名生成当前图片的下载文件名。
function createPostImageDownloadFileName(
  postId: string,
  imageIndex: number,
  creatorName: string,
  imageUrl: string,
): string {
  const safePostId = sanitizeDownloadFileNamePart(postId, 'post');
  const safeCreatorName = sanitizeDownloadFileNamePart(creatorName, 'creator');
  const extension = getImageExtension(imageUrl);

  return `snapgram-post-${safePostId}-image-${imageIndex + 1}-${safeCreatorName}.${extension}`;
}

// 将当前实际缩放比例格式化为相对原始像素尺寸的百分比文本。
function getScalePercentLabel(scale: number, naturalSize: Size | null): string {
  if (!naturalSize) {
    return '--%';
  }

  return `${Math.round(scale * 100)}%`;
}

// 在浏览器环境中读取当前视口尺寸，作为全屏预览 fit 安全区域的基础尺寸。
function getViewportSize(): Size {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }

  const visualViewport = window.visualViewport;

  if (visualViewport && visualViewport.width > 0 && visualViewport.height > 0) {
    return {
      width: visualViewport.width,
      height: visualViewport.height,
    };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

// 为工具栏按钮提供统一的上方悬浮提示。
function ToolbarTooltip({ label, children }: ToolbarTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="z-[100]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export default function PostImagePreviewDialog({
  open,
  media,
  initialIndex,
  postId,
  creatorName,
  altBase,
  onOpenChange,
}: PostImagePreviewDialogProps) {
  // 保存当前拖动过程中的临时数据，避免 pointermove 高频触发 React 重渲染。
  const dragStateRef = useRef<DragState | null>(null);
  // 当前媒体列表的最大合法索引。
  const maxIndex = media.length - 1;
  // 用媒体 ID 生成稳定 key，用于媒体列表变化时重置当前图片。
  const mediaIdsKey = useMemo(() => media.map((item) => item.id).join('|'), [media]);
  // 当前预览图片索引。
  const [currentIndex, setCurrentIndex] = useState(() => clampIndex(initialIndex, maxIndex));
  // 记录缺少元数据尺寸的图片在加载后得到的 natural size。
  const [fallbackSizes, setFallbackSizes] = useState<Record<string, Size>>({});
  // 当前预览视口尺寸，供 fit 安全区域计算使用。
  const [stageSize, setStageSize] = useState<Size>(() => getViewportSize());
  // 当前查看模式：fit 为安全适应，original 为原始尺寸，custom 为自由缩放或拖动。
  const [mode, setMode] = useState<ImagePreviewMode>('fit');
  // original/custom 模式下使用的缩放比例；fit 模式使用派生的 fitScale。
  const [scale, setScale] = useState(1);
  // 当前图片旋转角度。
  const [rotation, setRotation] = useState(0);
  // custom/original 模式下的图片拖动偏移。
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  // 当前索引对应的媒体项。
  const currentMedia = media[currentIndex] ?? null;
  // 当前图片的原始像素尺寸。
  const naturalSize = getMediaNaturalSize(currentMedia, fallbackSizes);
  // fit 模式使用的安全显示区域和中心偏移。
  const fitArea = resolveFitArea(stageSize);
  // fit 模式下让图片完整进入安全区域的缩放比例。
  const fitScale = resolveFitScale(naturalSize, fitArea.size, rotation);
  // fit 模式下将图片中心移动到安全区域中心，其他模式不使用该偏移。
  const activeCenterOffset = mode === 'fit' ? fitArea.centerOffset : { x: 0, y: 0 };
  // 当前真正应用到图片 transform 上的缩放比例。
  const appliedScale = mode === 'fit' ? fitScale : scale;
  // 是否可以切换到上一张图片。
  const canGoPrev = currentIndex > 0;
  // 是否可以切换到下一张图片。
  const canGoNext = currentIndex < maxIndex;
  // 当前帖子是否有多张可切换图片。
  const hasMultipleMedia = media.length > 1;
  // 工具栏中显示的当前缩放百分比。
  const scalePercentLabel = getScalePercentLabel(appliedScale, naturalSize);
  // 当前图片下载时使用的文件名。
  const downloadFileName = currentMedia
    ? createPostImageDownloadFileName(postId, currentIndex, creatorName, currentMedia.imageUrl)
    : '';
  // 当前图片的 alt 文本。
  const previewAlt = currentMedia ? createMediaAlt(altBase, currentIndex, media.length) : '';

  // 当预览打开或初始索引变化时，同步当前图片索引。
  useEffect(() => {
    if (!open) {
      return;
    }

    setCurrentIndex(clampIndex(initialIndex, maxIndex));
  }, [initialIndex, maxIndex, mediaIdsKey, open]);

  // 当打开预览或切换图片时，重置查看状态到 fit 模式。
  useEffect(() => {
    if (!open) {
      dragStateRef.current = null;
      return;
    }

    setMode('fit');
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setScale(1);
  }, [currentMedia?.id, open]);

  // fit 模式下，当安全区域或缩放比例变化时，清空手动偏移并重新居中。
  useEffect(() => {
    if (!open || mode !== 'fit') {
      return;
    }

    setOffset({ x: 0, y: 0 });
  }, [fitScale, mode, open]);

  // 预览打开时监听视口尺寸变化，保证窗口变化后 fitScale 会重新计算。
  useEffect(() => {
    if (!open) {
      return;
    }

    function updateStageSize() {
      const nextStageSize = getViewportSize();

      setStageSize((currentStageSize) => {
        if (
          currentStageSize.width === nextStageSize.width &&
          currentStageSize.height === nextStageSize.height
        ) {
          return currentStageSize;
        }

        return nextStageSize;
      });
    }

    updateStageSize();

    // 监听桌面浏览器窗口尺寸变化，覆盖 layout viewport resize。
    window.addEventListener('resize', updateStageSize);
    // 监听移动端可视视口变化，覆盖地址栏、软键盘等 visual viewport resize。
    window.visualViewport?.addEventListener('resize', updateStageSize);

    return () => {
      window.removeEventListener('resize', updateStageSize);
      window.visualViewport?.removeEventListener('resize', updateStageSize);
    };
  }, [open]);

  // 关闭预览并把关闭事件交给外层受控状态。
  function closePreview() {
    onOpenChange(false);
  }

  // 切换到指定查看模式，并重置拖动状态和图片偏移。
  function resetView(nextMode: ImagePreviewMode, nextScale: number) {
    dragStateRef.current = null;
    setMode(nextMode);
    setOffset({ x: 0, y: 0 });
    setScale(nextScale);
  }

  // 切换到目标图片索引，并确保索引不会越界。
  function goToIndex(index: number) {
    setCurrentIndex(clampIndex(index, maxIndex));
  }

  // 按倍率缩放图片；如果当前是 fit 模式，先固化当前位置再进入 custom 模式。
  function handleZoom(multiplier: number) {
    if (mode === 'fit') {
      setOffset({
        x: offset.x + fitArea.centerOffset.x,
        y: offset.y + fitArea.centerOffset.y,
      });
    }

    setMode('custom');
    setScale(clampNumber(appliedScale * multiplier, MIN_SCALE, MAX_SCALE));
  }

  // 在原始尺寸和适应页面两个预设模式之间切换。
  function handleToggleFitOriginal() {
    if (mode === 'original') {
      resetView('fit', fitScale);
      return;
    }

    resetView('original', 1);
  }

  // 将图片顺时针旋转 90 度。
  function handleRotate() {
    setRotation((currentRotation) => normalizeRotation(currentRotation + 90));
  }

  // 图片加载完成后记录 natural size，补齐缺少尺寸元数据的旧图片。
  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    if (!currentMedia) {
      return;
    }

    const image = event.currentTarget;

    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return;
    }

    setFallbackSizes((currentFallbackSizes) => {
      const currentSize = currentFallbackSizes[currentMedia.id];

      if (currentSize?.width === image.naturalWidth && currentSize.height === image.naturalHeight) {
        return currentFallbackSizes;
      }

      return {
        ...currentFallbackSizes,
        [currentMedia.id]: {
          width: image.naturalWidth,
          height: image.naturalHeight,
        },
      };
    });
  }

  // 开始拖动图片，并在 fit 模式下先固化当前视觉位置和缩放比例。
  function handleImagePointerDown(event: ReactPointerEvent<HTMLImageElement>) {
    if (!currentMedia || event.button > 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const baseOffset =
      mode === 'fit'
        ? {
            x: offset.x + fitArea.centerOffset.x,
            y: offset.y + fitArea.centerOffset.y,
          }
        : offset;

    if (mode === 'fit') {
      setMode('custom');
      setOffset(baseOffset);
      setScale(appliedScale);
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseOffsetX: baseOffset.x,
      baseOffsetY: baseOffset.y,
      hasDragged: false,
    };
  }

  // 拖动图片时更新偏移，并根据移动距离判断这次交互是否已经是拖动。
  function handleImagePointerMove(event: ReactPointerEvent<HTMLImageElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const dragDistance = Math.hypot(deltaX, deltaY);

    if (dragDistance > DRAG_CLOSE_THRESHOLD_PX) {
      dragState.hasDragged = true;
    }

    setOffset({
      x: dragState.baseOffsetX + deltaX,
      y: dragState.baseOffsetY + deltaY,
    });
  }

  // 结束 pointer 交互；未发生拖动时按点击图片关闭预览处理。
  function handleImagePointerUp(event: ReactPointerEvent<HTMLImageElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;

    if (!dragState.hasDragged) {
      closePreview();
    }
  }

  // pointer 被浏览器取消时释放捕获并清空拖动状态。
  function handleImagePointerCancel(event: ReactPointerEvent<HTMLImageElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'fixed inset-0 left-0 top-0 z-[90] flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-transparent p-0 text-white ring-0 sm:max-w-none',
          'data-closed:zoom-out-100 data-open:zoom-in-100',
        )}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Image preview</DialogTitle>

        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute left-4 top-4 z-10 rounded-full bg-background/90 text-foreground shadow-lg backdrop-blur hover:bg-background"
          onClick={closePreview}
          aria-label="Close image preview"
        >
          <XIcon data-icon="inline-start" />
        </Button>

        <div className="relative min-h-0 flex-1 overflow-hidden touch-none" onClick={closePreview}>
          {currentMedia ? (
            <img
              src={currentMedia.imageUrl}
              alt={previewAlt}
              draggable={false}
              decoding="async"
              onClick={(event) => event.stopPropagation()}
              onLoad={handleImageLoad}
              onPointerDown={handleImagePointerDown}
              onPointerMove={handleImagePointerMove}
              onPointerUp={handleImagePointerUp}
              onPointerCancel={handleImagePointerCancel}
              className={cn(
                'absolute left-1/2 top-1/2 max-w-none select-none object-contain shadow-2xl',
                dragStateRef.current ? 'cursor-grabbing' : 'cursor-grab',
              )}
              style={{
                width: naturalSize ? `${naturalSize.width}px` : undefined,
                height: naturalSize ? `${naturalSize.height}px` : undefined,
                maxWidth: naturalSize ? undefined : 'calc(100dvw - 2rem)',
                maxHeight: naturalSize ? undefined : 'calc(100dvh - 12rem)',
                touchAction: 'none',
                transform: `translate(-50%, -50%) translate3d(${offset.x + activeCenterOffset.x}px, ${offset.y + activeCenterOffset.y}px, 0) rotate(${rotation}deg) scale(${appliedScale})`,
                transformOrigin: 'center',
              }}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-white/70">
              No image available.
            </div>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
          <TooltipProvider delayDuration={250}>
            <div
              className="flex max-w-[calc(100dvw-2rem)] items-center gap-1 overflow-x-auto rounded-md bg-background/95 p-1 text-foreground shadow-lg backdrop-blur"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <ToolbarTooltip label="Previous image">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  onClick={() => goToIndex(currentIndex - 1)}
                  disabled={!canGoPrev || !hasMultipleMedia}
                  aria-label="Previous image"
                >
                  <ChevronLeftIcon data-icon="inline-start" />
                </Button>
              </ToolbarTooltip>

              <div className="min-w-12 text-center text-xs font-medium tabular-nums">
                {media.length > 0 ? `${currentIndex + 1} / ${media.length}` : '0 / 0'}
              </div>

              <ToolbarTooltip label="Next image">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  onClick={() => goToIndex(currentIndex + 1)}
                  disabled={!canGoNext || !hasMultipleMedia}
                  aria-label="Next image"
                >
                  <ChevronRightIcon data-icon="inline-start" />
                </Button>
              </ToolbarTooltip>

              <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

              <ToolbarTooltip label="Zoom out">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  onClick={() => handleZoom(1 / ZOOM_STEP)}
                  disabled={!currentMedia || appliedScale <= MIN_SCALE}
                  aria-label="Zoom out"
                >
                  <MinusIcon data-icon="inline-start" />
                </Button>
              </ToolbarTooltip>

              <div className="min-w-12 text-center text-xs font-medium tabular-nums">
                {scalePercentLabel}
              </div>

              <ToolbarTooltip label="Zoom in">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  onClick={() => handleZoom(ZOOM_STEP)}
                  disabled={!currentMedia || appliedScale >= MAX_SCALE}
                  aria-label="Zoom in"
                >
                  <PlusIcon data-icon="inline-start" />
                </Button>
              </ToolbarTooltip>

              <ToolbarTooltip label={mode === 'original' ? 'Fit to page' : 'View original size'}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  onClick={handleToggleFitOriginal}
                  disabled={!currentMedia}
                  aria-label={mode === 'original' ? 'Fit to page' : 'View original size'}
                >
                  {mode === 'original' ? (
                    <ScanIcon data-icon="inline-start" />
                  ) : (
                    <Maximize2Icon data-icon="inline-start" />
                  )}
                </Button>
              </ToolbarTooltip>

              <ToolbarTooltip label="Rotate image">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  onClick={handleRotate}
                  disabled={!currentMedia}
                  aria-label="Rotate image"
                >
                  <RotateCwIcon data-icon="inline-start" />
                </Button>
              </ToolbarTooltip>

              <ToolbarTooltip label="Download image">
                <Button
                  asChild
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Download image"
                  className={cn(
                    'cursor-pointer',
                    !currentMedia && 'pointer-events-none opacity-50',
                  )}
                >
                  <a
                    href={currentMedia?.imageUrl ?? '#'}
                    download={downloadFileName}
                    onClick={(event) => {
                      if (!currentMedia) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <DownloadIcon data-icon="inline-start" />
                  </a>
                </Button>
              </ToolbarTooltip>
            </div>
          </TooltipProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}
