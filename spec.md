# Verana Demos — Specification

## 1. Overview

This repository provides a suite of demo services for the Verana network. Each service is independently configurable, can run locally, and can be deployed to Kubernetes via GitHub Actions.

### Services

| # | Service | Status | Description |
|---|---------|--------|-------------|
| 1 | **Issuer Service VS-Agent** | ✅ Existing | Deploy a VS Agent, obtain ECS credentials, create a Trust Registry |
| 2 | **Issuer Chatbot Service** | 🔲 New | Hologram chatbot that issues credentials using the issuer VS-Agent |
| 3 | **Web Verifier Service** | 🔲 New | Mini website that requests and displays credential presentations via QR code |
| 4 | **Chatbot Verifier Service** | 🔲 New | Hologram chatbot that requests and displays credential presentations |

All services support **devnet** and **testnet**.

### End-User Prerequisite

Users (credential holders) need **Hologram Messaging** to interact with the chatbot services and to store/present credentials.

---

## 2. Proposed Repository Structure

```text
vs/
├── config.env              # Shared configuration (org, service, TR, AnonCreds)
├── deployment.yaml         # Helm chart values for the Issuer VS-Agent
├── schema.json             # Custom credential schema
├── issuer-chatbot.env      # Issuer Chatbot config overrides
├── web-verifier.env        # Web Verifier config overrides
└── verifier-chatbot.env    # Chatbot Verifier config overrides

scripts/vs-demo/
├── common.sh                       # Shared helpers (existing)
├── 01-deploy-vs.sh                 # Deploy Issuer VS-Agent (existing)
├── 02-get-ecs-credentials.sh       # Obtain ECS credentials (existing)
└── 03-create-trust-registry.sh     # Create Trust Registry (existing)

issuer-chatbot/
├── src/                            # Application source (TypeScript)
│   ├── index.ts                    # Entry point
│   ├── config.ts                   # Configuration loader
│   ├── schema-reader.ts            # Read & parse schema attributes from VS-Agent
│   ├── session-store.ts            # Persistent session/connection storage
│   ├── chatbot.ts                  # Conversation state machine
│   ├── vs-agent-client.ts          # VS-Agent admin API client
│   └── webhooks.ts                 # Webhook event handlers (connection, message)
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md

web-verifier/
├── src/
│   ├── server/                     # Backend (TypeScript)
│   │   ├── index.ts                # Entry point (Express server)
│   │   ├── config.ts               # Configuration loader
│   │   ├── vs-agent-client.ts      # VS-Agent admin API client
│   │   └── routes.ts               # API routes (create OOB, get presentation result)
│   └── client/                     # Frontend (static HTML + JS)
│       ├── index.html              # Single-page app
│       ├── style.css               # Styling
│       └── app.js                  # QR rendering, polling, result display
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md

verifier-chatbot/
├── src/                            # Application source (TypeScript)
│   ├── index.ts                    # Entry point
│   ├── config.ts                   # Configuration loader
│   ├── session-store.ts            # Persistent session/connection storage
│   ├── chatbot.ts                  # Conversation state machine
│   ├── vs-agent-client.ts          # VS-Agent admin API client
│   └── webhooks.ts                 # Webhook event handlers
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md

.github/workflows/
├── deploy-vs-demo.yml              # Issuer VS-Agent workflow (existing)
├── deploy-issuer-chatbot.yml       # Issuer Chatbot workflow (new)
├── deploy-web-verifier.yml         # Web Verifier workflow (new)
└── deploy-verifier-chatbot.yml     # Chatbot Verifier workflow (new)
```

---

## 3. Service 1 — Issuer Service VS-Agent (Existing)

### What Exists

- **Local deployment**: Docker + ngrok (`01-deploy-vs.sh`)
- **ECS credentials**: Auto-discovery of ECS VTJSC, Organization credential from ECS TR, self-issued Service credential (`02-get-ecs-credentials.sh`)
- **Trust Registry creation**: On-chain TR + custom schema + root/issuer permissions + VTJSC + optional AnonCreds cred def (`03-create-trust-registry.sh`)
- **CI/CD**: `deploy-vs-demo.yml` — workflow_dispatch with steps: `deploy`, `get-ecs-credentials`, `create-trust-registry`, `all`
- **Shared helpers**: `common.sh` — logging, tx helpers, API helpers, ECS discovery, credential issuance/linking, permission helpers, duplicate detection

