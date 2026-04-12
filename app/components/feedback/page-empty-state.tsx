import type { ReactNode } from 'react';
import { InboxIcon } from 'lucide-react';
import FeedbackShell from './feedback-shell';

type PageEmptyStateProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export default function PageEmptyState({
  title = 'Nothing here yet',
  description = 'There is no content to show right now.',
  icon = <InboxIcon className="size-5" />,
  action,
  children,
  className,
}: PageEmptyStateProps) {
  return (
    <FeedbackShell
      title={title}
      description={description}
      icon={icon}
      className={className}
      actions={action}
    >
      {children}
    </FeedbackShell>
  );
}
