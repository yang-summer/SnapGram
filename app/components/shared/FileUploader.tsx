import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone, type FileWithPath } from 'react-dropzone';
import { ImagePlus } from 'lucide-react';
import { getImageMetadata } from '~/features/post/lib/image-metadata';
import type { PreparedImageDraft } from '~/features/post/types/post.type';
import { Button } from '../ui/button';

type FileUploaderProps = {
  fieldChange: (files: File[]) => void;
  mediaUrl: string;
  onPreparedChange?: (draft: PreparedImageDraft | null) => void;
};

export default function FileUploader({ fieldChange, mediaUrl, onPreparedChange }: FileUploaderProps) {
  const [fileUrl, setFileUrl] = useState(mediaUrl);
  const fileUrlRef = useRef(mediaUrl);
  const latestSelectionIdRef = useRef(0);

  useEffect(() => {
    setFileUrl(mediaUrl);
    fileUrlRef.current = mediaUrl;
  }, [mediaUrl]);

  useEffect(() => {
    return () => {
      if (fileUrlRef.current && fileUrlRef.current !== mediaUrl) {
        URL.revokeObjectURL(fileUrlRef.current);
      }
    };
  }, [mediaUrl]);

  function updatePreviewUrl(nextUrl: string) {
    if (fileUrlRef.current && fileUrlRef.current !== mediaUrl) {
      URL.revokeObjectURL(fileUrlRef.current);
    }

    fileUrlRef.current = nextUrl;
    setFileUrl(nextUrl);
  }

  const onDrop = useCallback(
    async (acceptedFiles: FileWithPath[]) => {
      const nextFiles = acceptedFiles.slice(0, 1);
      const nextFile = nextFiles[0] ?? null;

      latestSelectionIdRef.current += 1;
      const selectionId = latestSelectionIdRef.current;

      if (!nextFile) {
        fieldChange([]);
        updatePreviewUrl(mediaUrl);
        onPreparedChange?.(null);
        return;
      }

      const nextPreviewUrl = URL.createObjectURL(nextFile);

      fieldChange(nextFiles);
      updatePreviewUrl(nextPreviewUrl);
      onPreparedChange?.({
        file: nextFile,
        metadata: null,
        metadataStatus: 'pending',
      });

      const metadata = await getImageMetadata(nextFile);

      if (latestSelectionIdRef.current !== selectionId) {
        return;
      }

      onPreparedChange?.({
        file: nextFile,
        metadata,
        metadataStatus:
          metadata.width !== null && metadata.height !== null
            ? 'ready'
            : 'failed',
      });
    },
    [fieldChange, mediaUrl, onPreparedChange],
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    multiple: false,
  });

  return (
    <div {...getRootProps()} className="flex flex-col items-center rounded-xl cursor-pointer">
      <input {...getInputProps()} className="curor-pointer" />
      {fileUrl ? (
        <>
          <div className="flex flex-1 justify-center w-full p-5">
            <img
              src={fileUrl}
              alt="image"
              className="h-80 lg:h-120 w-full rounded-[24px] object-cover object-top"
            />
          </div>
          <p className="text-center w-full p-4 border-t">Click or drag photo to replace</p>
        </>
      ) : (
        <div className="flex flex-col items-center p-7 h-80 lg:h-153">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-surface-soft text-ink-subtle">
            <ImagePlus aria-hidden="true" className="size-12" />
          </div>

          <h3 className="mb-2 mt-6">Drag photo here</h3>
          <p className="mb-6">WEBP, PNG, JPG</p>

          <Button type="button" className="cursor-pointer">
            Select from computer
          </Button>
        </div>
      )}
    </div>
  );
}
