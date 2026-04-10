import type { ReactNode } from 'react';
import FeedbackShell from './feedback-shell';

type FullPageStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  iconWrapperClassName?: string;
};

export default function FullPageState(props: FullPageStateProps) {
  return <FeedbackShell fullHeight {...props} />;
}
