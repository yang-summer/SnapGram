import { DragDropProvider, type DragEndEvent } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { ImagePlusIcon, LoaderCircleIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import InlineErrorAlert from '~/components/feedback/inline-error-alert';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  DEFAULT_POST_ASPECT_RATIO_BUCKET,
  type LocalPostMediaEditorItem,
  type PostMediaEditorItem,
} from '../types/post.type';
import {
  POST_IMAGE_ACCEPTED_MIME_TYPES,
  isSupportedPostImageMimeType,
  preparePostImage,
} from '../lib/post-image-compression';

const POST_MEDIA_EDITOR_MAX_ITEMS = 6;

type PostMediaEditorProps = {
  items: PostMediaEditorItem[];
  error: string | null;
  onItemsChange: Dispatch<SetStateAction<PostMediaEditorItem[]>>;
  onErrorChange: Dispatch<SetStateAction<string | null>>;
};

type SortableMediaCardProps = {
  item: PostMediaEditorItem;
  index: number;
  retryDisabled: boolean;
  onRetryItem: (clientMediaId: string) => Promise<void>;
  onRemoveItem: (clientMediaId: string) => void;
};

function createClientMediaId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `post-media-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createProcessingItem(
  file: File,
  clientMediaId = createClientMediaId(),
): LocalPostMediaEditorItem {
  return {
    kind: 'local',
    clientMediaId,
    status: 'processing',
    file,
    previewUrl: null,
    width: null,
    height: null,
    aspectRatioBucket: DEFAULT_POST_ASPECT_RATIO_BUCKET,
    placeholder: null,
  };
}

function createReadyItem(
  clientMediaId: string,
  file: File,
  previewUrl: string,
  width: number,
  height: number,
  aspectRatioBucket: LocalPostMediaEditorItem['aspectRatioBucket'],
  placeholder: string | null,
): LocalPostMediaEditorItem {
  return {
    kind: 'local',
    clientMediaId,
    status: 'ready',
    file,
    previewUrl,
    width,
    height,
    aspectRatioBucket,
    placeholder,
  };
}

function createFailedItem(
  clientMediaId: string,
  file: File,
  errorCode: NonNullable<Extract<LocalPostMediaEditorItem, { status: 'failed' }>['errorCode']>,
  errorMessage: string,
): LocalPostMediaEditorItem {
  return {
    kind: 'local',
    clientMediaId,
    status: 'failed',
    file,
    previewUrl: null,
    width: null,
    height: null,
    aspectRatioBucket: DEFAULT_POST_ASPECT_RATIO_BUCKET,
    placeholder: null,
    errorCode,
    errorMessage,
  };
}

function isLocalProcessingItem(
  item: PostMediaEditorItem,
): item is Extract<LocalPostMediaEditorItem, { status: 'processing' }> {
  return item.kind === 'local' && item.status === 'processing';
}

function isLocalFailedItem(
  item: PostMediaEditorItem,
): item is Extract<LocalPostMediaEditorItem, { status: 'failed' }> {
  return item.kind === 'local' && item.status === 'failed';
}

function isReadyLocalItem(
  item: PostMediaEditorItem,
): item is Extract<LocalPostMediaEditorItem, { status: 'ready' }> {
  return item.kind === 'local' && item.status === 'ready';
}

function revokeItemPreviewUrl(item: PostMediaEditorItem): void {
  if (item.kind === 'local' && item.status === 'ready') {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const nextItems = items.slice();
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (!movedItem) {
    return items;
  }

  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function getMediaCardTitle(item: PostMediaEditorItem, index: number): string {
  if (item.kind === 'existing') {
    return `Current image ${index + 1}`;
  }

  return item.file.name;
}

function getMediaCardSummary(item: PostMediaEditorItem, index: number): string {
  const parts = [`#${index + 1}`];

  if (item.kind === 'existing') {
    parts.push('existing media');
  } else {
    parts.push(formatFileSize(item.file.size));
  }

  if (item.status === 'ready' && item.width && item.height) {
    parts.push(`${item.width} × ${item.height}`);
  }

  return parts.join(' • ');
}

