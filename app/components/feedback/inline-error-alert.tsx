import type { ReactNode } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { cn } from '~/lib/utils';

type InlineErrorAlertProps = {
  message: ReactNode;
  title?: string;
  className?: string;
};

export default function InlineErrorAlert({
  message,
  title = 'Unable to continue',
  className,
}: InlineErrorAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-left text-destructive',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-destructive/10 p-1.5">
          <TriangleAlertIcon className="size-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <div className="text-sm leading-6">{message}</div>
        </div>
      </div>
    </div>
  );
}
