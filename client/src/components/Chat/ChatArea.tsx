import { useEffect, useRef } from "react";
import { type Message } from "../../types";
import { Message as MessageComponent } from "./Message";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";

interface ChatAreaProps {
	channelName: string;
	memberCount: number;
	messages: Message[];
	typingUsers: string[];
	onSendMessage: (content: string) => void;
	onAddReaction: (messageId: string, emoji: string) => void;
	onOpenThread: (message: Message) => void;
	onTyping: () => void;
}

export function ChatArea({
	channelName,
	memberCount,
	messages,
	typingUsers,
	onSendMessage,
	onAddReaction,
	onOpenThread,
	onTyping,
}: ChatAreaProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	return (
		<div className="main-content">
			<div className="channel-header">
				<div>
					<h2>#{channelName}</h2>
					<p>{memberCount} members</p>
				</div>
			</div>

			<div className="messages-area">
				{messages.map((message) => (
					<MessageComponent
						key={message.id}
						message={message}
						onAddReaction={onAddReaction}
						onOpenThread={onOpenThread}
					/>
				))}
				<div ref={messagesEndRef} />
			</div>

			<TypingIndicator typingUsers={typingUsers} />

			<MessageInput onSendMessage={onSendMessage} onTyping={onTyping} />
		</div>
	);
}
