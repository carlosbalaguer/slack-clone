import { useEffect, useState } from "react";
import { useSocket } from "../contexts/SocketContext";
import { type Channel } from "../types";

export function useChannels() {
	const { socket } = useSocket();
	const [channels, setChannels] = useState<Channel[]>([]);

	useEffect(() => {
		if (!socket) return;

		socket.on("channels_update", (updatedChannels: Channel[]) => {
			setChannels(updatedChannels);
		});

		socket.on("channel_created", (channel: Channel) => {
			console.log("New channel created:", channel.name);
		});

		return () => {
			socket.off("channels_update");
			socket.off("channel_created");
		};
	}, [socket]);

	const createChannel = (name: string, description: string) => {
		return new Promise((resolve, reject) => {
			socket?.emit(
				"create_channel",
				{ name, description },
				(response: any) => {
					if (response.success) {
						resolve(response.channel);
					} else {
						reject(response.error);
					}
				}
			);
		});
	};

	return { channels, setChannels, createChannel };
}
