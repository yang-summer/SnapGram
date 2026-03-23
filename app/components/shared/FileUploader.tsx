import React, { useCallback, useState } from 'react';
import { useDropzone, type FileWithPath } from 'react-dropzone';
import { Button } from '../ui/button';

type FileUploaderProps = {
  fieldChange: (files: File[]) => void;
  mediaUrl: string;
};

export default function FileUploader({ fieldChange, mediaUrl }: FileUploaderProps) {
  const [file, setFile] = useState<File[]>([]);
  const [fileUrl, setFileUrl] = useState(mediaUrl);

  const onDrop = useCallback(
    (acceptedFiles: FileWithPath[]) => {
      setFile(acceptedFiles);
      fieldChange(acceptedFiles);
      setFileUrl(URL.createObjectURL(acceptedFiles[0]));
    },
    [file],
  );
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpeg', 'jpg', 'svg'],
    },
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
          <img src="/assets/icons/file-upload.svg" width={96} height={77} alt="file upload" />

          <h3 className="mb-2 mt-6">Drag photo here</h3>
          <p className="mb-6">SVG, PNG, JPG</p>

          <Button type="button" className="cursor-pointer">
            Select from computer
          </Button>
        </div>
      )}
    </div>
  );
}
