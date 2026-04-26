import { useQuery } from '@tanstack/react-query';
import { getEditableUserProfile, getPublicUserProfile } from '../services/user.service';
import { userKeys } from './user.keys';

const USER_PROFILE_STALE_TIME = 30_000;

type UserProfileQueryOptions = {
  enabled?: boolean;
};

export function usePublicUserProfileQuery(
  profileId: string,
  options?: UserProfileQueryOptions,
) {
  const normalizedProfileId = profileId.trim();
  const enabled = normalizedProfileId.length > 0 && (options?.enabled ?? true);

  return useQuery({
    queryKey: userKeys.publicProfile(normalizedProfileId),
    queryFn: () => getPublicUserProfile(normalizedProfileId),
    enabled,
    staleTime: USER_PROFILE_STALE_TIME,
  });
}

export function useEditableUserProfileQuery(
  profileId: string,
  options?: UserProfileQueryOptions,
) {
  const normalizedProfileId = profileId.trim();
  const enabled = normalizedProfileId.length > 0 && (options?.enabled ?? true);

  return useQuery({
    queryKey: userKeys.editableProfile(normalizedProfileId),
    queryFn: () => getEditableUserProfile(normalizedProfileId),
    enabled,
    staleTime: USER_PROFILE_STALE_TIME,
  });
}
