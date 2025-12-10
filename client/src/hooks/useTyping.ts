import { useEffect, useRef, useState } from "react";
import { useSocket } from "../contexts/SocketContext";

export function useTyping(channelId: string | null) {
	const { socket } = useSocket();
	const [typingUsers, setTypingUsers] = useState<string[]>([]);
	const typingTimeoutRef = useRef<number | undefined>(undefined);
	useEffect(() => {
		if (!socket || !channelId) return;

		socket.on("user-typing", ({ username }: { username: string }) => {
			setTypingUsers((prev) => {
				if (!prev.includes(username)) {
					return [...prev, username];
				}
				return prev;
			});

			// Clear after 3 seconds
			setTimeout(() => {
				setTypingUsers((prev) =>
					prev.filter((user) => user !== username)
				);
			}, 3000);
		});

		socket.on("user-stopped-typing", ({ userId }: { userId: string }) => {
			// Would need to track userId -> username mapping
		});

		return () => {
			socket.off("user-typing");
			socket.off("user-stopped-typing");
		};
	}, [socket, channelId]);

	const startTyping = () => {
		if (!channelId) return;

		socket?.emit("typing-start", { channelId });

		// Clear previous timeout
		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current);
		}

		// Auto-stop after 3 seconds
		typingTimeoutRef.current = setTimeout(() => {
			socket?.emit("typing-stop", { channelId });
		}, 3000);
	};

	return { typingUsers, startTyping };
}
