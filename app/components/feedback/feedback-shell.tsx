import type { ReactNode } from 'react';
import { cn } from '~/lib/utils';

type FeedbackShellProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  iconWrapperClassName?: string;
  fullHeight?: boolean;
};

export default function FeedbackShell({
  title,
  description,
  icon,
  children,
  actions,
  className,
  contentClassName,
  iconWrapperClassName,
  fullHeight = false,
}: FeedbackShellProps) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-center px-6 py-10',
        fullHeight ? 'min-h-screen' : 'min-h-80',
        className,
      )}
    >
      <div
        className={cn(
          'w-full max-w-lg rounded-3xl border bg-card p-8 text-center shadow-sm',
          contentClassName,
        )}
      >
        {icon ? (
          <div
            className={cn(
              'mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground',
              iconWrapperClassName,
            )}
          >
            {icon}
          </div>
        ) : null}

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-card-foreground">{title}</h1>
          {description ? (
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {children ? <div className="mt-5">{children}</div> : null}
        {actions ? <div className="mt-6 flex justify-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
