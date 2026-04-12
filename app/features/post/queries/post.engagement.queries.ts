import { useQuery } from '@tanstack/react-query';
import { getViewerLikedPosts, getViewerSavedPosts } from '../services/post.engagement.service';
import { postKeys } from './post.keys';

const VIEWER_LIKED_POSTS_STALE_TIME = 30_000;
const VIEWER_SAVED_POSTS_STALE_TIME = 30_000;

export function useViewerLikedPostsQuery(viewerProfileId: string) {
  return useQuery({
    queryKey: postKeys.viewerLikes(viewerProfileId),
    queryFn: () => getViewerLikedPosts(viewerProfileId),
    enabled: viewerProfileId.length > 0,
    staleTime: VIEWER_LIKED_POSTS_STALE_TIME,
  });
}

export function useViewerSavedPostsQuery(viewerProfileId: string) {
  return useQuery({
    queryKey: postKeys.viewerSaves(viewerProfileId),
    queryFn: () => getViewerSavedPosts(viewerProfileId),
    enabled: viewerProfileId.length > 0,
    staleTime: VIEWER_SAVED_POSTS_STALE_TIME,
  });
}
