import { AppwriteException } from 'appwrite';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '../services/auth.service';
import { authKeys } from './auth.keys';

const CURRENT_USER_STALE_TIME = 60_000;

function shouldRetryCurrentUserQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof AppwriteException && error.code === 401) {
    return false;
  }

  return failureCount < 1;
}

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: getCurrentUser,
    retry: shouldRetryCurrentUserQuery,
    staleTime: CURRENT_USER_STALE_TIME,
  });
}
