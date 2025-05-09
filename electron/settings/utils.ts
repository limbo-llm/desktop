import fs from "node:fs";
import { SETTINGS_PATH } from "./constants";
import { settingsSchema, type Settings } from "./schemas";

const defaultSettings: Settings = {
	developerMode: false,
} as const;

export function writeSettings(settings: Settings) {
	fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings));
}

export function readSettings(): Settings {
	if (!fs.existsSync(SETTINGS_PATH)) {
		writeSettings(defaultSettings);

		return defaultSettings;
	}

	const settingsStr = fs.readFileSync(SETTINGS_PATH, "utf8");

	try {
		const settingsRaw = JSON.parse(settingsStr);
		const settings = settingsSchema.parse(settingsRaw);

		return settings;
	} catch (error) {
		writeSettings(defaultSettings);

		return defaultSettings;
	}
}
