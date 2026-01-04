/**
 * Wait helper for eventual consistency in integration tests
 * Polls a function until it returns a truthy value or timeout
 */

export interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
  description?: string;
}

/**
 * Wait for a condition to become true
 * @param fn Function that returns a truthy value when condition is met
 * @param options Wait options
 * @returns The result of fn() when condition is met
 * @throws Error if timeout is reached
 */
export async function waitFor<T>(
  fn: () => Promise<T | null | false | undefined>,
  options: WaitOptions = {}
): Promise<T> {
  const {
    timeoutMs = 10000,
    intervalMs = 500,
    description = 'Condition',
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await fn();
    
    if (result) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `${description} did not become true within ${timeoutMs}ms`
  );
}

/**
 * Wait for a specific amount of time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

