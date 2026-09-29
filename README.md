# Cloudflare AI Search Chat Agent

Chat agent on Cloudflare Workers with GitHub OAuth, AI Search proxy, and Pulumi IaC.

## Architecture

```
Browser → Worker (auth check) → GitHub OAuth (login)
                             → AI Search /chat/completions (proxy)
                             → Static chat UI (served from assets)
```

- **Frontend**: Single-page chat UI served as a static asset
- **Backend**: Worker script handling OAuth flow + AI Search proxy
- **Auth**: GitHub OAuth 2.0 with HMAC-signed state (CSRF protection)
- **Sessions**: Stored in Workers KV with 7-day TTL, HttpOnly cookies
- **AI Search**: Proxied to `https://aisearch.openaimp.com/chat/completions`
- **IaC**: Pulumi manages the Worker, KV namespace, secrets, and route
- **CI/CD**: GitHub Actions bundles with Wrangler/esbuild, deploys via Pulumi

## Quick Start

### 1. Clone and push to your repo

```bash
git clone <command-from-card>
cd ai-search-chat-agent
git remote set-url origin https://github.com/OpenAIMP/cloudflare.git
git push -u origin main
```

### 2. Add GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions** → **New repository secret**:

| Secret Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Create at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) using the "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | `1e7e9bb45eca8d59ec86bbd6dac9b900` |
| `GH_CLIENT_ID` | From your [GitHub OAuth App](https://github.com/settings/applications/new) (GitHub reserves the GITHUB_ prefix) |
| `GH_CLIENT_SECRET` | From your GitHub OAuth App |
| `APP_BASE_URL` | `https://ai-search-chat-agent.<your-subdomain>.workers.dev` (check [Workers subdomain](https://dash.cloudflare.com/1e7e9bb45eca8d59ec86bbd6dac9b900/workers/subdomain)) |
| `SESSION_SECRET` | Any random 32+ character string (e.g. `openssl rand -hex 32`) |
| `PULUMI_CONFIG_PASSPHRASE` | Any passphrase to encrypt Pulumi state (e.g. `openssl rand -base64 24`) |

### 3. GitHub OAuth App Setup

Create at [github.com/settings/applications/new](https://github.com/settings/applications/new):
- **Homepage URL**: `https://ai-search-chat-agent.<your-subdomain>.workers.dev`
- **Callback URL**: `https://ai-search-chat-agent.<your-subdomain>.workers.dev/auth/callback`

### 4. Auto-deploy

Every push to `main` triggers the GitHub Actions workflow which:
1. Installs dependencies
2. Bundles the Worker with Wrangler (dry-run) or esbuild
3. Sets Pulumi config (Cloudflare credentials, OAuth secrets)
4. Runs `pulumi preview` then `pulumi up` — creates KV namespace, deploys Worker, sets all secrets

## Local Development

### Worker

```bash
npm install
npm run dev
```

Create a `.dev.vars` file:
```
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
APP_BASE_URL=http://localhost:8787
SESSION_SECRET=your_random_secret_string
```

### Pulumi (local preview)

```bash
cd infra
npm install

# Set config
pulumi config set cloudflare:accountId 1e7e9bb45eca8d59ec86bbd6dac9b900
pulumi config set cloudflare:apiToken <your-api-token> --secret
pulumi config set githubClientId <your-github-client-id> --secret
pulumi config set githubClientSecret <your-github-client-secret> --secret
pulumi config set appBaseUrl https://ai-search-chat-agent.<your-subdomain>.workers.dev
pulumi config set sessionSecret <random-string> --secret

# Preview changes
pulumi preview

# Deploy
pulumi up
```

## API Endpoints

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/` | GET | No | Login page (if not authed) or chat UI (if authed) |
| `/auth/login` | GET | No | Redirects to GitHub OAuth |
| `/auth/callback` | GET | No | OAuth callback handler |
| `/auth/logout` | GET | No | Clears session and redirects to `/` |
| `/api/me` | GET | Yes | Returns current user info |
| `/api/chat` | POST | Yes | Proxies to AI Search chat/completions |
| `/api/search` | POST | Yes | Proxies to AI Search search |

## File Structure

```
cloudflare/
├── .github/workflows/
│   ├── ci.yml              # Type check + Pulumi preview on PRs
│   └── deploy.yml          # Bundle + Pulumi up on push to main
├── infra/                  # Pulumi IaC
│   ├── Pulumi.yaml         # Pulumi project config
│   ├── Pulumi.dev.yaml     # Dev environment
│   ├── index.ts            # Pulumi program (Worker, KV, secrets, route)
│   ├── package.json        # Pulumi dependencies
│   └── tsconfig.json
├── wrangler.jsonc          # Wrangler config (for local dev + bundling)
├── package.json
├── tsconfig.json
├── public/
│   └── index.html          # Chat UI (static asset)
└── src/
    ├── index.ts            # Main Worker entry point + routing
    ├── oauth.ts            # GitHub OAuth flow
    ├── session.ts          # KV session management + state signing
    ├── chat.ts             # AI Search proxy handlers
    └── types.ts            # TypeScript interfaces
```

## Pulumi Resources

The Pulumi program (`infra/index.ts`) manages:

| Resource | Type | Description |
|---|---|---|
| `sessions-kv` | `cloudflare.WorkersKvNamespace` | KV namespace for session storage |
| `ai-search-chat-agent` | `cloudflare.WorkerScript` | The Worker script with all bindings |
| `worker-dev-route` | `cloudflare.WorkerDomain` | workers.dev route for the Worker |

### Bindings configured by Pulumi

| Binding | Type | Source |
|---|---|---|
| `SESSIONS` | KV namespace | Pulumi-created `sessions-kv` |
| `ASSETS` | Assets | Static assets from `public/` (bundled with Wrangler) |
| `AI_SEARCH_ENDPOINT` | Plain text | `https://aisearch.openaimp.com` |
| `APP_NAME` | Plain text | `AI Search Chat Agent` |
| `GITHUB_CLIENT_ID` | Secret | Pulumi config (encrypted) |
| `GITHUB_CLIENT_SECRET` | Secret | Pulumi config (encrypted) |
| `APP_BASE_URL` | Secret | Pulumi config (encrypted) |
| `SESSION_SECRET` | Secret | Pulumi config (encrypted) |
