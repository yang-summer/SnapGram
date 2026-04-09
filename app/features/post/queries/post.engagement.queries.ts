import { useQuery } from '@tanstack/react-query';
import { getViewerSavedPosts } from '../services/post.engagement.service';
import { postKeys } from './post.keys';

const VIEWER_SAVED_POSTS_STALE_TIME = 30_000;

export function useViewerSavedPostsQuery(viewerId: string) {
  return useQuery({
    queryKey: postKeys.viewerSaves(viewerId),
    queryFn: () => getViewerSavedPosts(viewerId),
    enabled: viewerId.length > 0,
    staleTime: VIEWER_SAVED_POSTS_STALE_TIME,
  });
}
