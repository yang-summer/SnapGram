import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postKeys } from './post.keys';
import { deletePostById } from '../services/post.service';

export function useDeletePostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => deletePostById(postId),
    onSuccess: ({ postId }) => {
      queryClient.removeQueries({ queryKey: postKeys.detail(postId), exact: true });
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
    },
  });
}
