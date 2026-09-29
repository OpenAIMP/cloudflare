export interface Env {
  ASSETS: Fetcher;
  SESSIONS: KVNamespace;
  AI_SEARCH_ENDPOINT: string;
  APP_NAME: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  APP_BASE_URL: string;
  SESSION_SECRET: string;
}

export interface SessionData {
  githubLogin: string;
  githubAvatar: string;
  githubName: string;
  createdAt: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
