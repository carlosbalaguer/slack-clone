import { useAuth } from "../../contexts/AuthContext";
import { type Message as MessageType } from "../../types";

interface MessageProps {
	message: MessageType;
	onAddReaction: (messageId: string, emoji: string) => void;
	onOpenThread: (message: MessageType) => void;
}

export function Message({
	message,
	onAddReaction,
	onOpenThread,
}: MessageProps) {
	const { currentUser } = useAuth();
	const isOwnMessage = message.userId === currentUser?.id;

	const formatTime = (timestamp: number) => {
		return new Date(timestamp).toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<div className="message" data-message-id={message.id}>
			<div className="message-header">
				<span
					className={`message-username ${isOwnMessage ? "own" : ""}`}
				>
					{message.username}
				</span>
				<span className="message-time">
					{formatTime(message.timestamp)}
				</span>
			</div>

			<div className="message-content">{message.content}</div>

			<div className="message-actions">
				<button
					className="message-action-btn"
					onClick={() => onAddReaction(message.id, "👍")}
					title="Like"
				>
					👍
				</button>
				<button
					className="message-action-btn"
					onClick={() => onAddReaction(message.id, "❤️")}
					title="Love"
				>
					❤️
				</button>
				<button
					className="message-action-btn"
					onClick={() => onAddReaction(message.id, "😂")}
					title="Laugh"
				>
					😂
				</button>
				<button
					className="message-action-btn"
					onClick={() => onOpenThread(message)}
					title="Reply in thread"
				>
					💬
				</button>
			</div>

			{Object.keys(message.reactions).length > 0 && (
				<div className="message-reactions">
					{Object.entries(message.reactions).map(([emoji, users]) => (
						<span
							key={emoji}
							className="reaction"
							onClick={() => onAddReaction(message.id, emoji)}
						>
							{emoji} {users.length}
						</span>
					))}
				</div>
			)}

			{message.thread && message.thread.length > 0 && (
				<div
					className="thread-indicator"
					onClick={() => onOpenThread(message)}
				>
					{message.thread.length}{" "}
					{message.thread.length === 1 ? "reply" : "replies"}
				</div>
			)}
		</div>
	);
}
