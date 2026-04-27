import { ExecutionMethod } from 'appwrite';
import type { Models } from 'appwrite';
import { appwriteConfig, functions } from '~/lib/appwrite/config';

type ContentActionHealthcheckRequest = {
  action: 'healthcheck';
};

export type ContentActionExecutionResult = {
  executionId: string;
  status: string;
  statusCode: number;
  responseBodyText: string;
  responseBody: unknown;
};

function parseExecutionResponseBody(responseBody: string): unknown {
  if (!responseBody.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseBody);
  } catch {
    return responseBody;
  }
}

function mapExecutionResult(execution: Models.Execution): ContentActionExecutionResult {
  return {
    executionId: execution.$id,
    status: execution.status,
    statusCode: execution.responseStatusCode,
    responseBodyText: execution.responseBody,
    responseBody: parseExecutionResponseBody(execution.responseBody),
  };
}

async function executeContentAction(
  payload: ContentActionHealthcheckRequest,
): Promise<ContentActionExecutionResult> {
  const execution = await functions.createExecution({
    functionId: appwriteConfig.contentActionsFunctionId,
    body: JSON.stringify(payload),
    async: false,
    xpath: '/',
    method: ExecutionMethod.POST,
    headers: {
      'content-type': 'application/json',
    },
  });

  return mapExecutionResult(execution);
}

export async function runContentActionsHealthcheck(): Promise<ContentActionExecutionResult> {
  return executeContentAction({ action: 'healthcheck' });
}
