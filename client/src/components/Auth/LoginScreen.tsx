import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";

interface LoginScreenProps {
	onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
	const { socket } = useSocket();
	const { setCurrentUser } = useAuth();
	const [username, setUsername] = useState("");
	const [error, setError] = useState("");

	const handleLogin = () => {
		if (!username.trim()) {
			setError("Please enter a username");
			return;
		}

		socket?.emit("auth", { username }, (response: any) => {
			if (response.success) {
				setCurrentUser(response.user);
				onLogin();
			} else {
				setError(response.error);
			}
		});
	};

	return (
		<div className="login-screen">
			<div className="login-box">
				<h1>🚀 Slack Clone</h1>
				<input
					type="text"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					onKeyPress={(e) => e.key === "Enter" && handleLogin()}
					placeholder="Enter your username"
					maxLength={20}
				/>
				{error && <p className="error">{error}</p>}
				<button onClick={handleLogin}>Join Chat</button>
			</div>
		</div>
	);
}
