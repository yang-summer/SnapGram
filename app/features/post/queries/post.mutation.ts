import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postKeys } from './post.keys';
import { createPost, deletePostById, updatePost } from '../services/post.service';
import type { CreatePostPublishInput, UpdatePostPublishInput } from '../types/post.type';

export function useCreatePostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePostPublishInput) => createPost(input),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
      queryClient.invalidateQueries({ queryKey: postKeys.profileRoot() });
    },
  });
}

export function useUpdatePostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePostPublishInput) => updatePost(input),
    retry: false,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(variables.postId) });
      queryClient.invalidateQueries({ queryKey: postKeys.editor(variables.postId) });
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
      queryClient.invalidateQueries({ queryKey: postKeys.profileRoot() });
    },
  });
}

export function useDeletePostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => deletePostById(postId),
    retry: false,
    onSuccess: ({ postId }) => {
      queryClient.removeQueries({ queryKey: postKeys.detail(postId), exact: true });
      queryClient.removeQueries({ queryKey: postKeys.editor(postId), exact: true });
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
      queryClient.invalidateQueries({ queryKey: postKeys.profileRoot() });
      queryClient.invalidateQueries({ queryKey: postKeys.viewerLikesRoot() });
      queryClient.invalidateQueries({ queryKey: postKeys.viewerSavesRoot() });
    },
  });
}
