import { useEffect, useState } from "react";
import { useSocket } from "../contexts/SocketContext";
import { type Message } from "../types";

export function useMessages(channelId: string | null) {
	const { socket } = useSocket();
	const [messages, setMessages] = useState<Message[]>([]);

	useEffect(() => {
		if (!socket || !channelId) return;

		socket.on(
			"new-message",
			({ channelId: msgChannelId, message }: any) => {
				if (msgChannelId === channelId) {
					setMessages((prev) => [...prev, message]);
				}
			}
		);

		socket.on("reaction-added", ({ messageId, emoji, userId }: any) => {
			setMessages((prev) =>
				prev.map((msg) => {
					if (msg.id === messageId) {
						const reactions = { ...msg.reactions };
						if (!reactions[emoji]) {
							reactions[emoji] = [];
						}
						if (!reactions[emoji].includes(userId)) {
							reactions[emoji] = [...reactions[emoji], userId];
						}
						return { ...msg, reactions };
					}
					return msg;
				})
			);
		});

		socket.on("reaction-removed", ({ messageId, emoji, userId }: any) => {
			setMessages((prev) =>
				prev.map((msg) => {
					if (msg.id === messageId) {
						const reactions = { ...msg.reactions };
						if (reactions[emoji]) {
							reactions[emoji] = reactions[emoji].filter(
								(id) => id !== userId
							);
							if (reactions[emoji].length === 0) {
								delete reactions[emoji];
							}
						}
						return { ...msg, reactions };
					}
					return msg;
				})
			);
		});

		socket.on("thread-reply", ({ messageId, reply }: any) => {
			setMessages((prev) =>
				prev.map((msg) => {
					if (msg.id === messageId) {
						return { ...msg, thread: [...msg.thread, reply] };
					}
					return msg;
				})
			);
		});

		return () => {
			socket.off("new-message");
			socket.off("reaction-added");
			socket.off("reaction-removed");
			socket.off("thread-reply");
		};
	}, [socket, channelId]);

	const sendMessage = (content: string) => {
		if (!channelId) return;

		socket?.emit(
			"send-message",
			{ channelId, content },
			(response: any) => {
				if (!response.success) {
					console.error("Failed to send message:", response.error);
				}
			}
		);
	};

	const addReaction = (messageId: string, emoji: string) => {
		if (!channelId) return;

		socket?.emit("add-reaction", { channelId, messageId, emoji });
	};

	const sendThreadReply = (
		messageId: string,
		content: string
	): Promise<any> => {
		if (!channelId) return Promise.reject("No channel selected"); // ← retorna Promise

		return new Promise((resolve, reject) => {
			socket?.emit(
				"send-thread-reply",
				{ channelId, messageId, content },
				(response: any) => {
					if (response.success) {
						resolve(response.reply);
					} else {
						reject(response.error);
					}
				}
			);
		});
	};
	return { messages, setMessages, sendMessage, addReaction, sendThreadReply };
}
