import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import * as fs from "fs";

// --- Config ---
const config = new pulumi.Config();

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
// Read the bundled output as a string (produced by wrangler/esbuild in CI)
const bundledCode = fs.readFileSync("../dist/index.js", "utf-8");

const workerScript = new cloudflare.WorkerScript("ai-search-chat-agent", {
  accountId: accountId,
  name: "ai-search-chat-agent",
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
});

// --- Outputs ---
// The Worker is automatically available at:
// https://ai-search-chat-agent.<subdomain>.workers.dev
export const workerName = workerScript.name;
export const kvNamespaceId = sessionsNamespace.id;
