// DESTINATION: engine/src/lib/cache.ts
// Lightweight in-memory TTL cache used for course module and material lists.
// Degrades gracefully — a cache miss is never an error.
// Invalidated explicitly on all write operations (create/update/delete).
// Do NOT use for data that must be real-time (progress, grades, submissions).

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class SimpleCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private defaultTtlSeconds: number;

  constructor(defaultTtlSeconds = 60) {
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds ?? this.defaultTtlSeconds) * 1000;
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  // Delete all keys matching a prefix — useful for course-scoped invalidation
  delPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  // Periodic cleanup to avoid unbounded memory growth in long-running processes
  // Call once on server start: moduleCache.startCleanup()
  startCleanup(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
    return setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (now > entry.expiresAt) this.store.delete(key);
      }
    }, intervalMs);
  }

  size(): number {
    return this.store.size;
  }
}

// Single shared cache instance for module lists.
// Key pattern:  modules:<courseId>:student
// TTL: 60 seconds — short enough that a lecturer publishing a module shows quickly.
export const moduleCache = new SimpleCache<unknown>(60);

// Call this once in your server startup (app.ts or server.ts):
// moduleCache.startCleanup()