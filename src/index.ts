import type { Env } from "./types";
import { getSessionId, getSession, setSessionCookie } from "./session";
import { handleLogin, handleLogout, handleOAuthCallback } from "./oauth";
import { handleChat, handleSearch } from "./chat";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- Public routes (no auth needed) ---
    if (path === "/auth/login") {
      return handleLogin(env);
    }

    if (path === "/auth/callback") {
      return handleOAuthCallback(env, request);
    }

    if (path === "/auth/logout") {
      return handleLogout(env, request);
    }

    // --- API routes (require auth) ---
    if (path === "/api/chat" || path === "/api/search") {
      const session = await requireAuth(request, env);
      if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (path === "/api/chat") {
        return handleChat(env, request);
      }
      return handleSearch(env, request);
    }

    // --- API: current user info (require auth) ---
    if (path === "/api/me") {
      const session = await requireAuth(request, env);
      if (!session) {
        return new Response(JSON.stringify({ authenticated: false }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          authenticated: true,
          login: session.githubLogin,
          name: session.githubName,
          avatar: session.githubAvatar,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // --- Everything else: serve static assets (the chat UI) ---
    // Check auth for the main page; if not authenticated, show login page
    const session = await requireAuth(request, env);

    if (path === "/" || path === "/index.html") {
      if (!session) {
        return new Response(renderLoginPage(env), {
          headers: { "Content-Type": "text/html" },
        });
      }
      // Serve the chat app with user info injected
      const asset = await env.ASSETS.fetch(request);
      if (asset.ok) {
        // Inject user data via a header that the client reads
        const html = await asset.text();
        const userScript = `<script>window.__USER__=${JSON.stringify({
          login: session.githubLogin,
          name: session.githubName,
          avatar: session.githubAvatar,
        })}</script>`;
        const modified = html.replace("</head>", `${userScript}</head>`);
        return new Response(modified, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Set-Cookie": setSessionCookie(getSessionId(request)!),
          },
        });
      }
    }

    // For all other static assets, just serve them
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

// --- Auth helper ---

async function requireAuth(
  request: Request,
  env: Env
): Promise<ReturnType<typeof getSession> extends Promise<infer T> ? T : never> {
  const sessionId = getSessionId(request);
  if (!sessionId) return null as any;
  return (await getSession(env, sessionId)) as any;
}

// --- Login page (server-rendered, no framework needed) ---

function renderLoginPage(env: Env): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${env.APP_NAME} — Sign In</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .login-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 3rem;
      text-align: center;
      max-width: 400px;
      width: 90%;
    }
    .login-card h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .login-card p {
      color: #8b949e;
      margin-bottom: 2rem;
    }
    .github-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #238636;
      color: white;
      text-decoration: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      transition: background 0.2s;
    }
    .github-btn:hover { background: #2ea043; }
    .github-btn svg { width: 20px; height: 20px; fill: white; }
  </style>
</head>
<body>
  <div class="login-card">
    <h1>${env.APP_NAME}</h1>
    <p>Sign in with GitHub to start chatting with your AI Search instance.</p>
    <a href="/auth/login" class="github-btn">
      <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
      </svg>
      Sign in with GitHub
    </a>
  </div>
</body>
</html>`;
}
