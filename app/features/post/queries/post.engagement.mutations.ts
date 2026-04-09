import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import {
  deleteViewerPostSave,
  savePostForViewer,
  updatePostLikes,
} from '../services/post.engagement.service';
import type {
  CreateViewerPostSaveInput,
  DeleteViewerPostSaveInput,
  UpdatePostLikesInput,
} from '../types/post.type';
import { postKeys } from './post.keys';

function invalidatePostViews(queryClient: QueryClient, postId: string) {
  queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
  queryClient.invalidateQueries({ queryKey: postKeys.lists() });
}

export function useUpdatePostLikesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePostLikesInput) => updatePostLikes(input),
    onSuccess: (_, variables) => {
      invalidatePostViews(queryClient, variables.postId);
    },
  });
}

export function useCreateViewerPostSaveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateViewerPostSaveInput) => savePostForViewer(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: postKeys.viewerSaves(variables.viewerId),
      });
    },
  });
}

export function useDeleteViewerPostSaveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteViewerPostSaveInput) => deleteViewerPostSave(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: postKeys.viewerSaves(variables.viewerId),
      });
    },
  });
}
