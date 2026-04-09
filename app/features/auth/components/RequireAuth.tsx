import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Button } from '~/components/ui/button';
import { useRetryInitializeProfileMutation } from '../queries/auth.mutations';
import { useCurrentUserQuery } from '../queries/auth.queries';

type RequireAuthProps = {
  children: React.ReactNode;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to initialize your profile.';
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
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-lg rounded-2xl border p-8 text-center">
        <h1 className="text-2xl font-semibold">个人资料初始化未完成</h1>
        <p className="mt-3 text-sm opacity-80">{recoveryMessage}</p>
        {submitError ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {submitError}
          </div>
        ) : null}
        <div className="mt-6 flex justify-center">
          <Button onClick={handleRetry} disabled={isPending}>
            {isPending ? '正在初始化资料...' : '重试初始化资料'}
          </Button>
        </div>
      </div>
    </main>
  );
}

function AuthErrorFallback({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-lg rounded-2xl border p-8 text-center">
        <h1 className="text-2xl font-semibold">认证状态加载失败</h1>
        <p className="mt-3 text-sm opacity-80">{message}</p>
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? '正在重试...' : '重试'}
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const { data, isPending, isError, error, refetch, isFetching } = useCurrentUserQuery();

  if (isPending && !data) {
    return <main className="p-6">正在验证登录状态...</main>;
  }

  if (isError && !data) {
    return (
      <AuthErrorFallback
        message={getErrorMessage(error)}
        onRetry={() => void refetch()}
        isRetrying={isFetching}
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
