import { useState } from "react";
import { type Message } from "../../types";

interface ThreadModalProps {
	message: Message;
	onClose: () => void;
	onSendReply: (messageId: string, content: string) => Promise<any>;
}

export function ThreadModal({
	message,
	onClose,
	onSendReply,
}: ThreadModalProps) {
	const [replyContent, setReplyContent] = useState("");

	const handleSendReply = async () => {
		if (!replyContent.trim()) return;

		await onSendReply(message.id, replyContent);
		setReplyContent("");
	};

	const formatTime = (timestamp: number) => {
		return new Date(timestamp).toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<div className="modal" onClick={onClose}>
			<div
				className="modal-content thread-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="thread-header">
					<h3>Thread</h3>
					<button onClick={onClose}>✕</button>
				</div>

				<div className="thread-parent">
					<div className="message-header">
						<span className="message-username">
							{message.username}
						</span>
					</div>
					<div className="message-content">{message.content}</div>
				</div>

				<div className="thread-replies">
					{message.thread.map((reply) => (
						<div key={reply.id} className="thread-reply">
							<div className="message-header">
								<span className="message-username">
									{reply.username}
								</span>
								<span className="message-time">
									{formatTime(reply.timestamp)}
								</span>
							</div>
							<div className="message-content">
								{reply.content}
							</div>
						</div>
					))}
				</div>

				<div className="thread-input-container">
					<input
						type="text"
						value={replyContent}
						onChange={(e) => setReplyContent(e.target.value)}
						onKeyPress={(e) =>
							e.key === "Enter" && handleSendReply()
						}
						placeholder="Reply..."
					/>
					<button onClick={handleSendReply}>Reply</button>
				</div>
			</div>
		</div>
	);
}
