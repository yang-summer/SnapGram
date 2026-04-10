import { useState } from 'react';
import { Loader2Icon, ShieldAlertIcon, UserRoundSearchIcon } from 'lucide-react';
import { Navigate, useLocation } from 'react-router';
import FullPageState from '~/components/feedback/full-page-state';
import InlineErrorAlert from '~/components/feedback/inline-error-alert';
import { Button } from '~/components/ui/button';
import { useRetryInitializeProfileMutation } from '../queries/auth.mutations';
import { useCurrentUserQuery } from '../queries/auth.queries';

type RequireAuthProps = {
  children: React.ReactNode;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to verify your sign-in status.';
}

function ProfileRecoveryPage() {
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { mutateAsync: retryInitializeProfile, isPending } = useRetryInitializeProfileMutation();
  const recoveryMessage =
    (location.state as { recoveryMessage?: string } | null)?.recoveryMessage ??
    '账号已经登录成功，但用户资料还没有创建完整。你可以重试初始化资料后继续进入系统。';

  async function handleRetry() {
    setSubmitError(null);

    try {
      await retryInitializeProfile();
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  }

  return (
    <FullPageState
      title="个人资料初始化未完成"
      description={recoveryMessage}
      icon={<UserRoundSearchIcon className="size-5" />}
      actions={
        <Button onClick={handleRetry} disabled={isPending}>
          {isPending ? '正在初始化资料...' : '重试初始化资料'}
        </Button>
      }
    >
      {submitError ? <InlineErrorAlert title="初始化失败" message={submitError} /> : null}
    </FullPageState>
  );
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const { data, isPending, isError, error, refetch, isFetching } = useCurrentUserQuery();

  if (isPending && !data) {
    return (
      <FullPageState
        title="正在验证登录状态"
        description="请稍候，我们正在确认你的会话信息。"
        icon={<Loader2Icon className="size-5 animate-spin" />}
      />
    );
  }

  if (isError && !data) {
    return (
      <FullPageState
        title="认证状态加载失败"
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

  if (data?.status === 'guest') {
    return <Navigate to="/sign-in" replace />;
  }

  if (data?.status === 'profile_missing') {
    return <ProfileRecoveryPage />;
  }

  return <>{children}</>;
}
