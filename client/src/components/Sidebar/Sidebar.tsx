import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import { type User } from "../../types";
import { ChannelsList } from "./ChannelsList";
import { UsersList } from "./UsersList";

interface SidebarProps {
	channels: any[];
	users: User[];
	currentChannel: string | null;
	onJoinChannel: (channelId: string) => void;
	onCreateChannel: () => void;
}

export function Sidebar({
	channels,
	users,
	currentChannel,
	onJoinChannel,
	onCreateChannel,
}: SidebarProps) {
	const { currentUser } = useAuth();
	const { socket } = useSocket();
	const [status, setStatus] = useState<"online" | "away" | "busy">("online");

	const handleStatusChange = (newStatus: "online" | "away" | "busy") => {
		setStatus(newStatus);
		socket?.emit("set-status", { status: newStatus });
	};

	return (
		<div className="sidebar">
			<div className="sidebar-header">
				<h2>Workspace</h2>
				<div className="user-info">
					<span>{currentUser?.username}</span>
					<select
						value={status}
						onChange={(e) =>
							handleStatusChange(e.target.value as any)
						}
					>
						<option value="online">🟢 Online</option>
						<option value="away">🟡 Away</option>
						<option value="busy">🔴 Busy</option>
					</select>
				</div>
			</div>

			<ChannelsList
				channels={channels}
				currentChannel={currentChannel}
				onJoinChannel={onJoinChannel}
				onCreateChannel={onCreateChannel}
			/>

			<UsersList users={users} currentUserId={currentUser?.id} />
		</div>
	);
}
