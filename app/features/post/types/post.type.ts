import type { Models } from 'appwrite';

export const POST_ASPECT_RATIO_BUCKETS = ['1:1', '3:4', '4:3'] as const;

export type PostAspectRatioBucket = (typeof POST_ASPECT_RATIO_BUCKETS)[number];

export const DEFAULT_POST_ASPECT_RATIO_BUCKET: PostAspectRatioBucket = '3:4';

export type RawPostCreator = {
  $id: string;
  name?: string | null;
  imageUrl?: string | null;
};

export type RawViewerSaveRecord = Models.Row & {
  postId: string;
  userId: string;
};

export type RawViewerLikeRecord = Models.Row & {
  postId: string;
  userId: string;
};

export type RawPostRow = Models.Row & {
  caption?: string | null;
  imageUrl: string;
  imageId: string;
  aspectRatioBucket?: string | null;
  imagePlaceholder?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
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
    | 'aspectRatioBucket'
    | 'imagePlaceholder'
    | 'imageWidth'
    | 'imageHeight'
    | 'location'
    | 'tags'
    | 'creator'
    | 'likeCount'
    | 'saveCount'
  >;

export type RawPostHomeFeedRow = Models.Row &
  Pick<
    RawPostRow,
    | 'caption'
    | 'imageUrl'
    | 'imagePlaceholder'
    | 'aspectRatioBucket'
    | 'imageWidth'
    | 'imageHeight'
    | 'creator'
    | 'likeCount'
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
  aspectRatioBucket?: string | null;
  imagePlaceholder?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
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

export type HomeFeedPostViewModel = {
  id: string;
  createdAt: string;
  caption: string;
  imageUrl: string;
  imagePlaceholder: string | null;
  aspectRatioBucket: PostAspectRatioBucket;
  imageWidth: number | null;
  imageHeight: number | null;
  creator: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  likeCount: number;
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
  creatorProfileId: string;
  ownerAccountId: string;
  caption: string;
  file: File;
  location: string;
  tags: string[];
};

export type CreatePostApiInput = {
  creatorProfileId: string;
  ownerAccountId: string;
  caption: string;
  imageId: string;
  imageUrl: string;
  location: string;
  tags: string[];
};

export type UpdatePostInput = {
  postId: string;
  ownerAccountId: string;
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
  viewerProfileId: string;
  viewerAccountId: string;
};

export type DeleteViewerPostLikeInput = {
  viewerProfileId: string;
  postId: string;
};

export type ViewerLikedPostRecord = {
  likeRecordId: string;
  postId: string;
};

export type ViewerLikedPostResult = ViewerLikedPostRecord | null;

export type ViewerLikedPostsResult = {
  records: ViewerLikedPostRecord[];
  postIds: string[];
  recordByPostId: Record<string, ViewerLikedPostRecord>;
};

export type ViewerLikedPostsByPostIdsResult = ViewerLikedPostsResult;

export type ViewerPostLikeMutationResult = {
  likeRecordId: string;
  postId: string;
  viewerProfileId: string;
};

export type DeleteViewerPostLikeResult = {
  likeRecordId: string | null;
  deleted: boolean;
};

export type CreateViewerPostSaveInput = {
  postId: string;
  viewerProfileId: string;
  viewerAccountId: string;
};

export type DeleteViewerPostSaveInput = {
  viewerProfileId: string;
  postId: string;
};

export type ViewerSavedPostRecord = {
  saveRecordId: string;
  postId: string;
};

export type ViewerSavedPostResult = ViewerSavedPostRecord | null;

export type ViewerSavedPostsResult = {
  records: ViewerSavedPostRecord[];
  postIds: string[];
  recordByPostId: Record<string, ViewerSavedPostRecord>;
  recordIdsByPostId: Record<string, string[]>;
};

export type ViewerSavedPostsByPostIdsResult = ViewerSavedPostsResult;

export type ViewerPostSaveMutationResult = {
  saveRecordId: string;
  postId: string;
  viewerProfileId: string;
};

export type DeleteViewerPostSaveResult = {
  saveRecordId: string | null;
  deleted: boolean;
};
