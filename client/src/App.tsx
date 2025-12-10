import { useEffect, useState } from "react";
import "./App.css";
import { LoginScreen } from "./components/Auth/LoginScreen";
import { ChatArea } from "./components/Chat/ChatArea";
import { CreateChannelModal } from "./components/Modals/CreateChannelModal";
import { ThreadModal } from "./components/Modals/ThreadModal";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { AuthProvider } from "./contexts/AuthContext";
import { SocketProvider, useSocket } from "./contexts/SocketContext";
import { useChannels } from "./hooks/useChannels";
import { useMessages } from "./hooks/useMessages";
import { useTyping } from "./hooks/useTyping";
import type { Channel, Message, User } from "./types";

function AppContent() {
	const { socket } = useSocket();
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [currentChannel, setCurrentChannel] = useState<string | null>(null);
	const [currentChannelName, setCurrentChannelName] = useState("");
	const [memberCount, setMemberCount] = useState(0);
	const [users, setUsers] = useState<User[]>([]);
	const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
	const [threadMessage, setThreadMessage] = useState<Message | null>(null);

	const { channels, createChannel } = useChannels();
	const { messages, setMessages, sendMessage, addReaction, sendThreadReply } =
		useMessages(currentChannel);
	const { typingUsers, startTyping } = useTyping(currentChannel);

	useEffect(() => {
		if (!socket) return;

		socket.on("users-update", (updatedUsers: User[]) => {
			setUsers(updatedUsers);
		});

		socket.on("user-joined-channel", ({ username }: any) => {
			console.log(`${username} joined the channel`);
		});

		socket.on("user-left-channel", ({ username }: any) => {
			console.log(`${username} left the channel`);
		});

		return () => {
			socket.off("users-update");
			socket.off("user-joined-channel");
			socket.off("user-left-channel");
		};
	}, [socket]);

	const handleLogin = () => {
		setIsLoggedIn(true);
		// Auto-join general channel
		setTimeout(() => joinChannel("general"), 100);
	};

	const joinChannel = (channelId: string) => {
		socket?.emit("join-channel", { channelId }, (response: any) => {
			if (response.success) {
				setCurrentChannel(channelId);
				setCurrentChannelName(channelId);
				setMessages(response.messages);
				setMemberCount(response.members.length);
			}
		});
	};

	const handleCreateChannel = async (name: string, description: string) => {
		try {
			const channel = await createChannel(name, description);
			joinChannel((channel as Channel).id);
		} catch (error) {
			alert(error);
		}
	};

	if (!isLoggedIn) {
		return <LoginScreen onLogin={handleLogin} />;
	}

	return (
		<div className="app">
			<Sidebar
				channels={channels}
				users={users}
				currentChannel={currentChannel}
				onJoinChannel={joinChannel}
				onCreateChannel={() => setShowCreateChannelModal(true)}
			/>

			<ChatArea
				channelName={currentChannelName}
				memberCount={memberCount}
				messages={messages}
				typingUsers={typingUsers}
				onSendMessage={sendMessage}
				onAddReaction={addReaction}
				onOpenThread={setThreadMessage}
				onTyping={startTyping}
			/>

			{showCreateChannelModal && (
				<CreateChannelModal
					onClose={() => setShowCreateChannelModal(false)}
					onCreateChannel={handleCreateChannel}
				/>
			)}

			{threadMessage && (
				<ThreadModal
					message={threadMessage}
					onClose={() => setThreadMessage(null)}
					onSendReply={sendThreadReply}
				/>
			)}
		</div>
	);
}

export default function App() {
	return (
		<SocketProvider>
			<AuthProvider>
				<AppContent />
			</AuthProvider>
		</SocketProvider>
	);
}
