# X Agent

The X Agent is a verifiable service that provides AI-powered access to [X (Twitter)](https://x.com) through an encrypted DIDComm chat in [Hologram Messaging](https://hologram.zone).

It uses [x-autonomous-mcp](https://github.com/2060-io/x-autonomous-mcp) as its MCP server to interact with the X API, exposed as an HTTP MCP service via [supergateway](https://github.com/supercorp-ai/supergateway).

## Architecture

The X Agent runs as a "corporate mode" service — a single X account is configured by the operator. Users interact with the agent through Hologram Messaging to compose, review, and publish posts on the configured X account.

```
User ↔ Hologram App ↔ VS Agent (DIDComm) ↔ Chatbot (LLM) ↔ x-autonomous-mcp (MCP/SSE)
                                                                      ↓
                                                                  X API v2
```

## X API Requirements

The X Free tier ($0/month) is sufficient for publishing. You need:

- **OAuth 1.0a** credentials (API Key, API Secret, Access Token, Access Token Secret) — required for write operations (posting, liking, retweeting)
- **OAuth 2.0 Bearer Token** — used for read operations (search, lookup)

Get credentials at: https://developer.x.com/en/portal/dashboard

## Safety Rails

`x-autonomous-mcp` includes built-in budget limits to prevent runaway posting:

| Variable | Default | Description |
|----------|---------|-------------|
| `X_MCP_MAX_ORIGINALS` | 10 | Max original tweets per session |
| `X_MCP_MAX_REPLIES` | 8 | Max replies per session |
| `X_MCP_MAX_LIKES` | 20 | Max likes per session |
| `X_MCP_MAX_RETWEETS` | 5 | Max retweets per session |
| `X_MCP_MAX_FOLLOWS` | 10 | Max follows per session |
| `X_MCP_MAX_UNFOLLOWS` | 10 | Max unfollows per session |
| `X_MCP_MAX_DELETES` | 5 | Max deletes per session |

## Local Development

```bash
# 1. Run setup (deploys VS Agent + ngrok tunnel + Service credential)
source x-agent/config.env
./x-agent/scripts/setup.sh

# 2. Start the full stack
export NGROK_DOMAIN=your-domain.ngrok-free.app
export OPENAI_API_KEY=sk-...
export X_API_KEY=your-key
export X_API_SECRET=your-secret
export X_ACCESS_TOKEN=your-token
export X_ACCESS_TOKEN_SECRET=your-token-secret
export X_BEARER_TOKEN=your-bearer-token
docker compose -f x-agent/docker/docker-compose.yml up
```

## GitHub Actions Secrets

The deployment workflow (`7_deploy-x-agent.yml`) requires these repository secrets:

| Secret | Description |
|--------|-------------|
| `X_AGENT_API_KEY` | X OAuth 1.0a API Key |
| `X_AGENT_API_SECRET` | X OAuth 1.0a API Secret |
| `X_AGENT_ACCESS_TOKEN` | X OAuth 1.0a Access Token |
| `X_AGENT_ACCESS_TOKEN_SECRET` | X OAuth 1.0a Access Token Secret |
| `X_AGENT_BEARER_TOKEN` | X OAuth 2.0 Bearer Token |
| `X_AGENT_OPENAI_API_KEY` | OpenAI API key for the chatbot LLM |
| `X_AGENT_POSTGRES_PASSWORD` | PostgreSQL password |
| `X_AGENT_VSAGENT_DB_PASSWORD` | VS Agent database password |
| `X_AGENT_WALLET_KEY` | VS Agent wallet encryption key |
| `OVH_KUBECONFIG` | Kubernetes config (shared) |
| `K8S_NAMESPACE` | Target namespace (shared) |
| `VS_DEMO_MNEMONIC` | Verana account mnemonic (shared) |
