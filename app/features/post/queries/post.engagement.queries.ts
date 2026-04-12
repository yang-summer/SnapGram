import { useQuery } from '@tanstack/react-query';
import { getViewerLikedPosts, getViewerSavedPosts } from '../services/post.engagement.service';
import { postKeys } from './post.keys';

const VIEWER_LIKED_POSTS_STALE_TIME = 30_000;
const VIEWER_SAVED_POSTS_STALE_TIME = 30_000;

export function useViewerLikedPostsQuery(viewerId: string) {
  return useQuery({
    queryKey: postKeys.viewerLikes(viewerId),
    queryFn: () => getViewerLikedPosts(viewerId),
    enabled: viewerId.length > 0,
    staleTime: VIEWER_LIKED_POSTS_STALE_TIME,
  });
}

export function useViewerSavedPostsQuery(viewerId: string) {
  return useQuery({
    queryKey: postKeys.viewerSaves(viewerId),
    queryFn: () => getViewerSavedPosts(viewerId),
    enabled: viewerId.length > 0,
    staleTime: VIEWER_SAVED_POSTS_STALE_TIME,
  });
}
