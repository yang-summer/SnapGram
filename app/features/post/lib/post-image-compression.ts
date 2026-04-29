import {
  type PostImagePreparationErrorCode,
  type PostImagePreparationFailureResult,
  type PostImagePreparationResult,
  type PreparedPostImageAsset,
} from '../types/post.type';
import { getImageMetadataFromLoadedImage, loadImageFromFile } from './image-metadata';

export const POST_IMAGE_ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type PostImageAcceptedMimeType = (typeof POST_IMAGE_ACCEPTED_MIME_TYPES)[number];

export const DEFAULT_POST_IMAGE_MAX_FILE_SIZE_BYTES = 1_200_000;
export const DEFAULT_POST_IMAGE_OUTPUT_MIME_TYPE = 'image/webp';
export const FALLBACK_POST_IMAGE_OUTPUT_MIME_TYPE = 'image/jpeg';
export type PostImageOutputMimeType = 'image/webp' | 'image/jpeg';

const DEFAULT_PRIMARY_COMPRESSION_PASS = {
  maxEdge: 1600,
  quality: 0.82,
} as const;

const DEFAULT_SECONDARY_COMPRESSION_PASS = {
  maxEdge: 1400,
  quality: 0.72,
} as const;

const POST_IMAGE_OUTPUT_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export type PostImageCompressionPass = {
  maxEdge: number;
  quality: number;
};

export type PreparePostImageOptions = {
  maxFileSizeBytes?: number;
  outputMimeType?: PostImageOutputMimeType;
  compressionPasses?: PostImageCompressionPass[];
};

// 统一构造图片准备失败结果，避免各处手写重复对象结构。
function createFailureResult(
  code: PostImagePreparationErrorCode,
  message: string,
): PostImagePreparationFailureResult {
  return {
    status: 'failed',
    code,
    message,
  };
}

// 将可选数值规范为正整数；无效输入时回退到默认值。
function clampPositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.max(1, Math.trunc(value));
}

// 将压缩质量限制在浏览器导出更稳妥的 0.1-1 区间内。
function clampQuality(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, 0.1), 1);
}

// 归一化压缩轮次配置，确保至少存在一轮可执行的压缩参数。
function normalizeCompressionPasses(
  passes: PostImageCompressionPass[] | undefined,
): [PostImageCompressionPass, ...PostImageCompressionPass[]] {
  if (!Array.isArray(passes) || passes.length === 0) {
    return [DEFAULT_PRIMARY_COMPRESSION_PASS, DEFAULT_SECONDARY_COMPRESSION_PASS];
  }

  const normalizedPasses = passes
    .map((pass) => ({
      maxEdge: clampPositiveInteger(pass.maxEdge, DEFAULT_PRIMARY_COMPRESSION_PASS.maxEdge),
      quality: clampQuality(pass.quality, DEFAULT_PRIMARY_COMPRESSION_PASS.quality),
    }))
    .filter((pass) => pass.maxEdge > 0);

  if (normalizedPasses.length === 0) {
    return [DEFAULT_PRIMARY_COMPRESSION_PASS, DEFAULT_SECONDARY_COMPRESSION_PASS];
  }

  return normalizedPasses as [PostImageCompressionPass, ...PostImageCompressionPass[]];
}

// 合并外部选项与默认策略，生成本次图片处理的最终配置。
function normalizeOptions(options?: PreparePostImageOptions) {
  return {
    maxFileSizeBytes: clampPositiveInteger(
      options?.maxFileSizeBytes,
      DEFAULT_POST_IMAGE_MAX_FILE_SIZE_BYTES,
    ),
    outputMimeType: options?.outputMimeType ?? DEFAULT_POST_IMAGE_OUTPUT_MIME_TYPE,
    compressionPasses: normalizeCompressionPasses(options?.compressionPasses),
  };
}

// 判断文件 MIME 是否属于帖子图片白名单。
export function isSupportedPostImageMimeType(value: string): value is PostImageAcceptedMimeType {
  return (POST_IMAGE_ACCEPTED_MIME_TYPES as readonly string[]).includes(value);
}

// 探测当前浏览器的 canvas 是否支持导出指定图片格式。
function supportsCanvasOutputMimeType(mimeType: string): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    return canvas.toDataURL(mimeType).startsWith(`data:${mimeType}`);
  } catch {
    return false;
  }
}

// 解析最终导出格式；若浏览器不支持目标格式，则回退到 JPEG。
function resolveOutputMimeType(
  requestedMimeType: PostImageOutputMimeType,
): PostImageOutputMimeType {
  if (supportsCanvasOutputMimeType(requestedMimeType)) {
    return requestedMimeType;
  }

  return FALLBACK_POST_IMAGE_OUTPUT_MIME_TYPE;
}

