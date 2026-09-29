import type { Env, SessionData } from "./types";
import { createState, verifyState, createSession } from "./session";

// --- GitHub OAuth helpers ---

export function getRedirectUri(env: Env): string {
  const base = env.APP_BASE_URL || "";
  return `${base}/auth/callback`;
}

export function buildAuthUrl(env: Env, state: string): string {
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: getRedirectUri(env),
    scope: "read:user",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

async function exchangeCode(env: Env, code: string): Promise<string | null> {
  const resp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.access_token ?? null;
}

async function fetchGitHubUser(token: string): Promise<{
  login: string;
  avatar_url: string;
  name: string | null;
} | null> {
  const resp = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "ai-search-chat-agent",
    },
  });
  if (!resp.ok) return null;
  return await resp.json();
}

export async function handleOAuthCallback(
  env: Env,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(renderErrorPage(`GitHub auth error: ${error}`), {
      headers: { "Content-Type": "text/html" },
    });
  }
  if (!code || !state) {
    return new Response(renderErrorPage("Missing code or state parameter"), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const valid = await verifyState(env, state);
  if (!valid) {
    return new Response(renderErrorPage("Invalid OAuth state — possible CSRF attack"), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const token = await exchangeCode(env, code);
  if (!token) {
    return new Response(renderErrorPage("Failed to exchange code for access token"), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }

  const user = await fetchGitHubUser(token);
  if (!user) {
    return new Response(renderErrorPage("Failed to fetch GitHub user profile"), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }

  const sessionData: SessionData = {
    githubLogin: user.login,
    githubAvatar: user.avatar_url,
    githubName: user.name || user.login,
    createdAt: Date.now(),
  };

  const sessionId = await createSession(env, sessionData);

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": `session_id=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
    },
  });
}

export async function handleLogin(env: Env): Promise<Response> {
  const state = await createState(env);
  const authUrl = buildAuthUrl(env, state);
  return new Response(null, {
    status: 302,
    headers: { Location: authUrl },
  });
}

export async function handleLogout(env: Env, request: Request): Promise<Response> {
  const sessionId = request.headers.get("Cookie")?.match(/session_id=([^;]+)/)?.[1];
  if (sessionId) {
    await env.SESSIONS.delete(sessionId);
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": "session_id=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    },
  });
}

function renderErrorPage(message: string): string {
  return `<!html><body style="font-family:system-ui;padding:2rem"><h1>Authentication Error</h1><p>${message}</p><a href="/">← Back to app</a></body></html>`;
}
