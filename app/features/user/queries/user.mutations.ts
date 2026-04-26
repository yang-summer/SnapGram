import type { UseMutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateEditableUserProfileWithAvatar } from '../services/user.service';
import type {
  EditableUserProfileViewModel,
  UpdateEditableUserProfileWithAvatarInput,
} from '../types/user.type';
import {
  backfillCurrentUserCache,
  backfillUserProfileCaches,
  cancelUpdatedProfileIdentityQueries,
  invalidateUpdatedProfilePresentationCaches,
} from './user.cache';

type UpdateEditableUserProfileMutationOptions = Omit<
  UseMutationOptions<
    EditableUserProfileViewModel,
    Error,
    UpdateEditableUserProfileWithAvatarInput
  >,
  'mutationFn'
>;

export function useUpdateEditableUserProfileMutation(
  options?: UpdateEditableUserProfileMutationOptions,
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (input: UpdateEditableUserProfileWithAvatarInput) =>
      updateEditableUserProfileWithAvatar(input),
    retry: false,
    ...restOptions,
    onSuccess: async (updatedProfile, variables, onMutateResult, context) => {
      await cancelUpdatedProfileIdentityQueries(queryClient, updatedProfile.id);
      backfillCurrentUserCache(queryClient, updatedProfile);
      backfillUserProfileCaches(queryClient, updatedProfile);
      await invalidateUpdatedProfilePresentationCaches(queryClient, updatedProfile.id);

      await onSuccess?.(updatedProfile, variables, onMutateResult, context);
    },
  });
}
