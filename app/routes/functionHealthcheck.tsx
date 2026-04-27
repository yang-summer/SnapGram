import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  type ContentActionExecutionResult,
  runContentActionsHealthcheck,
} from '~/features/post/api/post.actions.api';

function formatResult(result: ContentActionExecutionResult | null): string {
  if (!result) {
    return '';
  }

  return JSON.stringify(result, null, 2);
}

export default function FunctionHealthcheck() {
  const [result, setResult] = useState<ContentActionExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function handleRunHealthcheck() {
    setIsRunning(true);
    setErrorMessage(null);

    try {
      const nextResult = await runContentActionsHealthcheck();
      setResult(nextResult);
    } catch (error) {
      setResult(null);
      setErrorMessage(error instanceof Error ? error.message : 'Function healthcheck failed.');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-10 md:px-8 lg:p-14">
      <div className="flex flex-col gap-2">
        <h2 className="text-left">Function Healthcheck</h2>
        <p className="text-sm text-ink-subtle">
          Runs the content-actions function with the current Appwrite session.
        </p>
      </div>

      <div>
        <Button type="button" onClick={handleRunHealthcheck} disabled={isRunning}>
          {isRunning ? 'Running...' : 'Run healthcheck'}
        </Button>
      </div>

      {errorMessage ? (
        <pre className="overflow-auto rounded-lg border bg-card p-4 text-sm text-destructive">
          {errorMessage}
        </pre>
      ) : null}

      {result ? (
        <pre className="overflow-auto rounded-lg border bg-card p-4 text-sm">
          {formatResult(result)}
        </pre>
      ) : null}
    </div>
  );
}
