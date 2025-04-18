import { Link } from "@tanstack/react-router";
import { MessageSquareIcon, SettingsIcon } from "lucide-react";
import "./side-dock.scss";

export const SideDock = () => {
	return (
		<div className="side-dock">
			<Link to="/" className="side-dock-item">
				<MessageSquareIcon size={20} />
			</Link>
			<Link to="/settings" className="side-dock-item">
				<SettingsIcon size={20} />
			</Link>
		</div>
	);
};
