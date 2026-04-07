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
  likes?: Array<{
    $id: string;
  }> | null;
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
  likes: Array<{
    $id: string;
  }>;
};
