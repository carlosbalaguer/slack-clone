interface ChannelsListProps {
	channels: any[];
	currentChannel: string | null;
	onJoinChannel: (channelId: string) => void;
	onCreateChannel: () => void;
}

export function ChannelsList({
	channels,
	currentChannel,
	onJoinChannel,
	onCreateChannel,
}: ChannelsListProps) {
	return (
		<div className="sidebar-section">
			<div className="section-header">
				<span>Channels</span>
				<button onClick={onCreateChannel} title="Create channel">
					+
				</button>
			</div>
			<div className="list">
				{channels.map((channel) => (
					<div
						key={channel.id}
						className={`list-item ${
							currentChannel === channel.id ? "active" : ""
						}`}
						onClick={() => onJoinChannel(channel.id)}
					>
						<span># {channel.name}</span>
						<span className="member-count">
							{channel.memberCount || 0}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
