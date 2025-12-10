import { describe, it, expect } from 'vitest';
import { updateUserStatusSchema } from '../../../src/schemas/user.schema.js';


describe('Users Schemas', () => {
  describe('updateUserStatusSchema', () => {
    it('should accept "online" status', () => {
      const data = { status: 'online' };
      const result = updateUserStatusSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('online');
      }
    });

    it('should accept "away" status', () => {
      const data = { status: 'away' };
      const result = updateUserStatusSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should accept "busy" status', () => {
      const data = { status: 'busy' };
      const result = updateUserStatusSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should accept "offline" status', () => {
      const data = { status: 'offline' };
      const result = updateUserStatusSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const data = { status: 'invalid' };
      const result = updateUserStatusSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject missing status', () => {
      const data = {};
      const result = updateUserStatusSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject empty status', () => {
      const data = { status: '' };
      const result = updateUserStatusSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject number as status', () => {
      const data = { status: 123 };
      const result = updateUserStatusSchema.safeParse(data);

      expect(result.success).toBe(false);
    });
  });
});