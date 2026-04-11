import { Platform } from "react-native";

const ENV_API_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

function defaultApiUrl(): string {
	if (Platform.OS === "android") {
		// Android emulator routes localhost through 10.0.2.2
		return "http://10.0.2.2:8000";
	}
	return "http://localhost:8000";
}

export const BACKEND_BASE_URL = ENV_API_URL || defaultApiUrl();

export const API_PREFIX = "/api/v1";
