import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { postKeys } from '~/features/post/queries/post.keys';
import {
  retryInitializeCurrentUserProfile,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from '../services/auth.service';
import type {
  CurrentUserResult,
  GuestCurrentUserResult,
  SignInInput,
  SignUpInput,
} from '../types/auth.type';
import { authKeys } from './auth.keys';

const GUEST_CURRENT_USER_RESULT: GuestCurrentUserResult = {
  status: 'guest',
  account: null,
  user: null,
};

function setCurrentUserCache(
  queryClient: ReturnType<typeof useQueryClient>,
  currentUser: CurrentUserResult,
) {
  queryClient.setQueryData(authKeys.currentUser(), currentUser);
}

function getAuthenticatedViewerProfileId(currentUser: CurrentUserResult | undefined): string | null {
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
      const viewerProfileId = getAuthenticatedViewerProfileId(cachedCurrentUser);

      setCurrentUserCache(queryClient, GUEST_CURRENT_USER_RESULT);

      if (viewerProfileId) {
        queryClient.removeQueries({
          queryKey: postKeys.viewerLikes(viewerProfileId),
          exact: true,
        });

        queryClient.removeQueries({
          queryKey: postKeys.viewerSaves(viewerProfileId),
          exact: true,
        });
      }

      toast.success('You have been signed out.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to sign out. Please try again.');
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
