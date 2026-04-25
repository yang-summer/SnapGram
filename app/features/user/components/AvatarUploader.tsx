import { useEffect, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { EDIT_PROFILE_AVATAR_MAX_SIZE_BYTES } from '~/lib/validation';

const AVATAR_ACCEPT = {
  'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
} as const;

type AvatarUploaderProps = {
  currentImageUrl: string;
  value: File | null;
  onChange: (file: File | null) => void;
  alt?: string;
  disabled?: boolean;
  className?: string;
};

function formatMaxAvatarSize(bytes: number): string {
  const sizeInMegabytes = bytes / (1024 * 1024);

  if (Number.isInteger(sizeInMegabytes)) {
    return `${sizeInMegabytes}MB`;
  }

  return `${sizeInMegabytes.toFixed(1)}MB`;
}

function getFileRejectionMessage(fileRejections: FileRejection[]): string {
  const firstError = fileRejections[0]?.errors[0];

  if (!firstError) {
    return 'Unable to use this avatar file.';
  }

  switch (firstError.code) {
    case 'file-invalid-type':
      return 'Please choose a PNG, JPG, or WEBP image.';
    case 'file-too-large':
      return `Avatar image must be ${formatMaxAvatarSize(EDIT_PROFILE_AVATAR_MAX_SIZE_BYTES)} or smaller.`;
    case 'too-many-files':
      return 'Please choose one avatar image.';
    default:
      return firstError.message || 'Unable to use this avatar file.';
  }
}

export default function AvatarUploader({
  currentImageUrl,
  value,
  onChange,
  alt = 'Profile avatar preview',
  disabled = false,
  className,
}: AvatarUploaderProps) {
  const objectUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl);
  const [dropzoneError, setDropzoneError] = useState<string | null>(null);
  const hasPendingSelection = value !== null;
  const hasPreviewImage = previewUrl.trim().length > 0;

  // 在当前头像地址或新选择的文件变化时，同步本地预览地址。
  // 如果预览来自 object URL，这里负责在替换和卸载时回收它，避免浏览器内存泄漏。
  useEffect(() => {
    if (!value) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      setPreviewUrl(currentImageUrl);
      return;
    }

    const nextObjectUrl = URL.createObjectURL(value);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    objectUrlRef.current = nextObjectUrl;
    setPreviewUrl(nextObjectUrl);

    return () => {
      if (objectUrlRef.current === nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl);
        objectUrlRef.current = null;
      }
    };
  }, [currentImageUrl, value]);

  function handleDropAccepted(acceptedFiles: File[]) {
    const nextFile = acceptedFiles[0] ?? null;

    if (!nextFile) {
      return;
    }

    setDropzoneError(null);
    onChange(nextFile);
  }

  function handleDropRejected(fileRejections: FileRejection[]) {
    setDropzoneError(getFileRejectionMessage(fileRejections));
  }

  function handleResetSelection() {
    setDropzoneError(null);
    onChange(null);
  }

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDropAccepted: handleDropAccepted,
    onDropRejected: handleDropRejected,
    accept: AVATAR_ACCEPT,
    multiple: false,
    maxFiles: 1,
    maxSize: EDIT_PROFILE_AVATAR_MAX_SIZE_BYTES,
    disabled,
    noClick: true,
  });

  return (
    <div
      {...getRootProps({
        className: cn(
          'rounded-3xl border border-dashed bg-card p-5 transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
          disabled && 'cursor-not-allowed opacity-60',
          className,
        ),
      })}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="shrink-0 self-center sm:self-start">
          {hasPreviewImage ? (
            <img
              src={previewUrl}
              alt={alt}
              className="size-28 rounded-full border bg-surface-soft object-cover shadow-sm"
            />
          ) : (
            <div className="flex size-28 items-center justify-center rounded-full border bg-surface-soft text-muted-foreground shadow-sm">
              <UserRound className="size-12" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 text-center sm:text-left">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Profile photo</h3>
            <p className="text-sm text-muted-foreground">
              Drag and drop a new avatar here, or choose one from your computer.
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG or WEBP up to {formatMaxAvatarSize(EDIT_PROFILE_AVATAR_MAX_SIZE_BYTES)}.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
            <Button type="button" onClick={open} disabled={disabled}>
              {hasPendingSelection ? 'Replace selection' : 'Choose avatar'}
            </Button>

            {hasPendingSelection ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleResetSelection}
                disabled={disabled}
              >
                Use current avatar
              </Button>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">
            {hasPendingSelection
              ? 'New avatar selected. Save changes to apply it.'
              : 'Your current avatar will stay unchanged until you save a new one.'}
          </p>

          {dropzoneError ? (
            <p role="alert" className="text-sm text-destructive">
              {dropzoneError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
