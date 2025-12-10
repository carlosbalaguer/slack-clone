export interface User {
	id: string;
	username: string;
	status: "online" | "away" | "busy";
}

export interface Channel {
	id: string;
	name: string;
	description: string;
	members: string[];
	memberCount: number;
}

export interface Message {
	id: string;
	channelId: string;
	userId: string;
	username: string;
	content: string;
	timestamp: number;
	reactions: Record<string, string[]>;
	thread: ThreadReply[];
}

export interface ThreadReply {
	id: string;
	userId: string;
	username: string;
	content: string;
	timestamp: number;
}
