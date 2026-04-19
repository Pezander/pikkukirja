const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface Entry {
  failures: number;
  windowStart: number;
}

const store = new Map<string, Entry>();

export function isRateLimited(key: string): { limited: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) return { limited: false, retryAfterMs: 0 };

  if (now - entry.windowStart >= WINDOW_MS) {
    store.delete(key);
    return { limited: false, retryAfterMs: 0 };
  }

  if (entry.failures >= MAX_FAILURES) {
    return { limited: true, retryAfterMs: WINDOW_MS - (now - entry.windowStart) };
  }

  return { limited: false, retryAfterMs: 0 };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    store.set(key, { failures: 1, windowStart: now });
  } else {
    entry.failures++;
  }
}

export function clearAttempts(key: string): void {
  store.delete(key);
}
