import { useQuery } from '@tanstack/react-query';
import { postKeys } from './post.keys';
import { getRecentPostCards } from '../services/post.service';

export function useGetRecentPostsQuery() {
  return useQuery({
    queryKey: postKeys.recent(),
    queryFn: getRecentPostCards,
  });
}