// 按最长边约束计算缩放后的宽高，同时保持原始宽高比。
function getScaledDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longestEdge = Math.max(width, height);

  if (longestEdge <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / longestEdge;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// 将已解码图片绘制到 canvas，供后续按目标格式与质量导出。
function renderImageToCanvas(
  image: HTMLImageElement,
  width: number,
  height: number,
  outputMimeType: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  if (outputMimeType === FALLBACK_POST_IMAGE_OUTPUT_MIME_TYPE) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  return canvas;
}

// 使用浏览器原生 toBlob 将 canvas 导出为指定格式的二进制结果。
function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to export compressed image blob.'));
        return;
      }

      resolve(blob);
    }, mimeType, quality);
  });
}

// 去掉原始文件扩展名，为压缩后文件重新拼接输出格式后缀。
function stripFileExtension(fileName: string): string {
  const normalizedFileName = fileName.trim();

  if (!normalizedFileName) {
    return 'post-image';
  }

  const lastDotIndex = normalizedFileName.lastIndexOf('.');

  if (lastDotIndex <= 0) {
    return normalizedFileName;
  }

  return normalizedFileName.slice(0, lastDotIndex);
}

// 基于导出的 Blob 重新构造最终上传文件，并写入新的类型与后缀。
function createPreparedFile(originalFile: File, blob: Blob, mimeType: string): File {
  const extension = POST_IMAGE_OUTPUT_EXTENSION_BY_MIME_TYPE[mimeType] ?? 'jpg';
  const nextFileName = `${stripFileExtension(originalFile.name)}.${extension}`;

  return new File([blob], nextFileName, {
    type: mimeType,
    lastModified: originalFile.lastModified,
  });
}

// 按既定压缩轮次逐轮导出，直到文件体积达标或用完所有降质策略。
async function compressImageUntilWithinLimit(
  file: File,
  outputMimeType: PostImageOutputMimeType,
  compressionPasses: [PostImageCompressionPass, ...PostImageCompressionPass[]],
  maxFileSizeBytes: number,
): Promise<File> {
  const loadedImage = await loadImageFromFile(file);
  let lastBlob: Blob | null = null;

  for (let index = 0; index < compressionPasses.length; index += 1) {
    const pass = compressionPasses[index];
    const dimensions = getScaledDimensions(loadedImage.width, loadedImage.height, pass.maxEdge);
    const canvas = renderImageToCanvas(
      loadedImage.image,
      dimensions.width,
      dimensions.height,
      outputMimeType,
    );

    lastBlob = await canvasToBlob(canvas, outputMimeType, pass.quality);

    if (lastBlob.size <= maxFileSizeBytes) {
      break;
    }
  }

  if (!lastBlob) {
    throw new Error('No compressed image blob was produced.');
  }

  return createPreparedFile(file, lastBlob, outputMimeType);
}

// 生成帖子图片最终资产：压缩后文件 + 宽高 + 比例桶 + placeholder。
async function createPreparedAsset(
  file: File,
  options?: PreparePostImageOptions,
): Promise<PreparedPostImageAsset> {
  const { compressionPasses, maxFileSizeBytes, outputMimeType } = normalizeOptions(options);
  const resolvedOutputMimeType = resolveOutputMimeType(outputMimeType);
  const preparedFile = await compressImageUntilWithinLimit(
    file,
    resolvedOutputMimeType,
    compressionPasses,
    maxFileSizeBytes,
  );
  const loadedPreparedImage = await loadImageFromFile(preparedFile);
  const metadata = getImageMetadataFromLoadedImage(loadedPreparedImage);

  return {
    file: preparedFile,
    width: loadedPreparedImage.width,
    height: loadedPreparedImage.height,
    aspectRatioBucket: metadata.aspectRatioBucket,
    placeholder: metadata.placeholder,
  };
}

// 帖子图片处理主入口：校验输入、压缩图片并返回统一的成功/失败结果。
export async function preparePostImage(
  file: File,
  options?: PreparePostImageOptions,
): Promise<PostImagePreparationResult> {
  if (!(file instanceof File)) {
    return createFailureResult('unsupported_type', 'A valid image file is required.');
  }

  if (file.size <= 0) {
    return createFailureResult('empty_file', 'Selected image file is empty.');
  }

  if (!isSupportedPostImageMimeType(file.type)) {
    return createFailureResult(
      'unsupported_type',
      'Only JPG, PNG, and WebP images are supported.',
    );
  }

  try {
    return {
      status: 'ready',
      asset: await createPreparedAsset(file, options),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prepare image.';
    const code: PostImagePreparationErrorCode =
      message.toLowerCase().includes('decode') ? 'decode_failed' : 'compress_failed';

    return createFailureResult(code, message);
  }
}
