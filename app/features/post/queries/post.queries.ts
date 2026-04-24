import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { postKeys } from './post.keys';
import { DEFAULT_HOME_FEED_PAGE_SIZE, DEFAULT_PROFILE_FEED_PAGE_SIZE } from '../api/post.api';
import {
  getExplorePostPage,
  getHomeFeedPage,
  getPostDetail,
  getPostEditorInitialData,
  getProfilePostCount,
  getProfilePostPage,
  getRecentPostCards,
  searchExplorePosts,
} from '../services/post.service';

const DEFAULT_EXPLORE_POST_PAGE_SIZE = 9;
const DEFAULT_SEARCH_RESULTS_LIMIT = 20;

export function useGetRecentPostsQuery() {
  return useQuery({
    queryKey: postKeys.recent(),
    queryFn: getRecentPostCards,
  });
}

export function useGetPostByIdQuery(postId: string) {
  return useQuery({
    queryKey: postKeys.detail(postId),
    queryFn: () => getPostDetail(postId),
    enabled: !!postId,
  });
}

export function useGetPostEditorQuery(postId: string) {
  return useQuery({
    queryKey: postKeys.editor(postId),
    queryFn: () => getPostEditorInitialData(postId),
    enabled: !!postId,
  });
}

export function useExplorePostsInfiniteQuery(limit = DEFAULT_EXPLORE_POST_PAGE_SIZE) {
  return useInfiniteQuery({
    queryKey: postKeys.explore({ limit }),
    queryFn: ({ pageParam }) =>
      getExplorePostPage({
        cursor: pageParam,
        limit,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}

export function useHomeFeedInfiniteQuery(limit = DEFAULT_HOME_FEED_PAGE_SIZE) {
  return useInfiniteQuery({
    queryKey: postKeys.homeFeed({ limit }),
    queryFn: ({ pageParam }) =>
      getHomeFeedPage({
        cursor: pageParam,
        limit,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}

export function useProfilePostsInfiniteQuery(
  profileId: string,
  limit = DEFAULT_PROFILE_FEED_PAGE_SIZE,
) {
  const normalizedProfileId = profileId.trim();

  return useInfiniteQuery({
    queryKey: postKeys.profilePosts(normalizedProfileId, { limit }),
    queryFn: ({ pageParam }) =>
      getProfilePostPage({
        profileId: normalizedProfileId,
        cursor: pageParam,
        limit,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: normalizedProfileId.length > 0,
    staleTime: 30_000,
  });
}

export function useProfilePostCountQuery(
  profileId: string,
  options?: { enabled?: boolean },
) {
  const normalizedProfileId = profileId.trim();
  const enabled = normalizedProfileId.length > 0 && (options?.enabled ?? true);

  return useQuery({
    queryKey: postKeys.profilePostCount(normalizedProfileId),
    queryFn: () => getProfilePostCount(normalizedProfileId),
    enabled,
    staleTime: 30_000,
  });
}

export function useSearchPostsQuery(rawTerm: string, limit = DEFAULT_SEARCH_RESULTS_LIMIT) {
  const term = rawTerm.trim();

  return useQuery({
    queryKey: postKeys.search({ term, limit }),
    queryFn: () =>
      searchExplorePosts({
        term,
        limit,
      }),
    enabled: term.length >= 3,
    staleTime: 30_000,
  });
}
