import type { ReactNode } from 'react';
import { Loader2Icon } from 'lucide-react';
import FeedbackShell from './feedback-shell';

type PageLoadingStateProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
};

export default function PageLoadingState({
  title = 'Loading content',
  description = 'Please wait while we prepare this page.',
  icon = <Loader2Icon className="size-5 animate-spin" />,
  className,
}: PageLoadingStateProps) {
  return <FeedbackShell title={title} description={description} icon={icon} className={className} />;
}
