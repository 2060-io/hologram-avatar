# GitHub Agent — User Guide

Welcome to the **GitHub Agent**, an AI-powered assistant that lets you interact with GitHub through an encrypted DIDComm chat in [Hologram Messaging](https://hologram.zone).

## Getting Started

### 1. Install Hologram Messaging

Download the Hologram Messaging app and create your account.

### 2. Get Your Credential

Connect to the **Avatar** service first. It will issue you a verifiable credential that proves your identity within the Hologram ecosystem. You need this credential to authenticate with the GitHub Agent.

### 3. Connect to the GitHub Agent

Scan the GitHub Agent's QR code or tap its invitation link from the [playground](https://vs.hologram.zone). The agent will greet you and ask you to authenticate.

### 4. Authenticate

Open the contextual menu (hamburger icon) and tap **Authenticate**. The agent will request your verifiable credential. Accept the proof request to complete authentication.

### 5. Configure Your GitHub Token

After authenticating, open the contextual menu and select **MCP Server Config**. The agent will ask you to enter your **GitHub Personal Access Token**.

To create a token:
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)** or use a **Fine-grained token**
3. Select the scopes you need (e.g. `repo`, `read:org`, `read:user`)
4. Copy the token and paste it into the chat

The agent will verify the token works and confirm the configuration.

## What Can the GitHub Agent Do?

Once configured, you can ask the agent to:

- **Search repositories** — "Find Python machine learning repos with more than 1000 stars"
- **Browse issues** — "Show me open issues in my-org/my-repo"
- **List pull requests** — "What PRs are open in my-org/my-repo?"
- **Read file contents** — "Show me the README of my-org/my-repo"
- **Explore code** — "Search for usages of `useState` in my-org/frontend"
- **Get commit history** — "Show recent commits on main in my-org/my-repo"
- **View user profiles** — "Who is octocat on GitHub?"
- **List branches and tags** — "What branches exist in my-org/my-repo?"

Just type your request in natural language — the agent will figure out which GitHub API to call.

## Tips

- **Be specific**: "Show open issues labeled `bug` in my-org/my-repo" works better than "show bugs"
- **Use natural language**: No need to remember API syntax — just describe what you want
- **Multi-language**: The agent responds in your language (English, Spanish, French, Portuguese)
- **Token security**: Your GitHub token is stored encrypted and is never shared with other users

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Agent says "Authentication required" | Open the menu and tap **Authenticate** |
| Agent says token is invalid | Regenerate your GitHub token and reconfigure via **MCP Server Config** |
| Agent can't find a repo | Make sure your token has access to that repository |
| Agent is unresponsive | Try sending "hello" or reconnect from Hologram Messaging |

## Privacy & Security

- All communication is end-to-end encrypted via DIDComm
- Your GitHub token is stored per-user and encrypted at rest
- The agent only accesses GitHub on your behalf — no data is shared between users
- Your identity is verified through the Verana ecosystem's verifiable credentials
