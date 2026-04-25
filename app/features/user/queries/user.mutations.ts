import type { UseMutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { updateEditableUserProfileWithAvatar } from '../services/user.service';
import type {
  EditableUserProfileViewModel,
  UpdateEditableUserProfileWithAvatarInput,
} from '../types/user.type';

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
  return useMutation({
    mutationFn: (input: UpdateEditableUserProfileWithAvatarInput) =>
      updateEditableUserProfileWithAvatar(input),
    retry: false,
    ...options,
  });
}