### Required Change

- **`ENABLE_ANONCREDS` must default to `"true"`** in `vs/config.env` so that the Issuer Chatbot can issue AnonCreds credentials out of the box.

---

## 4. Service 2 — Issuer Chatbot Service (New)

### Purpose

A conversational chatbot (via Hologram Messaging) that connects to the Issuer Service VS-Agent and issues credentials to users based on the custom schema defined in `vs/schema.json`.

### Architecture

```text
┌─────────────────┐     webhook events      ┌────────────────────────┐
│   VS-Agent      │ ──────────────────────►  │   Issuer Chatbot       │
│   (Issuer)      │                          │                        │
│                 │ ◄──────────────────────  │  • Session store (DB)  │
│  Admin API      │     send messages /      │  • Schema reader       │
│  :3000          │     issue credentials    │  • Conversation FSM    │
└─────────────────┘                          └────────────────────────┘
                                                       ▲
                                                       │ Hologram
                                                       │ Messaging
                                                       ▼
                                              ┌────────────────┐
                                              │   User (Holder) │
                                              │   Hologram App   │
                                              └────────────────┘
```

### Configuration

| Variable | Source | Description |
|----------|--------|-------------|
| `VS_AGENT_ADMIN_URL` | `issuer-chatbot.env` | URL of the Issuer VS-Agent admin API (e.g., `http://localhost:3000`) |
| `CHATBOT_PORT` | `issuer-chatbot.env` | Port for the chatbot webhook server (default: `4000`) |
| `SERVICE_NAME` | `vs/config.env` | Used as the contextual menu title: `$SERVICE_NAME Issuer` |
| `ENABLE_ANONCREDS` | `vs/config.env` | Must be `true` — chatbot uses AnonCreds for issuance |
| `DATABASE_URL` | `issuer-chatbot.env` | Connection string for session persistence (SQLite for local, PostgreSQL for K8s) |

### VS-Agent Interaction

The chatbot registers itself as a **webhook receiver** on the VS-Agent. The VS-Agent forwards events to the chatbot's HTTP endpoints.

#### Webhook Endpoints (chatbot receives from VS-Agent)

| Endpoint | Event | Action |
|----------|-------|--------|
| `POST /connection-state-updated` | New connection completed | Start new session, send welcome message + contextual menu |
| `POST /message-received` | User sends text or menu selection | Route to conversation state machine |

#### VS-Agent API Calls (chatbot calls VS-Agent)

| API Call | Purpose |
|----------|---------|
| `GET /v1/agent` | Get agent DID and metadata |
| `GET /v1/vt/json-schema-credentials` | Discover the custom schema VTJSC and extract attribute list |
| `POST /v1/vt/issue-credential` | Issue a credential with collected attributes |
| `POST /messages` | Send text messages, contextual menu updates, and credential offers to the user |

### Schema Attribute Discovery

On startup, the chatbot:

