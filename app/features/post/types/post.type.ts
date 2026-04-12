import type { Models } from 'appwrite';

export type RawPostCreator = {
  $id: string;
  name?: string | null;
  imageUrl?: string | null;
};

export type RawViewerSavePostReference = {
  $id: string;
};

export type RawViewerSaveRecord = Models.Row & {
  postId?: string | null;
  userId?: string | null;
  post?: string | RawViewerSavePostReference | null;
  user?: string | null;
};

export type RawViewerLikeRecord = Models.Row & {
  postId?: string | null;
  userId?: string | null;
};

export type RawPostRow = Models.Row & {
  caption?: string | null;
  imageUrl: string;
  imageId: string;
  location?: string | null;
  tags?: string[] | null;
  creator?: RawPostCreator;
  likeCount?: number | null;
  saveCount?: number | null;
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
    | 'likeCount'
    | 'saveCount'
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
  status?: string | null;
  searchText?: string | null;
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
  likeCount: number;
  saveCount: number;
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
  likeCount: number;
  saveCount: number;
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
  likeCount: number;
  saveCount: number;
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

export type CreateViewerPostLikeInput = {
  postId: string;
  viewerId: string;
};

export type DeleteViewerPostLikeInput = {
  likeRecordId: string;
  viewerId: string;
  postId: string;
};

export type ViewerLikedPostRecord = {
  likeRecordId: string;
  postId: string;
};

export type ViewerLikedPostsResult = {
  records: ViewerLikedPostRecord[];
  postIds: string[];
};

export type ViewerPostLikeMutationResult = {
  likeRecordId: string;
  postId: string;
  viewerId: string;
};

export type DeleteViewerPostLikeResult = {
  likeRecordId: string;
};

export type CreateViewerPostSaveInput = {
  postId: string;
  viewerId: string;
};

export type DeleteViewerPostSaveInput = {
  saveRecordIds: string[];
  viewerId: string;
  postId?: string;
};

export type ViewerSavedPostRecord = {
  saveRecordId: string;
  postId: string;
};

export type ViewerSavedPostsResult = {
  records: ViewerSavedPostRecord[];
  postIds: string[];
  recordIdsByPostId: Record<string, string[]>;
};

export type ViewerPostSaveMutationResult = {
  saveRecordId: string;
  postId: string;
  viewerId: string;
};

export type DeleteViewerPostSaveResult = {
  saveRecordIds: string[];
};
