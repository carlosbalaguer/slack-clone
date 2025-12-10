import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

describe('Notifications Worker', () => {
  let mockFastify: any;

  beforeEach(() => {
    // Mock Fastify instance
    mockFastify = {
      log: {
        info: vi.fn(),
        error: vi.fn(),
      },
      redis: {
        get: vi.fn(),
        set: vi.fn(),
      },
      supabase: {
        from: vi.fn(),
      },
    };
  });

  describe('handleNotificationJob', () => {
    it('should handle new-message notification', async () => {
      const job = {
        data: {
          type: 'new-message',
          messageId: 'msg-123',
          channelId: 'channel-456',
          userId: 'user-789',
          content: 'Hello!',
        },
      } as Job;

      // Mock channel members
      mockFastify.redis.get.mockResolvedValue(
        JSON.stringify([
          { user_id: 'user-789' }, // sender
          { user_id: 'user-001' },
          { user_id: 'user-002' },
        ])
      );

      const { handleNotificationJob } = await import(
        '../../../src/workers/notifications.worker.js'
      );
      
      const result = await handleNotificationJob(job, mockFastify);

      expect(result.notified).toBe(2); // 3 members - 1 sender
      expect(mockFastify.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Notification to user')
      );
    });

    it('should handle mention notification', async () => {
      const job = {
        data: {
          type: 'mention',
          messageId: 'msg-123',
          mentionedUserId: 'user-mentioned',
          userId: 'user-sender',
          content: '@mentioned check this',
        },
      } as Job;

      // Mock mentioned user
      mockFastify.supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'user-mentioned',
                email: 'mentioned@example.com',
                username: 'mentioned',
              },
            }),
          }),
        }),
      });

      const { handleNotificationJob } = await import(
        '../../../src/workers/notifications.worker.js'
      );
      
      const result = await handleNotificationJob(job, mockFastify);

      expect(result.notified).toBe(1);
      expect(mockFastify.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Mention notification')
      );
    });

    it('should handle channel-invite notification', async () => {
      const job = {
        data: {
          type: 'channel-invite',
          channelId: 'channel-123',
          userId: 'user-456',
        },
      } as Job;

      // Mock user and channel
      mockFastify.supabase.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    email: 'user@example.com',
                    username: 'testuser',
                  },
                }),
              }),
            }),
          };
        }
        if (table === 'channels') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { name: 'general' },
                }),
              }),
            }),
          };
        }
      });

      const { handleNotificationJob } = await import(
        '../../../src/workers/notifications.worker.js'
      );
      
      const result = await handleNotificationJob(job, mockFastify);

      expect(result.notified).toBe(1);
      expect(mockFastify.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Channel invite')
      );
    });

    it('should throw error for unknown notification type', async () => {
      const job = {
        data: {
          type: 'unknown-type',
        },
      } as Job;

      const { handleNotificationJob } = await import(
        '../../../src/workers/notifications.worker.js'
      );

      await expect(
        handleNotificationJob(job, mockFastify)
      ).rejects.toThrow('Unknown notification type: unknown-type');
    });

    it('should return 0 when mentioned user not found', async () => {
      const job = {
        data: {
          type: 'mention',
          messageId: 'msg-123',
          mentionedUserId: 'nonexistent',
          userId: 'user-sender',
        },
      } as Job;

      mockFastify.supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
            }),
          }),
        }),
      });

      const { handleNotificationJob } = await import(
        '../../../src/workers/notifications.worker.js'
      );
      
      const result = await handleNotificationJob(job, mockFastify);

      expect(result.notified).toBe(0);
    });
  });
});