1. Calls `GET /v1/vt/json-schema-credentials` on the VS-Agent
2. Identifies the custom VTJSC (the one whose `schemaId` matches the issuer's custom VPR ref, not the ECS org/service VTJSCs)
3. Fetches the full JSON schema from the VTJSC's `credentialSubject.jsonSchema`
4. Extracts the list of `credentialSubject.properties` (excluding `id`) and their `required` status
5. Stores the ordered attribute list for the conversation flow

### Conversation State Machine

```text
                 ┌─────────────────┐
  connection ──► │    WELCOME       │
                 │  send welcome    │
                 │  send menu       │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  COLLECT_ATTRS   │◄──────────────┐
                 │  prompt for      │               │
                 │  attribute[i]    │  next attr     │
                 └────────┬────────┘───────────────┘
                          │ all collected
                          ▼
                 ┌─────────────────┐
                 │  ISSUE           │
                 │  call VS-Agent   │
                 │  issue-credential│
                 │  send credential │
                 │  to user         │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │    DONE          │
                 │  "Credential     │
                 │   issued!"       │
                 │  menu: "new      │
                 │   credential"    │
                 └─────────────────┘
```

**States:**

1. **WELCOME** — On new connection: send welcome text, send contextual menu, transition to COLLECT_ATTRS.
2. **COLLECT_ATTRS** — Prompt the user for attribute `i`. On receiving a text response, store the value, increment `i`. Repeat until all required attributes are collected.
3. **ISSUE** — Build the claims JSON from collected attributes. Call `POST /v1/vt/issue-credential` on the VS-Agent. Send the resulting credential to the user via AnonCreds credential offer. Transition to DONE.
4. **DONE** — Send confirmation message. Wait for menu interaction.

**Menu transitions:**
- **"abort"** (shown during COLLECT_ATTRS) → reset session to WELCOME, discard collected attributes
- **"new credential"** (shown in DONE) → reset session to COLLECT_ATTRS

### Contextual Menu

The contextual menu **must be resent with every message** sent to the user.

| State | Menu Title | Menu Entries |
|-------|-----------|--------------|
| COLLECT_ATTRS | `$SERVICE_NAME Issuer` | `abort` — Cancel current flow |
| DONE | `$SERVICE_NAME Issuer` | `new credential` — Start a new credential issuance |

### Session Persistence

- Each `connectionId` maps to a session record in the database.
- Session fields: `connectionId`, `state` (enum), `currentAttributeIndex`, `collectedAttributes` (JSON), `createdAt`, `updatedAt`.
- If the service restarts, existing sessions resume from their persisted state.
- Use SQLite for local execution, PostgreSQL for K8s.

### Credential Issuance Flow

1. Chatbot collects all schema attributes from the user.
2. Chatbot builds a claims object: `{ id: <user_connection_did>, attr1: "val1", attr2: "val2", ... }`.
3. Chatbot calls `POST /v1/vt/issue-credential` on the VS-Agent with:
   - `format`: `"anoncreds"` (since `ENABLE_ANONCREDS=true`)
   - `did`: the user's connection DID
   - `jsonSchemaCredentialId`: the VTJSC URL discovered at startup
   - `claims`: the collected attributes
4. The VS-Agent issues the credential and delivers it to the user via DIDComm.

---

## 5. Service 3 — Web Verifier Service (New)

### Purpose

A mini configurable website that displays a QR code containing an OOB (Out-of-Band) presentation request. The user scans the QR code with Hologram Messaging, presents a credential issued by the Issuer Service, and the verified attributes are displayed on the website.

### Architecture

```text
┌───────────────────┐         ┌──────────────────────┐
│   Web Browser     │ ◄─────► │   Web Verifier       │
│                   │  HTTP   │   Backend             │
│  • QR code        │         │                       │
│  • Result display │         │  • Express server     │
│  • "Start over"   │         │  • VS-Agent client    │
└───────────────────┘         └──────────┬───────────┘
                                         │ Admin API
                                         ▼
                              ┌──────────────────────┐
                              │   VS-Agent            │
                              │   (Verifier)          │
                              │                       │
                              │  • Embedded in service│
                              │  • OOB invitations    │
                              │  • Proof verification │
                              └──────────────────────┘
                                         ▲
                                         │ DIDComm
                                         ▼
                              ┌──────────────────────┐
                              │   User (Holder)       │
                              │   Hologram App        │
                              └──────────────────────┘
```

### Configuration

| Variable | Source | Description |
|----------|--------|-------------|
| `VS_AGENT_ADMIN_URL` | `web-verifier.env` | URL of the embedded VS-Agent admin API |
| `VERIFIER_PORT` | `web-verifier.env` | Port for the web server (default: `4001`) |
| `SERVICE_NAME` | `vs/config.env` | Displayed on the web page header |
| `CUSTOM_SCHEMA_BASE_ID` | `vs/config.env` | Schema to request in the presentation |

### Embedded VS-Agent

The Web Verifier Service **embeds its own VS-Agent** (separate from the Issuer VS-Agent). This is deployed as a sidecar container in K8s or a second Docker container locally. The web verifier backend communicates with its own VS-Agent via the admin API.

### User Experience Flow

1. User opens the web verifier URL in a browser.
2. The page displays:
   - Service name header
   - A QR code encoding an OOB presentation request invitation
   - Instructions: "Scan with Hologram Messaging to present your credential"
3. The backend generates the OOB invitation via the VS-Agent API and renders it as a QR code.
4. The frontend polls the backend for presentation results.
5. When the user scans the QR code and presents their credential:
   - The VS-Agent verifies the presentation.
   - The VS-Agent sends a webhook event to the backend.
   - The backend stores the verified attributes.
   - The frontend poll receives the result and displays all credential attributes on screen.
6. A **"Start Over"** button resets the page to step 2, generating a new OOB invitation.

### Backend API Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET /` | Serve the single-page frontend | |
| `POST /api/invitation` | Create a new OOB presentation request invitation via VS-Agent; return invitation URL and session ID | |
| `GET /api/result/:sessionId` | Poll for presentation result; returns `{ status: "pending" }` or `{ status: "verified", attributes: {...} }` | |
| `POST /webhooks/proof-received` | Webhook from VS-Agent — proof presentation received and verified | |

### Frontend

- Single HTML page with embedded CSS and JavaScript (no framework required; keep it minimal).
- Uses a QR code library (e.g., `qrcode` npm package) to render the OOB invitation URL.
- Polls `GET /api/result/:sessionId` every 2 seconds.
- On result received: hides QR code, displays a card with all credential attributes.
- **"Start Over"** button: calls `POST /api/invitation` to get a new invitation, re-renders QR code.

### Proof Request

The backend constructs a presentation request targeting the custom schema:

1. Calls the VS-Agent API to create an OOB proof request for the credential type matching `CUSTOM_SCHEMA_BASE_ID`.
2. The VS-Agent generates a DIDComm OOB invitation URL.
3. The backend returns this URL to the frontend for QR code rendering.

---

## 6. Service 4 — Chatbot Verifier Service (New)

### Purpose

A conversational chatbot (via Hologram Messaging) that requests the presentation of a credential previously issued by the Issuer Service, then displays the verified attributes back to the user.

### Architecture

Same pattern as the Issuer Chatbot but focused on verification instead of issuance. The Chatbot Verifier **embeds its own VS-Agent** (separate from the Issuer).

```text
┌─────────────────┐     webhook events      ┌────────────────────────┐
│   VS-Agent      │ ──────────────────────►  │   Verifier Chatbot     │
│   (Verifier)    │                          │                        │
│                 │ ◄──────────────────────  │  • Session store (DB)  │
│  Admin API      │     send messages /      │  • Conversation FSM    │
│  :3000          │     request proofs       │                        │
└─────────────────┘                          └────────────────────────┘
                                                       ▲
                                                       │ Hologram
                                                       │ Messaging
                                                       ▼
                                              ┌────────────────┐
                                              │   User (Holder) │
                                              │   Hologram App   │
                                              └────────────────┘
```

### Configuration

| Variable | Source | Description |
|----------|--------|-------------|
| `VS_AGENT_ADMIN_URL` | `verifier-chatbot.env` | URL of the embedded VS-Agent admin API |
| `CHATBOT_PORT` | `verifier-chatbot.env` | Port for the chatbot webhook server (default: `4002`) |
| `SERVICE_NAME` | `vs/config.env` | Used as the contextual menu title: `$SERVICE_NAME Verifier` |
| `CUSTOM_SCHEMA_BASE_ID` | `vs/config.env` | Schema to request in the presentation |
| `DATABASE_URL` | `verifier-chatbot.env` | Connection string for session persistence |

### VS-Agent API Calls

| API Call | Purpose |
|----------|---------|
| `GET /v1/agent` | Get agent DID |
| `GET /v1/vt/json-schema-credentials` | Discover the schema to request in presentations |
| `POST /messages` | Send text messages, contextual menus, and proof requests to user |

### Conversation State Machine

```text
                 ┌─────────────────┐
  connection ──► │    WELCOME       │
                 │  send welcome    │
                 │  send menu       │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  REQUEST_PROOF   │
                 │  send proof      │
                 │  request to user │
                 └────────┬────────┘
                          │ proof received
                          ▼
                 ┌─────────────────┐
                 │  SHOW_RESULT     │
                 │  display all     │
                 │  attributes      │
                 │  welcome user    │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │    DONE          │
                 │  menu: "new      │
                 │   presentation"  │
                 └─────────────────┘
```

**States:**

1. **WELCOME** — On new connection: send welcome text, send contextual menu, transition to REQUEST_PROOF.
2. **REQUEST_PROOF** — Send an `IdentityProofRequestMessage` to the user via the VS-Agent, requesting the credential matching the custom schema. Wait for proof submission.
3. **SHOW_RESULT** — On receiving `IdentityProofSubmitMessage`: extract all attributes from the verified proof. Send a text message welcoming the user and listing all credential attributes. Transition to DONE.
4. **DONE** — Wait for menu interaction.

**Menu transitions:**
- **"abort"** (shown during REQUEST_PROOF) → reset session to WELCOME
- **"new presentation"** (shown in DONE) → reset session to REQUEST_PROOF

### Contextual Menu

Resent with every message.

| State | Menu Title | Menu Entries |
|-------|-----------|--------------|
| REQUEST_PROOF | `$SERVICE_NAME Verifier` | `abort` — Cancel current flow |
| DONE | `$SERVICE_NAME Verifier` | `new presentation` — Request another credential |

### Session Persistence

Same approach as the Issuer Chatbot:
- `connectionId`, `state`, `receivedAttributes` (JSON), `createdAt`, `updatedAt`
- SQLite for local, PostgreSQL for K8s

### Proof Verification Flow

1. Chatbot sends an `IdentityProofRequestMessage` via the VS-Agent messaging API.
2. The message includes a `RequestedProofItem` with:
   - `credentialDefinitionId`: the AnonCreds credential definition ID from the issuer's trust registry
   - `type`: `"verifiable-credential"`
   - `attributes`: all attribute names from the schema (excluding `id`)
3. The user's Hologram app presents the credential.
4. The VS-Agent verifies the proof and sends an `IdentityProofSubmitMessage` event to the chatbot webhook.
5. The chatbot extracts `claims` from the `SubmittedProofItems`, formats a welcome message with all attributes, and sends it to the user.

---

## 7. Shared Infrastructure

### VS-Agent Webhook Configuration

All chatbot services require the VS-Agent to forward events to their webhook endpoints. This is configured via the VS-Agent's `EVENTS_BASE_URL` environment variable, which must point to the chatbot's HTTP server.

For the **Issuer Chatbot**: the existing Issuer VS-Agent is configured with `EVENTS_BASE_URL` pointing to the chatbot's address.

For the **Verifier services** (Web Verifier and Chatbot Verifier): each embeds its own VS-Agent with `EVENTS_BASE_URL` pointing to its own backend.

### VS-Agent Client (shared module)

A reusable TypeScript module (`vs-agent-client.ts`) shared across all three new services:

- `getAgent()` — `GET /v1/agent`
- `getJsonSchemaCredentials()` — `GET /v1/vt/json-schema-credentials`
- `issueCredential(params)` — `POST /v1/vt/issue-credential`
- `sendMessage(message)` — `POST /messages` (text, menu, proof request)
- Health check / wait for agent readiness

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript (Node.js) |
| Runtime | Node.js 20+ |
| HTTP Server | Express |
| Database | SQLite (local) / PostgreSQL (K8s) |
| ORM | better-sqlite3 (local) / pg (K8s) — or a lightweight abstraction |
| QR Code (web verifier) | `qrcode` npm package |
| Container | Docker (multi-stage build) |
| Deployment | Helm chart (same pattern as vs-agent-chart) |

### Common npm Workspace

The three new services share common code. Use an npm workspace structure:

```json
{
  "name": "verana-demos",
  "workspaces": [
    "issuer-chatbot",
    "web-verifier",
    "verifier-chatbot"
  ]
}
```

Shared code (VS-Agent client, session store interface) can be in a `packages/shared/` directory or duplicated minimally.

---

## 8. Local Execution

All services must be runnable locally with minimal setup.

### Local Prerequisites

- **Docker** with `linux/amd64` platform support
- **ngrok** — authenticated (for Issuer VS-Agent public URL)
- **veranad** — Verana blockchain CLI
- **Node.js 20+** and **npm**
- **curl**, **jq**

### Local Startup Sequence

```bash
# 1. Deploy Issuer VS-Agent (existing)
source vs/config.env
NETWORK=testnet ./scripts/vs-demo/01-deploy-vs.sh
source vs-demo-ids.env

# 2. Get ECS credentials (existing)
./scripts/vs-demo/02-get-ecs-credentials.sh

# 3. Create Trust Registry with AnonCreds (existing)
./scripts/vs-demo/03-create-trust-registry.sh

# 4. Start Issuer Chatbot (connects to the issuer VS-Agent)
cd issuer-chatbot
npm install
VS_AGENT_ADMIN_URL=http://localhost:3000 npm start

# 5. Start Web Verifier (launches its own VS-Agent + web server)
cd web-verifier
npm install
npm start   # starts embedded VS-Agent (Docker) + Express server

# 6. Start Chatbot Verifier (launches its own VS-Agent + chatbot)
cd verifier-chatbot
npm install
npm start   # starts embedded VS-Agent (Docker) + chatbot server
```

### Local Docker Compose (optional convenience)

A `docker-compose.yml` at the repo root can orchestrate all services:

```yaml
services:
  issuer-vs-agent:
    image: veranalabs/vs-agent:latest
    platform: linux/amd64
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - AGENT_PUBLIC_DID=did:webvh:${NGROK_DOMAIN}
      - AGENT_LABEL=${SERVICE_NAME}
      - EVENTS_BASE_URL=http://issuer-chatbot:4000

  issuer-chatbot:
    build: ./issuer-chatbot
    ports:
      - "4000:4000"
    environment:
      - VS_AGENT_ADMIN_URL=http://issuer-vs-agent:3000
      - DATABASE_URL=sqlite:./data/sessions.db
    depends_on:
      - issuer-vs-agent

  verifier-vs-agent:
    image: veranalabs/vs-agent:latest
    platform: linux/amd64
    ports:
      - "3002:3000"
      - "3003:3001"
    environment:
      - EVENTS_BASE_URL=http://verifier-chatbot:4002

  web-verifier:
    build: ./web-verifier
    ports:
      - "4001:4001"
    environment:
      - VS_AGENT_ADMIN_URL=http://verifier-vs-agent:3000

  verifier-chatbot:
    build: ./verifier-chatbot
    ports:
      - "4002:4002"
    environment:
      - VS_AGENT_ADMIN_URL=http://verifier-vs-agent:3000
      - DATABASE_URL=sqlite:./data/sessions.db
    depends_on:
      - verifier-vs-agent
```

---

## 9. GitHub Actions Workflows

Each service gets its own workflow, triggered via `workflow_dispatch`.

### 9.1 Issuer VS-Agent Workflow (Existing)

**File:** `.github/workflows/deploy-vs-demo.yml`

No changes required (already complete).

### 9.2 Issuer Chatbot Workflow (New)

**File:** `.github/workflows/deploy-issuer-chatbot.yml`

**Trigger:** `workflow_dispatch` with inputs:
- `step`: `deploy` | `all`

**Steps:**
1. Validate branch name (`vs/<network>-<name>`)
2. Load `vs/config.env` + `vs/issuer-chatbot.env`
3. Build container image and push to registry
4. Deploy via Helm to K8s (same namespace as the Issuer VS-Agent)
5. Configure the Issuer VS-Agent's `EVENTS_BASE_URL` to point to the chatbot service

### 9.3 Web Verifier Workflow (New)

**File:** `.github/workflows/deploy-web-verifier.yml`

**Trigger:** `workflow_dispatch` with inputs:
- `step`: `deploy` | `all`

**Steps:**
1. Validate branch name
2. Load configuration
3. Build container image and push to registry
4. Deploy the embedded VS-Agent via Helm
5. Deploy the web verifier backend via Helm
6. Run ECS credential + trust registry setup for the verifier VS-Agent (reuse `common.sh` helpers)

### 9.4 Chatbot Verifier Workflow (New)

**File:** `.github/workflows/deploy-verifier-chatbot.yml`

**Trigger:** `workflow_dispatch` with inputs:
- `step`: `deploy` | `all`

**Steps:**
1. Validate branch name
2. Load configuration
3. Build container image and push to registry
4. Deploy the embedded VS-Agent via Helm
5. Deploy the chatbot verifier via Helm
6. Configure the verifier VS-Agent's `EVENTS_BASE_URL` to point to the chatbot

---

## 10. Configuration Reference

### vs/config.env (shared — changes)

| Variable | Current Default | New Default | Reason |
|----------|----------------|-------------|--------|
| `ENABLE_ANONCREDS` | `"false"` | `"true"` | Issuer Chatbot requires AnonCreds for credential issuance to Hologram users |

### vs/issuer-chatbot.env (new)

| Variable | Default | Description |
|----------|---------|-------------|
| `VS_AGENT_ADMIN_URL` | `http://localhost:3000` | Issuer VS-Agent admin API URL |
| `CHATBOT_PORT` | `4000` | Chatbot webhook server port |
| `DATABASE_URL` | `sqlite:./data/sessions.db` | Session persistence |
| `LOG_LEVEL` | `info` | Logging level |

### vs/web-verifier.env (new)

| Variable | Default | Description |
|----------|---------|-------------|
| `VS_AGENT_ADMIN_URL` | `http://localhost:3002` | Embedded VS-Agent admin API URL |
| `VERIFIER_PORT` | `4001` | Web server port |
| `POLL_INTERVAL_MS` | `2000` | Frontend polling interval |

### vs/verifier-chatbot.env (new)

| Variable | Default | Description |
|----------|---------|-------------|
| `VS_AGENT_ADMIN_URL` | `http://localhost:3002` | Embedded VS-Agent admin API URL |
| `CHATBOT_PORT` | `4002` | Chatbot webhook server port |
| `DATABASE_URL` | `sqlite:./data/sessions.db` | Session persistence |
| `LOG_LEVEL` | `info` | Logging level |

---

## 11. Implementation Order

| Phase | Task | Dependencies |
|-------|------|-------------|
| **Phase 1** | Change `ENABLE_ANONCREDS` default to `true` in `vs/config.env` | None |
| **Phase 2** | Implement **Issuer Chatbot Service** | Phase 1 (needs running issuer VS-Agent with AnonCreds) |
| **Phase 3** | Implement **Chatbot Verifier Service** | Phase 2 (needs issued credentials to verify) |
| **Phase 4** | Implement **Web Verifier Service** | Phase 2 (needs issued credentials to verify) |
| **Phase 5** | Add **GitHub Actions workflows** for all three new services | Phases 2–4 |
| **Phase 6** | Add **docker-compose.yml** for local orchestration | Phases 2–4 |
| **Phase 7** | Update **README.md** with new services documentation | All phases |

---

## 12. Open Questions

1. **Verifier VS-Agent setup**: The Web Verifier and Chatbot Verifier embed their own VS-Agents. Do these verifier agents also need ECS credentials and on-chain trust registry setup, or do they only need to resolve the issuer's trust registry to verify credentials? (The verifier likely only needs to resolve, not own a TR.)

2. **Credential delivery in Issuer Chatbot**: Should the chatbot issue the credential directly via `issue-credential` API (which stores it on the agent side), then deliver it to the user via DIDComm credential offer? Or should it use a different flow? The existing VS-Agent `issue-credential` endpoint issues a self-signed credential — for issuing to a remote holder, the DIDComm credential issuance protocol would be used.

3. **AnonCreds vs W3C JSON-LD for chatbot issuance**: The brief mentions AnonCreds must be enabled. Should the chatbot issue exclusively AnonCreds credentials, or dual W3C + AnonCreds? The Hologram Messaging app likely expects AnonCreds format for storage and presentation.

4. **Shared VS-Agent for verifiers**: Should the Web Verifier and Chatbot Verifier share a single VS-Agent instance, or each have their own? Sharing reduces resource usage; separate agents provide isolation.
