const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

interface Entry {
  failures: number;
  windowStart: number;
}

const store = new Map<string, Entry>();

export function isRateLimited(
  key: string,
  maxFailures: number = DEFAULT_MAX_FAILURES,
  windowMs: number = DEFAULT_WINDOW_MS
): { limited: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) return { limited: false, retryAfterMs: 0 };

  if (now - entry.windowStart >= windowMs) {
    store.delete(key);
    return { limited: false, retryAfterMs: 0 };
  }

  if (entry.failures >= maxFailures) {
    return { limited: true, retryAfterMs: windowMs - (now - entry.windowStart) };
  }

  return { limited: false, retryAfterMs: 0 };
}

export function recordFailure(key: string, windowMs: number = DEFAULT_WINDOW_MS): void {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { failures: 1, windowStart: now });
  } else {
    entry.failures++;
  }
}

export function clearAttempts(key: string): void {
  store.delete(key);
}
