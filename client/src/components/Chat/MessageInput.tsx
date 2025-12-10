import { useState } from "react";

interface MessageInputProps {
	onSendMessage: (content: string) => void;
	onTyping: () => void;
}

export function MessageInput({ onSendMessage, onTyping }: MessageInputProps) {
	const [content, setContent] = useState("");

	const handleSend = () => {
		if (!content.trim()) return;

		onSendMessage(content);
		setContent("");
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setContent(e.target.value);
		onTyping();
	};

	return (
		<div className="message-input-container">
			<input
				type="text"
				value={content}
				onChange={handleChange}
				onKeyPress={handleKeyPress}
				placeholder="Type a message..."
			/>
			<button onClick={handleSend}>Send</button>
		</div>
	);
}
