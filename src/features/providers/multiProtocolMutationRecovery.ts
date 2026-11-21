export class MultiProtocolPartialMutationError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(
      cause instanceof Error ? cause.message : String(cause ?? 'MultiProtocol mutation failed')
    );
    this.name = 'MultiProtocolPartialMutationError';
    this.cause = cause;
  }
}

export const isMultiProtocolPartialMutationError = (
  error: unknown
): error is MultiProtocolPartialMutationError => error instanceof MultiProtocolPartialMutationError;

export async function runMultiProtocolMutationWithRecovery<T>(
  action: () => Promise<T>,
  refresh: () => Promise<unknown>
): Promise<T> {
  try {
    return await action();
  } catch (error: unknown) {
    try {
      await refresh();
    } catch {
      // Preserve the original mutation error; refresh is best-effort recovery.
    }
    throw new MultiProtocolPartialMutationError(error);
  }
}
