import {
  DEFAULT_POST_ASPECT_RATIO_BUCKET,
  type ImageMetadataResult,
  type PostAspectRatioBucket,
  POST_ASPECT_RATIO_BUCKETS,
} from '../types/post.type';

const ASPECT_RATIO_VALUES: Record<PostAspectRatioBucket, number> = {
  '1:1': 1,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
};

const DEFAULT_PLACEHOLDER_MAX_EDGE = 24;
const DEFAULT_PLACEHOLDER_QUALITY = 0.4;
const DEFAULT_PLACEHOLDER_MAX_LENGTH = 1_200;

type PlaceholderOptions = {
  maxEdge?: number;
  quality?: number;
  maxLength?: number;
};

export type LoadedImage = {
  image: HTMLImageElement;
  width: number;
  height: number;
};

function hasUsableImageDimensions(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

function normalizePlaceholderOptions(options?: PlaceholderOptions): Required<PlaceholderOptions> {
  const normalizedMaxEdge =
    typeof options?.maxEdge === 'number' && Number.isFinite(options.maxEdge) && options.maxEdge > 0
      ? Math.max(1, Math.trunc(options.maxEdge))
      : DEFAULT_PLACEHOLDER_MAX_EDGE;
  const normalizedQuality =
    typeof options?.quality === 'number' && Number.isFinite(options.quality)
      ? Math.min(Math.max(options.quality, 0.1), 1)
      : DEFAULT_PLACEHOLDER_QUALITY;
  const normalizedMaxLength =
    typeof options?.maxLength === 'number' &&
    Number.isFinite(options.maxLength) &&
    options.maxLength > 0
      ? Math.max(1, Math.trunc(options.maxLength))
      : DEFAULT_PLACEHOLDER_MAX_LENGTH;

  return {
    maxEdge: normalizedMaxEdge,
    quality: normalizedQuality,
    maxLength: normalizedMaxLength,
  };
}

function getPlaceholderDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } | null {
  if (!hasUsableImageDimensions(width, height)) {
    return null;
  }

  const scale = Math.min(maxEdge / width, maxEdge / height, 1);
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));

  return {
    width: nextWidth,
    height: nextHeight,
  };
}

export function isPlaceholderWithinLimit(
  placeholder: string,
  options?: Pick<PlaceholderOptions, 'maxLength'>,
): boolean {
  if (typeof placeholder !== 'string' || placeholder.length === 0) {
    return false;
  }

  const { maxLength } = normalizePlaceholderOptions(options);

  return placeholder.length <= maxLength;
}

export function createImagePlaceholderDataUrl(
  image: HTMLImageElement,
  options?: PlaceholderOptions,
): string | null {
  const { maxEdge, quality, maxLength } = normalizePlaceholderOptions(options);
  const dimensions = getPlaceholderDimensions(image.naturalWidth, image.naturalHeight, maxEdge);

  if (!dimensions) {
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'low';
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

    const webpPlaceholder = canvas.toDataURL('image/webp', quality);
    const placeholder = webpPlaceholder.startsWith('data:image/webp')
      ? webpPlaceholder
      : canvas.toDataURL('image/jpeg', quality);

    if (!isPlaceholderWithinLimit(placeholder, { maxLength })) {
      return null;
    }

    return placeholder;
  } catch {
    return null;
  }
}

export function pickNearestAspectRatioBucket(
  width: number,
  height: number,
): PostAspectRatioBucket {
  if (!hasUsableImageDimensions(width, height)) {
    return DEFAULT_POST_ASPECT_RATIO_BUCKET;
  }

  const imageAspectRatio = width / height;
  let nearestBucket = DEFAULT_POST_ASPECT_RATIO_BUCKET;
  let smallestDelta = Number.POSITIVE_INFINITY;

  for (const bucket of POST_ASPECT_RATIO_BUCKETS) {
    const delta = Math.abs(imageAspectRatio - ASPECT_RATIO_VALUES[bucket]);

    if (delta < smallestDelta) {
      smallestDelta = delta;
      nearestBucket = bucket;
    }
  }

  return nearestBucket;
}

export async function loadImageFromFile(file: File): Promise<LoadedImage> {
  if (!(file instanceof File)) {
    throw new Error('A valid image file is required to load metadata.');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();

      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Failed to decode image file.'));
      nextImage.src = objectUrl;
    });

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (!hasUsableImageDimensions(width, height)) {
      throw new Error('Image dimensions are unavailable.');
    }

    return {
      image,
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function getImageMetadataFromLoadedImage({
  image,
  width,
  height,
}: LoadedImage): ImageMetadataResult {
  return {
    width,
    height,
    aspectRatioBucket: pickNearestAspectRatioBucket(width, height),
    placeholder: createImagePlaceholderDataUrl(image),
  };
}

export async function getImageMetadata(file: File): Promise<ImageMetadataResult> {
  try {
    return getImageMetadataFromLoadedImage(await loadImageFromFile(file));
  } catch {
    return {
      width: null,
      height: null,
      aspectRatioBucket: DEFAULT_POST_ASPECT_RATIO_BUCKET,
      placeholder: null,
    };
  }
}
