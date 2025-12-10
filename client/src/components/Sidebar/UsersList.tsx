import { type User } from "../../types";

interface UsersListProps {
	users: User[];
	currentUserId?: string;
}

export function UsersList({ users, currentUserId }: UsersListProps) {
	const statusEmoji = {
		online: "🟢",
		away: "🟡",
		busy: "🔴",
	};

	return (
		<div className="sidebar-section">
			<div className="section-header">
				<span>Direct Messages</span>
			</div>
			<div className="list">
				{users
					.filter((user) => user.id !== currentUserId)
					.map((user) => (
						<div key={user.id} className="list-item">
							<span>
								{statusEmoji[user.status]} {user.username}
							</span>
						</div>
					))}
			</div>
		</div>
	);
}
