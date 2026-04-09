import { Navigate } from 'react-router';
import { useCurrentUserQuery } from '../queries/auth.queries';

type RequireGuestProps = {
  children: React.ReactNode;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to verify guest access.';
}

export default function RequireGuest({ children }: RequireGuestProps) {
  const { data, isPending, isError, error } = useCurrentUserQuery();

  if (isPending && !data) {
    return <main className="p-6">正在验证登录状态...</main>;
  }

  if (isError && !data) {
    return <main className="p-6">{getErrorMessage(error)}</main>;
  }

  if (data?.status === 'authenticated' || data?.status === 'profile_missing') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
