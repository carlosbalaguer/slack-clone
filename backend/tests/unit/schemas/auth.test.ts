import { describe, it, expect } from 'vitest';
import { magicLinkSchema, refreshTokenSchema, verifyMagicLinkSchema } from '../../../src/schemas/auth.schema.js';

describe('Auth Schemas', () => {
  describe('magicLinkSchema', () => {
    it('should accept valid email', () => {
      const data = { email: 'test@example.com' };
      const result = magicLinkSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('should reject invalid email format', () => {
      const data = { email: 'invalid-email' };
      const result = magicLinkSchema.safeParse(data);

      expect(result.success).toBe(false);
      // ⭐ Fix: Verificar que result.error existe
      if (!result.success) {
        expect(result.error.issues).toBeDefined();
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('should reject missing email', () => {
      const data = {};
      const result = magicLinkSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject empty email', () => {
      const data = { email: '' };
      const result = magicLinkSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should accept email with subdomain', () => {
      const data = { email: 'user@mail.example.com' };
      const result = magicLinkSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should accept email with plus sign', () => {
      const data = { email: 'user+tag@example.com' };
      const result = magicLinkSchema.safeParse(data);

      expect(result.success).toBe(true);
    });
  });

  describe('verifyMagicLinkSchema', () => {
    it('should accept valid email and code', () => {
      const data = {
        email: 'test@example.com',
        code: '123456',
      };
      const result = verifyMagicLinkSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
        expect(result.data.code).toBe('123456');
      }
    });

    it('should reject code with wrong length (too short)', () => {
      const data = {
        email: 'test@example.com',
        code: '12345',
      };
      const result = verifyMagicLinkSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject code with wrong length (too long)', () => {
      const data = {
        email: 'test@example.com',
        code: '1234567',
      };
      const result = verifyMagicLinkSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject missing code', () => {
      const data = {
        email: 'test@example.com',
      };
      const result = verifyMagicLinkSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const data = {
        email: 'invalid-email',
        code: '123456',
      };
      const result = verifyMagicLinkSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should accept numeric code', () => {
      const data = {
        email: 'test@example.com',
        code: '999999',
      };
      const result = verifyMagicLinkSchema.safeParse(data);

      expect(result.success).toBe(true);
    });
  });

  describe('refreshTokenSchema', () => {
    it('should accept valid refresh token', () => {
      const data = { refreshToken: 'valid_token_abc123' };
      const result = refreshTokenSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.refreshToken).toBe('valid_token_abc123');
      }
    });

    it('should reject empty refresh token', () => {
      const data = { refreshToken: '' };
      const result = refreshTokenSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject missing refresh token', () => {
      const data = {};
      const result = refreshTokenSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should accept long refresh token', () => {
      const longToken = 'a'.repeat(500);
      const data = { refreshToken: longToken };
      const result = refreshTokenSchema.safeParse(data);

      expect(result.success).toBe(true);
    });
  });
});