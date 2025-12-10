import { describe, it, expect } from 'vitest';

describe('Validation Helpers', () => {
  describe('isValidUUID', () => {
    const isValidUUID = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    it('should return true for valid UUID', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    });

    it('should return false for invalid UUID', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('sanitizeUsername', () => {
    const sanitizeUsername = (username: string): string => {
      return username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    };

    it('should convert to lowercase', () => {
      expect(sanitizeUsername('CARLOS')).toBe('carlos');
    });

    it('should remove special characters', () => {
      expect(sanitizeUsername('carlos@123')).toBe('carlos123');
    });

    it('should remove spaces', () => {
      expect(sanitizeUsername('carlos balaguer')).toBe('carlosbalaguer');
    });
  });
});