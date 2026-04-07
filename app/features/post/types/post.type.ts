import type { Models } from 'appwrite';

export type RawPostRow = Models.Row & {
  caption?: string | null;
  imageUrl: string;
  imageId: string;
  location?: string | null;
  tags?: string[] | null;
  creator?: {
    $id: string;
    name?: string | null;
    imageUrl?: string | null;
  };
  likes?: Array<Models.Row> | null;
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
