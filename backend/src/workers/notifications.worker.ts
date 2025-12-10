import type { Job } from "bullmq";
import type { FastifyInstance } from "fastify";

interface NotificationJobData {
  type: "new-message" | "mention" | "channel-invite";
  messageId?: string;
  channelId?: string;
  userId?: string;
  mentionedUserId?: string;
  content?: string;
}

export async function handleNotificationJob(
  job: Job<NotificationJobData>,
  fastify: FastifyInstance
) {
  const { type, messageId, channelId, userId, mentionedUserId, content } =
    job.data;

  switch (type) {
    case "new-message":
      return await sendNewMessageNotification(
        { messageId, channelId, userId, content },
        fastify
      );

    case "mention":
      return await sendMentionNotification(
        { messageId, mentionedUserId, userId, content },
        fastify
      );

    case "channel-invite":
      return await sendChannelInviteNotification(
        { channelId, userId },
        fastify
      );

    default:
      throw new Error(`Unknown notification type: ${type}`);
  }
}

async function sendNewMessageNotification(
  data: any,
  fastify: FastifyInstance
) {
  const { messageId, channelId, userId, content } = data;

  // Get all users in channel (from cache or DB)
  const cacheKey = `channel:${channelId}:members`;
  let members = await fastify.redis.get(cacheKey);

  if (!members) {
    const { data: channelMembers } = await fastify.supabase
      .from("channel_members")
      .select("user_id")
      .eq("channel_id", channelId);

    members = JSON.stringify(channelMembers || []);
    await fastify.redis.set(cacheKey, members, "EX", 300); // 5 min cache
  }

  const membersList = JSON.parse(members);

  // Send notification to each member (except sender)
  for (const member of membersList) {
    if (member.user_id === userId) continue;

    // In production, send push notification / email
    // For now, just log
    fastify.log.info(
      `📩 Notification to user ${member.user_id}: New message in channel`
    );

    // You could also emit Socket.IO event
    // io.to(member.user_id).emit('notification', { ... });
  }

  return { notified: membersList.length - 1 };
}

async function sendMentionNotification(data: any, fastify: FastifyInstance) {
  const { messageId, mentionedUserId, userId, content } = data;

  // Get mentioned user details
  const { data: user } = await fastify.supabase
    .from("users")
    .select("email, username")
    .eq("id", mentionedUserId)
    .single();

  if (!user) return { notified: 0 };

  fastify.log.info(
    `📩 Mention notification to ${user.username}: ${content}`
  );

  // In production: Send push notification, email, etc.
  // For now, just log

  return { notified: 1 };
}

async function sendChannelInviteNotification(
  data: any,
  fastify: FastifyInstance
) {
  const { channelId, userId } = data;

  // Get user and channel details
  const { data: user } = await fastify.supabase
    .from("users")
    .select("email, username")
    .eq("id", userId)
    .single();

  const { data: channel } = await fastify.supabase
    .from("channels")
    .select("name")
    .eq("id", channelId)
    .single();

  if (!user || !channel) return { notified: 0 };

  fastify.log.info(
    `📩 Channel invite to ${user.username}: ${channel.name}`
  );

  return { notified: 1 };
}