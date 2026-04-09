import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postKeys } from '~/features/post/queries/post.keys';
import {
  retryInitializeCurrentUserProfile,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from '../services/auth.service';
import type { CurrentUserResult, SignInInput, SignUpInput } from '../types/auth.type';
import { authKeys } from './auth.keys';

function setCurrentUserCache(
  queryClient: ReturnType<typeof useQueryClient>,
  currentUser: CurrentUserResult,
) {
  queryClient.setQueryData(authKeys.currentUser(), currentUser);
}

function getAuthenticatedViewerId(currentUser: CurrentUserResult | undefined): string | null {
  if (currentUser?.status !== 'authenticated') {
    return null;
  }

  return currentUser.user.profileId;
}

export function useSignInMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SignInInput) => signInWithEmail(input),
    retry: false,
    onSuccess: (currentUser) => {
      setCurrentUserCache(queryClient, currentUser);
    },
  });
}

export function useSignUpMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SignUpInput) => signUpWithEmail(input),
    retry: false,
    onSuccess: (currentUser) => {
      setCurrentUserCache(queryClient, currentUser);
    },
  });
}

export function useSignOutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOut,
    retry: false,
    onSuccess: () => {
      const cachedCurrentUser = queryClient.getQueryData<CurrentUserResult>(authKeys.currentUser());
      const viewerId = getAuthenticatedViewerId(cachedCurrentUser);

      queryClient.removeQueries({
        queryKey: authKeys.currentUser(),
        exact: true,
      });

      if (viewerId) {
        queryClient.removeQueries({
          queryKey: postKeys.viewerSaves(viewerId),
          exact: true,
        });
      }
    },
  });
}

export function useRetryInitializeProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryInitializeCurrentUserProfile,
    retry: false,
    onSuccess: (currentUser) => {
      setCurrentUserCache(queryClient, currentUser);
    },
  });
}
