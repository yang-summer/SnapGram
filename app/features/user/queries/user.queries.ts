import { useQuery } from '@tanstack/react-query';
import { listUserSaveRecords } from '../api/user.api';
import { userKeys } from './user.keys';

const USER_SAVE_RECORDS_STALE_TIME = 30_000;

export function useUserSaveRecordsQuery(profileId: string) {
  return useQuery({
    queryKey: userKeys.saveRecords(profileId),
    queryFn: () => listUserSaveRecords(profileId),
    enabled: profileId.length > 0,
    staleTime: USER_SAVE_RECORDS_STALE_TIME,
  });
}
