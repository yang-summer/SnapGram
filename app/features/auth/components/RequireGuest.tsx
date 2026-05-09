import { Loader2Icon, ShieldAlertIcon } from 'lucide-react';
import { Navigate } from 'react-router';
import FullPageState from '~/components/feedback/full-page-state';
import { Button } from '~/components/ui/button';
import { useCurrentUserQuery } from '../queries/auth.queries';

type RequireGuestProps = {
  children: React.ReactNode;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to verify guest access.';
}

export default function RequireGuest({ children }: RequireGuestProps) {
  const { data, isPending, isError, error, refetch, isFetching } = useCurrentUserQuery();

  if (isPending && !data) {
    return (
      <FullPageState
        title="正在验证登录状态"
        description="请稍候，我们正在确认当前访客状态。"
        icon={<Loader2Icon className="size-5 animate-spin" />}
      />
    );
  }

  if (isError && !data) {
    return (
      <FullPageState
        title="访客状态验证失败"
        description={getErrorMessage(error)}
        icon={<ShieldAlertIcon className="size-5" />}
        iconWrapperClassName="bg-destructive/10 text-destructive"
        actions={
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? '正在重试...' : '重试'}
          </Button>
        }
      />
    );
  }

  if (data?.status === 'authenticated' || data?.status === 'profile_missing') {
    return <Navigate to="/feed" replace />;
  }

  return <>{children}</>;
}
