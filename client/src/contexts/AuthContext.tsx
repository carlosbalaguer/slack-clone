import { createContext, type ReactNode, useContext, useState } from "react";

interface AuthContextType {
	currentUser: { id: string; username: string } | null;
	setCurrentUser: (user: { id: string; username: string } | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [currentUser, setCurrentUser] = useState<{
		id: string;
		username: string;
	} | null>(null);

	return (
		<AuthContext.Provider value={{ currentUser, setCurrentUser }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return context;
}
