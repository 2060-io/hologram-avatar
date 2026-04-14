# Hologram Verifiable Services

A collection of Verifiable Services (VS) deployed via GitHub Actions to Kubernetes, showcasing AI agents, credential issuers, and chatbots within the Hologram + Verana ecosystem.

**Landing page:** [vs.hologram.zone](https://vs.hologram.zone)

## Architecture

```
organization   ← Trust anchor (ECS credentials, Trust Registry, schema)
├── avatar        ← Issues credentials via DIDComm chatbot
├── passport      ← Passport credential issuer (NFC + liveness)
├── github-agent  ← AI-powered GitHub assistant with MCP integration
├── wise-agent    ← AI-powered Wise assistant with MCP integration
└── playground    ← Landing page (vs.hologram.zone)
```

**organization** is the trust anchor: it obtains Organization + Service credentials from the ECS Trust Registry, creates its own Trust Registry with a custom schema, and registers an AnonCreds credential definition.

Child services obtain a **Service credential** from organization, making their identity and permissions publicly verifiable on the Verana blockchain.

## Services

| Service | Role | Ingress | Chart |
|---------|------|---------|-------|
| `organization` | Trust anchor | `organization.vs.hologram.zone` | `vs-agent-chart` |
| `avatar` | Credential issuer (chatbot) | `avatar.vs.hologram.zone` | `vs-agent-chart` |
| `passport` | Credential issuer (NFC + liveness) | `passport.vs.hologram.zone` | `vs-agent-chart` |
| `github-agent` | AI agent + MCP | `github-agent.vs.hologram.zone` | `hologram-generic-ai-agent-chart` |
| `wise-agent` | AI agent + MCP | `wise-agent.vs.hologram.zone` | `hologram-generic-ai-agent-chart` |
| `playground` | Landing page | `vs.hologram.zone` | — (raw K8s) |

## Directory Structure

```
hologram-verifiable-services/
  common/               # Shared shell helpers
  organization/         # Trust anchor (workflow 1)
  avatar/               # Credential issuer chatbot (workflow 2)
  github-agent/         # GitHub AI agent with MCP (workflow 3)
  wise-agent/           # Wise AI agent with MCP (workflow 4)
  passport/             # Passport credential issuer (workflow 5)
  playground/           # Landing page (workflow 6)
```

Each service directory follows the same structure:

```
<service>/
  config.env            # Configuration for local dev and CI/CD
  deployment.yaml       # Helm chart values for K8s deployment
  agent-pack.yaml       # Agent pack definition (github-agent, wise-agent)
  scripts/
    setup.sh            # Full local setup (deploy agent, get credentials)
    start.sh            # Start the service locally
  docker/
    docker-compose.yml  # Local dev containers (VS Agent + dependencies)
```

## GitHub Actions Workflows

Workflows are numbered to indicate deployment order. **Run them in order** when setting up a new ecosystem.

| # | Workflow | Steps |
|---|---------|-------|
| 1 | Deploy Organization | `deploy` · `get-ecs-credentials` · `create-trust-registry` · `all` |
| 2 | Deploy Avatar | `deploy` · `get-credentials` · `deploy-chatbot` · `all` |
| 3 | Deploy GitHub Agent | `deploy` · `get-credentials` · `all` |
| 4 | Deploy Wise Agent | `deploy` · `get-credentials` · `all` |
| 5 | Deploy Passport | `deploy` · `get-credentials` · `deploy-chatbot` · `all` |
| 6 | Deploy Playground | — (triggered on push to main) |

### Deployment

1. Run workflows **in order** from GitHub Actions (manual dispatch on `main` branch)
2. Each workflow validates the branch, deploys via Helm, and obtains credentials automatically

### Ingresses

All services are deployed under the `vs.hologram.zone` domain:

- `organization.vs.hologram.zone` — Organization Agent
- `avatar.vs.hologram.zone` — Avatar VS Agent + Chatbot
- `passport.vs.hologram.zone` — Passport Issuer VS Agent + Chatbot
- `github-agent.vs.hologram.zone` — GitHub Agent VS Agent + Chatbot
- `wise-agent.vs.hologram.zone` — Wise Agent VS Agent + Chatbot
- `vs.hologram.zone` — Playground landing page

## Local Development

### Prerequisites

- Docker and Docker Compose
- ngrok (authenticated)
- `curl`, `jq`

### 1. Start organization

```bash
source organization/config.env
./organization/scripts/setup.sh
```

### 2. Start a child service

**Avatar (credential issuer):**

```bash
source avatar/config.env
./avatar/scripts/setup.sh
./avatar/scripts/start.sh
```

**GitHub Agent (AI agent):**

```bash
source github-agent/config.env
export OPENAI_API_KEY=sk-...
./github-agent/scripts/setup.sh
./github-agent/scripts/start.sh
```

**Passport Issuer (credential issuer):**

```bash
source passport/config.env
./passport/scripts/setup.sh
./passport/scripts/start.sh
```

**Wise Agent (AI agent):**

```bash
source wise-agent/config.env
export OPENAI_API_KEY=sk-...
./wise-agent/scripts/setup.sh
./wise-agent/scripts/start.sh
```

> **Note:** Only one ngrok tunnel can run at a time on the free plan. For local development with multiple services, deploy organization to K8s first, then point child services to its public URL via `ORG_VS_PUBLIC_URL` and `ORG_VS_ADMIN_URL`.

## Shared Code

- `common/common.sh` — Shared shell helpers (logging, network config, VS Agent API, schema discovery, credential issuance/linking, CLI account setup)
