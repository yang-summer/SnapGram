import { useQuery } from '@tanstack/react-query';
import {
  getViewerLikedPost,
  getViewerLikedPosts,
  getViewerLikedPostsByPostIds,
  getViewerSavedPost,
  getViewerSavedPosts,
  getViewerSavedPostsByPostIds,
} from '../services/post.engagement.service';
import { postKeys } from './post.keys';

const VIEWER_ENGAGEMENT_STALE_TIME = 30_000;

export function useViewerLikedPostQuery(viewerProfileId: string, postId: string) {
  return useQuery({
    queryKey: postKeys.viewerLike(viewerProfileId, postId),
    queryFn: () => getViewerLikedPost(viewerProfileId, postId),
    enabled: viewerProfileId.length > 0 && postId.length > 0,
    staleTime: VIEWER_ENGAGEMENT_STALE_TIME,
  });
}

export function useViewerSavedPostQuery(viewerProfileId: string, postId: string) {
  return useQuery({
    queryKey: postKeys.viewerSave(viewerProfileId, postId),
    queryFn: () => getViewerSavedPost(viewerProfileId, postId),
    enabled: viewerProfileId.length > 0 && postId.length > 0,
    staleTime: VIEWER_ENGAGEMENT_STALE_TIME,
  });
}

export function useViewerLikedPostsQuery(viewerProfileId: string) {
  return useQuery({
    queryKey: postKeys.viewerLikes(viewerProfileId),
    queryFn: () => getViewerLikedPosts(viewerProfileId),
    enabled: viewerProfileId.length > 0,
    staleTime: VIEWER_ENGAGEMENT_STALE_TIME,
  });
}

export function useViewerLikedPostsByPostIdsQuery(viewerProfileId: string, postIds: string[]) {
  return useQuery({
    queryKey: postKeys.viewerLikesByPosts(viewerProfileId, postIds),
    queryFn: () => getViewerLikedPostsByPostIds(viewerProfileId, postIds),
    enabled: viewerProfileId.length > 0 && postIds.length > 0,
    staleTime: VIEWER_ENGAGEMENT_STALE_TIME,
  });
}

export function useViewerSavedPostsQuery(viewerProfileId: string) {
  return useQuery({
    queryKey: postKeys.viewerSaves(viewerProfileId),
    queryFn: () => getViewerSavedPosts(viewerProfileId),
    enabled: viewerProfileId.length > 0,
    staleTime: VIEWER_ENGAGEMENT_STALE_TIME,
  });
}

export function useViewerSavedPostsByPostIdsQuery(viewerProfileId: string, postIds: string[]) {
  return useQuery({
    queryKey: postKeys.viewerSavesByPosts(viewerProfileId, postIds),
    queryFn: () => getViewerSavedPostsByPostIds(viewerProfileId, postIds),
    enabled: viewerProfileId.length > 0 && postIds.length > 0,
    staleTime: VIEWER_ENGAGEMENT_STALE_TIME,
  });
}