function SortableMediaCard({
  item,
  index,
  retryDisabled,
  onRetryItem,
  onRemoveItem,
}: SortableMediaCardProps) {
  const sortableDisabled = isLocalProcessingItem(item);
  const { ref, isDragging, isDropTarget } = useSortable({
    id: item.clientMediaId,
    index,
    disabled: sortableDisabled,
  });

  return (
    <article
      ref={ref}
      tabIndex={sortableDisabled ? -1 : 0}
      aria-label={`${getMediaCardTitle(item, index)}, position ${index + 1}`}
      className={cn(
        'overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm transition-[box-shadow,opacity,transform]',
        sortableDisabled
          ? 'cursor-default'
          : 'cursor-grab select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        isDragging && 'cursor-grabbing opacity-80 shadow-lg ring-2 ring-primary/35',
        isDropTarget && !isDragging && 'ring-2 ring-primary/30 shadow-md',
      )}
    >
      <div
        className={cn(
          'relative aspect-square w-full overflow-hidden border-b border-border/60',
          item.status === 'processing' ? 'bg-muted/40' : 'bg-muted/20',
        )}
      >
        {item.status === 'ready' ? (
          <img
            src={item.kind === 'existing' ? item.imageUrl : item.previewUrl}
            alt={`Post media ${index + 1}`}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
              {item.status === 'processing' ? (
                <>
                  <LoaderCircleIcon className="size-8 animate-spin text-primary" />
                  <p>Preparing image...</p>
                </>
              ) : (
                <>
                  <div className="rounded-full bg-destructive/10 p-3 text-destructive">
                    <ImagePlusIcon className="size-6" />
                  </div>
                  <p>Image processing failed</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium">{getMediaCardTitle(item, index)}</p>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-1 text-xs font-medium',
                item.status === 'ready' && 'bg-primary/10 text-primary',
                item.status === 'processing' && 'bg-muted text-muted-foreground',
                item.status === 'failed' && 'bg-destructive/10 text-destructive',
              )}
            >
              {item.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{getMediaCardSummary(item, index)}</p>
        </div>

        {isLocalFailedItem(item) ? (
          <p className="rounded-xl bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {item.errorMessage}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          {isLocalFailedItem(item) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onRetryItem(item.clientMediaId)}
              disabled={retryDisabled}
            >
              <RotateCcwIcon className="size-4" />
              Retry
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemoveItem(item.clientMediaId)}
            disabled={item.status === 'processing'}
          >
            <Trash2Icon className="size-4" />
            Delete
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function PostMediaEditor({
  items,
  error,
  onItemsChange,
  onErrorChange,
}: PostMediaEditorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<PostMediaEditorItem[]>(items);
  const isMountedRef = useRef(true);

  const hasProcessingItems = items.some(isLocalProcessingItem);
  const remainingSlots = POST_MEDIA_EDITOR_MAX_ITEMS - items.length;
  const acceptedMimeTypesLabel = POST_IMAGE_ACCEPTED_MIME_TYPES.map((mimeType) =>
    mimeType.replace('image/', '').toUpperCase(),
  ).join(', ');

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      for (const item of itemsRef.current) {
        revokeItemPreviewUrl(item);
      }
    };
  }, []);

  function openFilePicker() {
    inputRef.current?.click();
  }

  async function prepareLocalItem(clientMediaId: string, file: File) {
    const result = await preparePostImage(file);

    if (!isMountedRef.current) {
      return;
    }

    if (result.status === 'ready') {
      const previewUrl = URL.createObjectURL(result.asset.file);

      onItemsChange((currentItems) =>
        currentItems.map((item) =>
          item.clientMediaId === clientMediaId
            ? createReadyItem(
                clientMediaId,
                result.asset.file,
                previewUrl,
                result.asset.width,
                result.asset.height,
                result.asset.aspectRatioBucket,
                result.asset.placeholder,
              )
            : item,
        ),
      );
      return;
    }

    onItemsChange((currentItems) =>
      currentItems.map((item) =>
        item.clientMediaId === clientMediaId
          ? createFailedItem(clientMediaId, file, result.code, result.message)
          : item,
      ),
    );
  }

  async function handleSelectedFiles(fileList: FileList | null) {
    const selectedFiles = fileList ? Array.from(fileList) : [];

    // 用户取消文件选择时，直接结束，避免触发后续校验和状态更新。
    if (selectedFiles.length === 0) {
      return;
    }

    onErrorChange(null);

    // 当前仍有图片在处理中时，不允许继续追加，避免串行处理队列和界面状态混在一起。
    if (hasProcessingItems) {
      onErrorChange('Please wait for the current images to finish processing before adding more.');
      return;
    }

    // 选择后总数不能超过 6 张；这里在进入处理流程前做数量拦截，给出明确错误提示。
    if (selectedFiles.length > remainingSlots) {
      onErrorChange(
        `You can keep at most ${POST_MEDIA_EDITOR_MAX_ITEMS} images. Remove some items before adding more.`,
      );
      return;
    }

    const emptyFile = selectedFiles.find((file) => file.size <= 0);

    // 空文件无法解码和压缩，提前拦截可以避免后面进入无意义的 processing 状态。
    if (emptyFile) {
      onErrorChange(`${emptyFile.name} is empty. Please choose a different image.`);
      return;
    }

    const unsupportedFile = selectedFiles.find((file) => !isSupportedPostImageMimeType(file.type));

    // 只允许帖子媒体白名单里的 MIME 类型；像 SVG 这类不支持格式要在选择阶段直接拒绝。
    if (unsupportedFile) {
      onErrorChange(
        `${unsupportedFile.name} is not supported. Only JPG, PNG, and WebP images are allowed.`,
      );
      return;
    }

    const processingItems = selectedFiles.map((file) => createProcessingItem(file));

    onItemsChange((currentItems) => [...currentItems, ...processingItems]);

    for (const item of processingItems) {
      await prepareLocalItem(item.clientMediaId, item.file);
    }
  }

  async function handleRetryItem(clientMediaId: string) {
    const failedItem = items.find(
      (
        item,
      ): item is Extract<LocalPostMediaEditorItem, { status: 'failed' }> =>
        item.clientMediaId === clientMediaId && isLocalFailedItem(item),
    );

    if (!failedItem || hasProcessingItems) {
      return;
    }

    onErrorChange(null);

    onItemsChange((currentItems) =>
      currentItems.map((item) =>
        item.clientMediaId === clientMediaId
          ? createProcessingItem(failedItem.file, clientMediaId)
          : item,
      ),
    );

    await prepareLocalItem(clientMediaId, failedItem.file);
  }

  function handleRemoveItem(clientMediaId: string) {
    const itemToRemove = items.find((item) => item.clientMediaId === clientMediaId);

    if (!itemToRemove) {
      return;
    }

    revokeItemPreviewUrl(itemToRemove);
    onErrorChange(null);
    onItemsChange((currentItems) =>
      currentItems.filter((item) => item.clientMediaId !== clientMediaId),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled) {
      return;
    }

    const { source, target } = event.operation;

    if (!isSortable(source) || !isSortable(target)) {
      return;
    }

    const fromIndex = source.initialIndex;
    const toIndex = target.index;

    if (fromIndex === toIndex) {
      return;
    }

    onItemsChange((currentItems) => reorderItems(currentItems, fromIndex, toIndex));
  }

  return (
    <section className="w-full rounded-3xl border border-border/60 bg-card/50 p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="font-medium">Manage post images</p>
          <p className="text-sm text-muted-foreground">
            Keep up to {POST_MEDIA_EDITOR_MAX_ITEMS} JPG, PNG, or WebP images. Existing media can
            be reordered or removed, and new files are prepared locally before submission.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm text-muted-foreground">
          <p>
            {items.length} / {POST_MEDIA_EDITOR_MAX_ITEMS} selected
          </p>
          <p>Accepted: {acceptedMimeTypesLabel}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept={POST_IMAGE_ACCEPTED_MIME_TYPES.join(',')}
          multiple
          className="sr-only"
          onChange={(event) => {
            void handleSelectedFiles(event.currentTarget.files);
            event.currentTarget.value = '';
          }}
        />

        <div className="rounded-2xl border border-dashed border-border/70 bg-background p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <ImagePlusIcon className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Add images to the post</p>
                <p className="text-sm text-muted-foreground">
                  New images are prepared in sequence. Drag ready cards to reorder them. Adding
                  more files is disabled while processing is running.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={openFilePicker}
              disabled={hasProcessingItems || remainingSlots <= 0}
            >
              {hasProcessingItems ? 'Processing images...' : 'Choose images'}
            </Button>
          </div>
        </div>

        {error ? <InlineErrorAlert title="Media editor error" message={error} /> : null}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-background/70 p-8 text-center text-sm text-muted-foreground">
            No images selected yet.
          </div>
        ) : (
          <DragDropProvider onDragEnd={handleDragEnd}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item, index) => (
                <SortableMediaCard
                  key={item.clientMediaId}
                  item={item}
                  index={index}
                  retryDisabled={hasProcessingItems}
                  onRetryItem={handleRetryItem}
                  onRemoveItem={handleRemoveItem}
                />
              ))}
            </div>
          </DragDropProvider>
        )}
      </div>
    </section>
  );
}
