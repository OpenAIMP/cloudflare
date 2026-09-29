import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

// --- Config ---
const config = new pulumi.Config();

// Required config values (set via `pulumi config set`)
// pulumi config set cloudflare:accountId <your-account-id>
// pulumi config set cloudflare:apiToken <your-api-token>  --secret
// pulumi config set githubClientId <your-github-oauth-client-id>  --secret
// pulumi config set githubClientSecret <your-github-oauth-client-secret>  --secret
// pulumi config set appBaseUrl https://ai-search-chat-agent.<your-subdomain>.workers.dev
// pulumi config set sessionSecret <random-32-char-string>  --secret

const accountId = config.require("cloudflare:accountId");
const githubClientId = config.requireSecret("githubClientId");
const githubClientSecret = config.requireSecret("githubClientSecret");
const appBaseUrl = config.require("appBaseUrl");
const sessionSecret = config.requireSecret("sessionSecret");

// --- KV Namespace for sessions ---
const sessionsNamespace = new cloudflare.WorkersKvNamespace("sessions-kv", {
  accountId: accountId,
  title: "SESSIONS",
});

// --- Worker Script ---
// The bundled Worker code is produced by `npx wrangler deploy --dry-run` or esbuild.
// Pulumi uploads the bundled script content.
const workerScript = new cloudflare.WorkerScript("ai-search-chat-agent", {
  accountId: accountId,
  name: "ai-search-chat-agent",
  // The bundled output from wrangler/esbuild (see GitHub Actions workflow)
  content: new pulumi.asset.FileAsset("../dist/index.js"),
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
});

// --- Workers.dev subdomain route ---
// Enable the workers.dev route so the Worker is accessible at
// https://ai-search-chat-agent.<subdomain>.workers.dev
const workersDevRoute = new cloudflare.WorkerDomain("worker-dev-route", {
  accountId: accountId,
  hostname: "ai-search-chat-agent",
  service: "ai-search-chat-agent",
  environment: "production",
});

// --- Outputs ---
export const workerName = workerScript.name;
export const kvNamespaceId = sessionsNamespace.id;
export const workerUrl = pulumi.interpolate`https://ai-search-chat-agent.${workersDevRoute.hostname}.workers.dev`;
