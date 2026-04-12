# Wise Agent

The Wise Agent is a verifiable service that provides AI-powered access to the [Wise](https://wise.com) financial platform through an encrypted DIDComm chat in [Hologram Messaging](https://hologram.zone).

It uses [mcp-wise](https://github.com/2060-io/mcp-wise) as its MCP server to interact with the Wise API.

## MCP Wise Configuration Modes

The `mcp-wise` server supports two deployment modes depending on how authentication and access control are configured.

### End-User Mode (Multi-Account)

Each user provides their own Wise API token. The server does **not** have a global token — instead, each user configures their token through the agent's MCP configuration menu.

Access is restricted by profile **type** (e.g., `personal`, `business`).

#### End-User environment variables

| Variable | Description |
|----------|-------------|
| `WISE_IS_SANDBOX` | `true` for sandbox, `false` for production |
| `WISE_ALLOWED_PROFILE_TYPES` | Comma-separated list of allowed profile types (default: `personal`) |

> **Note**: Do NOT set `WISE_API_TOKEN` in this mode.

#### End-User docker-compose.yml

```yaml
mcp-wise:
  image: io2060/mcp-wise:latest
  ports:
    - "14101:14101"
  environment:
    - MODE=http
    - WISE_IS_SANDBOX=false
    - WISE_ALLOWED_PROFILE_TYPES=personal
```

#### End-User agent-pack.yaml — MCP section

In end-user mode, `accessMode` is set to `user-controlled`. Each user is prompted to enter their own Wise API token through the chat interface.

```yaml
mcp:
  servers:
    - name: wise
      transport: streamable-http
      url: ${WISE_MCP_URL}
      accessMode: user-controlled
      userConfig:
        fields:
          - name: token
            type: secret
            label:
              en: "Please enter your Wise API Token:"
              es: "Por favor, ingresa tu Token de API de Wise:"
              fr: "Veuillez entrer votre jeton d'API Wise :"
              pt: "Por favor, insira seu Token de API do Wise:"
            headerTemplate: "Bearer {value}"
      toolAccess:
        default: public
```

### Corporate Mode (Single Account)

A single Wise account is configured for this MCP server instance. The server holds a global API token, and access is restricted to specific profile IDs.

All users operate on the same Wise account — they do not need to configure a token.

#### Corporate environment variables

| Variable | Description |
|----------|-------------|
| `WISE_API_TOKEN` | Global Wise API token for the shared account |
| `WISE_IS_SANDBOX` | `true` for sandbox, `false` for production |
| `WISE_ALLOWED_PROFILES` | Comma-separated list of allowed profile IDs |

Use the `list_profiles` MCP tool to discover profile IDs, then set `WISE_ALLOWED_PROFILES` to control which profiles are accessible.

#### Corporate docker-compose.yml

```yaml
mcp-wise:
  image: io2060/mcp-wise:latest
  ports:
    - "14101:14101"
  environment:
    - MODE=http
    - WISE_IS_SANDBOX=false
    - WISE_API_TOKEN=your_wise_api_token
    - WISE_ALLOWED_PROFILES=13614771,69973314
```

#### Corporate agent-pack.yaml — MCP section

In corporate mode, the token is provided globally via the `headers` field. `accessMode` can be omitted or set to a non-user-controlled value. No `userConfig` is needed since users don't provide their own token.

```yaml
mcp:
  servers:
    - name: wise
      transport: streamable-http
      url: ${WISE_MCP_URL}
      headers:
        Authorization: "Bearer ${WISE_API_TOKEN}"
      toolAccess:
        default: public
```

## Default Behavior

If neither `WISE_ALLOWED_PROFILES` nor `WISE_ALLOWED_PROFILE_TYPES` is set, only **personal** profiles are allowed (end-user mode with default restrictions).

## Local Development

```bash
source wise-agent/config.env
export NGROK_DOMAIN=your-domain.ngrok-free.app
export OPENAI_API_KEY=sk-...
docker compose -f wise-agent/docker/docker-compose.yml up
```

See [`docs/README.md`](docs/README.md) for the end-user guide.
