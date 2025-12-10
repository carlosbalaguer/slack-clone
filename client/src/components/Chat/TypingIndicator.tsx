interface TypingIndicatorProps {
	typingUsers: string[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
	if (typingUsers.length === 0) return null;

	let text;
	if (typingUsers.length === 1) {
		text = `${typingUsers[0]} is typing...`;
	} else if (typingUsers.length === 2) {
		text = `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
	} else {
		text = `${typingUsers[0]}, ${typingUsers[1]}, and ${
			typingUsers.length - 2
		} others are typing...`;
	}

	return <div className="typing-indicator">{text}</div>;
}
