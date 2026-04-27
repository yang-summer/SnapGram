export type FunctionRequest = {
  method: string;
  path: string;
  bodyText?: string;
  headers: Record<string, string | undefined>;
};

export type FunctionResponse = {
  json: (body: unknown, statusCode?: number, headers?: Record<string, string>) => unknown;
};

export type FunctionContext = {
  req: FunctionRequest;
  res: FunctionResponse;
  log: (message: string) => void;
  error: (message: string) => void;
};

export function getHeader(headers: Record<string, string | undefined>, name: string): string {
  const expectedName = name.toLowerCase();
  const matchedHeader = Object.entries(headers).find(
    ([headerName]) => headerName.toLowerCase() === expectedName,
  );

  return matchedHeader?.[1] ?? '';
}
