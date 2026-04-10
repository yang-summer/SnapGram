import { isRouteErrorResponse, Link, useNavigate } from 'react-router';
import { BadgeAlertIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import FeedbackShell from './feedback-shell';

type RouteErrorStateProps = {
  error: unknown;
  className?: string;
  fullHeight?: boolean;
  homeHref?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
};

type RouteErrorContent = {
  title: string;
  description: string;
  statusLabel?: string;
  stack?: string;
};

function getRouteErrorContent(error: unknown): RouteErrorContent {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        title: 'Page not found',
        description: 'The page you are looking for does not exist or has been moved.',
        statusLabel: '404',
      };
    }

    return {
      title: 'Unable to load this page',
      description: error.statusText || 'An unexpected route error occurred.',
      statusLabel: String(error.status),
    };
  }

  if (error instanceof Error) {
    return {
      title: 'Unable to render this page',
      description: error.message || 'An unexpected error occurred while rendering this route.',
      stack: import.meta.env.DEV ? error.stack : undefined,
    };
  }

  return {
    title: 'Unexpected route error',
    description: 'Something went wrong while loading this route.',
  };
}

export default function RouteErrorState({
  error,
  className,
  fullHeight = false,
  homeHref = '/',
  showBackButton = true,
  showHomeButton = true,
}: RouteErrorStateProps) {
  const navigate = useNavigate();
  const { title, description, statusLabel, stack } = getRouteErrorContent(error);
  const actions = (
    <>
      {showBackButton ? (
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
      ) : null}
      {showHomeButton ? (
        <Button asChild>
          <Link to={homeHref}>Go home</Link>
        </Button>
      ) : null}
    </>
  );

  return (
    <FeedbackShell
      title={title}
      description={description}
      icon={<BadgeAlertIcon className="size-5" />}
      iconWrapperClassName="bg-destructive/10 text-destructive"
      className={cn(fullHeight && 'min-h-screen', className)}
      actions={showBackButton || showHomeButton ? actions : undefined}
      fullHeight={fullHeight}
    >
      {statusLabel ? (
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Status {statusLabel}
        </p>
      ) : null}
      {stack ? (
        <details className="mt-4 rounded-2xl border bg-muted/40 p-4 text-left">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Debug stack
          </summary>
          <pre className="mt-3 overflow-x-auto text-xs leading-6 text-muted-foreground">
            <code>{stack}</code>
          </pre>
        </details>
      ) : null}
    </FeedbackShell>
  );
}
