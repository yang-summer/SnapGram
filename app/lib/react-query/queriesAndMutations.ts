import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPost, createUserAccount, signInAccount, signOutAccount } from '../appwrite/api';
import type { NewPost, NewUser } from '../types';
import { QUERY_KEYS } from './queryKeys';

export function useCreateUserAccountMutation() {
  return useMutation({
    mutationFn: (newUser: NewUser) => {
      return createUserAccount(newUser);
    },
  });
}

export function useSignInAccountMutation() {
  return useMutation({
    mutationFn: (user: { email: string; password: string }) => signInAccount(user),
  });
}

export function useSignOutAccountMutation() {
  return useMutation({
    mutationFn: () => signOutAccount(),
  });
}

export function useCreatePostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (post: NewPost) => createPost(post),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_RECENT_POST] });
    },
  });
}
