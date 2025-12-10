import { describe, it, expect } from 'vitest';

describe('Cache Helpers', () => {
  describe('generateCacheKey', () => {
    const generateCacheKey = (prefix: string, ...parts: string[]): string => {
      return [prefix, ...parts].join(':');
    };

    it('should generate key with prefix and parts', () => {
      expect(generateCacheKey('messages', 'channel', '123')).toBe('messages:channel:123');
    });

    it('should handle single part', () => {
      expect(generateCacheKey('user', '456')).toBe('user:456');
    });
  });

  describe('parseCacheValue', () => {
    const parseCacheValue = <T>(value: string | null): T | null => {
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    };

    it('should parse valid JSON', () => {
      const json = JSON.stringify({ id: '123' });
      const result = parseCacheValue<{ id: string }>(json);
      expect(result?.id).toBe('123');
    });

    it('should return null for invalid JSON', () => {
      expect(parseCacheValue('invalid')).toBeNull();
    });
  });
});