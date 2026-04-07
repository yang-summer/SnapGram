import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postKeys } from './post.keys';
import { createPost, deletePostById, updatePost } from '../services/post.service';
import type { CreatePostInput, UpdatePostInput } from '../types/post.type';

export function useCreatePostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePostInput) => createPost(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
    },
  });
}

export function useUpdatePostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePostInput) => updatePost(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(variables.postId) });
      queryClient.invalidateQueries({ queryKey: postKeys.editor(variables.postId) });
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
    },
  });
}

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
