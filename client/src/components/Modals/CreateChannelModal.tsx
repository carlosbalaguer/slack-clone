import { useState } from "react";

interface CreateChannelModalProps {
	onClose: () => void;
	onCreateChannel: (name: string, description: string) => void;
}

export function CreateChannelModal({
	onClose,
	onCreateChannel,
}: CreateChannelModalProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");

	const handleCreate = () => {
		if (!name.trim()) {
			alert("Please enter a channel name");
			return;
		}

		onCreateChannel(name, description);
		onClose();
	};

	return (
		<div className="modal" onClick={onClose}>
			<div className="modal-content" onClick={(e) => e.stopPropagation()}>
				<h3>Create Channel</h3>
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Channel name"
				/>
				<input
					type="text"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Description (optional)"
				/>
				<div className="modal-buttons">
					<button onClick={onClose}>Cancel</button>
					<button onClick={handleCreate}>Create</button>
				</div>
			</div>
		</div>
	);
}
