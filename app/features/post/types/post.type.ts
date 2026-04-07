import type { Models } from 'appwrite';

export type RawPostCreator = {
  $id: string;
  name?: string | null;
  imageUrl?: string | null;
};

export type RawPostLikeRow = Models.Row & {
  $id: string;
};

export type RawPostRow = Models.Row & {
  caption?: string | null;
  imageUrl: string;
  imageId: string;
  location?: string | null;
  tags?: string[] | null;
  creator?: RawPostCreator;
  likes?: RawPostLikeRow[] | null;
};

export type RawPostListRow = Models.Row &
  Pick<
    RawPostRow,
    | '$id'
    | '$createdAt'
    | '$updatedAt'
    | 'caption'
    | 'imageUrl'
    | 'location'
    | 'tags'
    | 'creator'
    | 'likes'
  >;

export type RawPostEditorRow = Models.Row & {
  caption?: string | null;
  imageId: string;
  imageUrl: string;
  location?: string | null;
  tags?: string[] | null;
};

export type RawPostWriteRow = Models.Row & {
  creator?: string | null;
  caption?: string | null;
  imageId: string;
  imageUrl: string;
  location?: string | null;
  tags?: string[] | null;
};

export type RawPostMutationRow = Models.Row & {
  imageId: string;
  imageUrl: string;
};

export type ListPostRowsParams = {
  cursor?: string | null;
  limit?: number;
};

export type SearchPostRowsParams = {
  term: string;
  limit?: number;
};

export type PostCardViewModel = {
  id: string;
  createdAt: string;
  caption: string;
  imageUrl: string;
  location: string | null;
  tags: string[];
  creator: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  likes: string[];
};

export type PostDetailViewModel = {
  id: string;
  createdAt: string;
  caption: string;
  imageId: string;
  imageUrl: string;
  location: string | null;
  tags: string[];
  creator: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  likes: string[];
};

export type PostDeleteSnapshot = Models.Row & {
  imageId?: string | null;
};

export type DeletePostResult = {
  postId: string;
  imageCleanupFailed: boolean;
};

export type PostGridItemViewModel = {
  id: string;
  imageUrl: string;
  creator: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  likes: string[];
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type PostFormValues = {
  caption: string;
  file: File[];
  location: string;
  tags: string;
};

export type PostEditorInitialData = {
  id: string;
  caption: string;
  imageId: string;
  imageUrl: string;
  location: string;
  tags: string;
};

export type CreatePostInput = {
  creatorId: string;
  caption: string;
  file: File;
  location: string;
  tags: string[];
};

export type CreatePostApiInput = {
  creatorId: string;
  caption: string;
  imageId: string;
  imageUrl: string;
  location: string;
  tags: string[];
};

export type UpdatePostInput = {
  postId: string;
  caption: string;
  location: string;
  tags: string[];
  nextFile?: File | null;
  currentImageId: string;
  currentImageUrl: string;
};

export type UpdatePostApiInput = {
  postId: string;
  caption: string;
  imageId: string;
  imageUrl: string;
  location: string;
  tags: string[];
};

export type PostMutationResult = {
  id: string;
  imageId: string;
  imageUrl: string;
};
