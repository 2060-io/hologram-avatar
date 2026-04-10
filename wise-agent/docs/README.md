# Wise Agent — User Guide

Welcome to the **Wise Agent**, an AI-powered assistant that lets you interact with your Wise account through an encrypted DIDComm chat in [Hologram Messaging](https://hologram.zone).

## Getting Started

### 1. Install Hologram Messaging

Download the Hologram Messaging app and create your account.

### 2. Get Your Credential

Connect to the **Avatar** service first. It will issue you a verifiable credential that proves your identity within the Hologram ecosystem. You need this credential to authenticate with the Wise Agent.

### 3. Connect to the Wise Agent

Scan the Wise Agent's QR code or tap its invitation link from the [playground](https://vs.hologram.zone). The agent will greet you and ask you to authenticate.

### 4. Authenticate

Open the contextual menu (hamburger icon) and tap **Authenticate**. The agent will request your verifiable credential. Accept the proof request to complete authentication.

### 5. Configure Your Wise API Token

After authenticating, open the contextual menu and select **MCP Server Config**. The agent will ask you to enter your **Wise API Token**.

To create a token:

1. Log in to your Wise account at [wise.com](https://wise.com)
2. Go to **Settings** > **API tokens** (or visit [wise.com/settings/api-tokens](https://wise.com/settings/api-tokens))
3. Click **Add new token**
4. Give it a name (e.g. "Hologram Agent")
5. Select the permissions you need (e.g. Read balances, Read transfers, Create transfers)
6. Copy the token and paste it into the chat

The agent will verify the token works and confirm the configuration.

> **Tip**: For testing, you can use the Wise Sandbox. Create a sandbox token at [sandbox.transferwise.tech](https://sandbox.transferwise.tech).

## What Can the Wise Agent Do?

Once configured, you can ask the agent to:

- **Check balances** — "What are my current balances?" or "How much EUR do I have?"
- **View exchange rates** — "What's the exchange rate from USD to EUR?"
- **List transfers** — "Show me my recent transfers" or "Show transfers from this month"
- **List recipients** — "Who are my saved recipients?"
- **Send money** — "Send 100 EUR to John Smith"
- **Create invoices** — "Create an invoice for 500 USD"
- **Get account details** — "Show my profile information"

Just type your request in natural language — the agent will figure out which Wise API to call.

## Tips

- **Be specific with currencies**: "Send 100 EUR" is better than "send 100"
- **Use natural language**: No need to remember API syntax — just describe what you want
- **Multi-language**: The agent responds in your language (English, Spanish, French, Portuguese)
- **Token security**: Your Wise API token is stored encrypted and is never shared with other users
- **Sandbox mode**: If the server is configured in sandbox mode, no real money will be moved

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Agent says "Authentication required" | Open the menu and tap **Authenticate** |
| Agent says token is invalid | Regenerate your Wise API token and reconfigure via **MCP Server Config** |
| Agent can't list balances | Make sure your token has "Read balances" permission |
| Transfer fails | Check your token has "Create transfers" permission and sufficient balance |
| Agent is unresponsive | Try sending "hello" or reconnect from Hologram Messaging |

## Privacy & Security

- All communication is end-to-end encrypted via DIDComm
- Your Wise API token is stored per-user and encrypted at rest
- The agent only accesses Wise on your behalf — no data is shared between users
- Your identity is verified through the Verana ecosystem's verifiable credentials
- No financial data is logged or stored beyond the active conversation
