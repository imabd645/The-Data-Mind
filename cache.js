// Simple localStorage-based cache helper
// API: cache.set(key, value, ttlMs), cache.get(key), cache.clear(key)
const cache = {
  set: (key, value, ttlMs = 1000 * 60 * 10) => { // default 10 minutes
    try {
      const payload = {
        ts: Date.now(),
        ttl: ttlMs,
        value: value
      };
      localStorage.setItem(`tdm_cache_${key}`, JSON.stringify(payload));
    } catch (e) {
      console.warn('Cache set failed', e);
    }
  },
  get: (key) => {
    try {
      const raw = localStorage.getItem(`tdm_cache_${key}`);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || !payload.ts) return null;
      if (payload.ttl && (Date.now() - payload.ts) > payload.ttl) {
        localStorage.removeItem(`tdm_cache_${key}`);
        return null;
      }
      return payload.value;
    } catch (e) {
      console.warn('Cache get failed', e);
      return null;
    }
  },
  clear: (key) => {
    try {
      localStorage.removeItem(`tdm_cache_${key}`);
    } catch (e) {
      console.warn('Cache clear failed', e);
    }
  }
};
