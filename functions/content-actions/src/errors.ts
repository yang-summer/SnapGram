export class ContentActionError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ContentActionError';
  }
}
