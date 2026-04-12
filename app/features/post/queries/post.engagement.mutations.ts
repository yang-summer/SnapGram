import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import {
  deleteViewerPostLike,
  deleteViewerPostSave,
  likePostForViewer,
  savePostForViewer,
} from '../services/post.engagement.service';
import type {
  CreateViewerPostLikeInput,
  CreateViewerPostSaveInput,
  DeleteViewerPostLikeInput,
  DeleteViewerPostSaveInput,
} from '../types/post.type';
import { postKeys } from './post.keys';

function invalidatePostViews(queryClient: QueryClient, postId: string) {
  queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
  queryClient.invalidateQueries({ queryKey: postKeys.lists() });
}

export function useCreateViewerPostLikeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateViewerPostLikeInput) => likePostForViewer(input),
    onSuccess: (_, variables) => {
      invalidatePostViews(queryClient, variables.postId);
      queryClient.invalidateQueries({
        queryKey: postKeys.viewerLikes(variables.viewerId),
      });
    },
  });
}

export function useDeleteViewerPostLikeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteViewerPostLikeInput) => deleteViewerPostLike(input),
    onSuccess: (_, variables) => {
      invalidatePostViews(queryClient, variables.postId);
      queryClient.invalidateQueries({
        queryKey: postKeys.viewerLikes(variables.viewerId),
      });
    },
  });
}

export function useCreateViewerPostSaveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateViewerPostSaveInput) => savePostForViewer(input),
    onSuccess: (_, variables) => {
      invalidatePostViews(queryClient, variables.postId);
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
      if (variables.postId) {
        invalidatePostViews(queryClient, variables.postId);
      }

      queryClient.invalidateQueries({
        queryKey: postKeys.viewerSaves(variables.viewerId),
      });
    },
  });
}
