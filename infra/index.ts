const workerScript = new cloudflare.WorkerScript("ai-search-chat-agent", {
  accountId: accountId,
  name: "ai-search-chat-agent",
  module: true,
  content: bundledCode,
  compatibilityDate: "2026-09-29",
  compatibilityFlags: ["nodejs_compat"],
  kvNamespaceBindings: [
    {
      name: "SESSIONS",
      namespaceId: sessionsNamespace.id,
    },
  ],
  plainTextBindings: [
    {
      name: "AI_SEARCH_ENDPOINT",
      text: "https://aisearch.openaimp.com",
    },
    {
      name: "APP_NAME",
      text: "AI Search Chat Agent",
    },
  ],
  secretTextBindings: [
    {
      name: "GITHUB_CLIENT_ID",
      text: githubClientId,
    },
    {
      name: "GITHUB_CLIENT_SECRET",
      text: githubClientSecret,
    },
    {
      name: "APP_BASE_URL",
      text: appBaseUrl,
    },
    {
      name: "SESSION_SECRET",
      text: sessionSecret,
    },
  ],
}, { provider });
