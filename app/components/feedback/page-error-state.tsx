import type { ReactNode } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import FeedbackShell from './feedback-shell';

type PageErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export default function PageErrorState({
  title = 'Something went wrong',
  description = 'We could not load this content. Please try again.',
  onRetry,
  retryLabel = 'Retry',
  isRetrying = false,
  action,
  children,
  className,
}: PageErrorStateProps) {
  const actions = (
    <>
      {action}
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? 'Retrying...' : retryLabel}
        </Button>
      ) : null}
    </>
  );

  return (
    <FeedbackShell
      title={title}
      description={description}
      icon={<TriangleAlertIcon className="size-5" />}
      iconWrapperClassName="bg-destructive/10 text-destructive"
      className={className}
      actions={action || onRetry ? actions : undefined}
    >
      {children}
    </FeedbackShell>
  );
}
