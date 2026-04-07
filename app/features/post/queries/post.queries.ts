import { useQuery } from '@tanstack/react-query';
import { postKeys } from './post.keys';
import { getPostDetail, getRecentPostCards } from '../services/post.service';

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
