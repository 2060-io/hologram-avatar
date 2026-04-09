#!/usr/bin/env bash
# =============================================================================
# Start the GitHub Agent stack locally via Docker Compose
# =============================================================================
#
# Prerequisites:
#   - GitHub Agent VS Agent running (setup.sh completed)
#   - config.env sourced
#   - OPENAI_API_KEY set in environment
#   - NGROK_DOMAIN set in environment
#
# Usage:
#   source github-agent/config.env
#   export NGROK_DOMAIN=your-domain.ngrok-free.app
#   export OPENAI_API_KEY=sk-...
#   ./github-agent/scripts/start.sh
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load configuration
# shellcheck source=../config.env
source "$SERVICE_DIR/config.env"

echo "============================================="
echo " GitHub Agent VS — Local Start"
echo "============================================="
echo "  VS Agent image  : ${VS_AGENT_IMAGE}"
echo "  Chatbot image   : ${CHATBOT_IMAGE}"
echo "  Chatbot port    : ${CHATBOT_PORT}"
echo "  Service name    : ${SERVICE_NAME}"
echo "  NGROK_DOMAIN    : ${NGROK_DOMAIN:-<not set>}"
echo ""

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "WARNING: OPENAI_API_KEY is not set. The chatbot LLM will not work."
fi

if [ -z "${NGROK_DOMAIN:-}" ]; then
  echo "WARNING: NGROK_DOMAIN is not set. Run setup.sh first or set it manually."
fi

echo "Starting Docker Compose stack..."
docker compose -f "$SERVICE_DIR/docker/docker-compose.yml" up "$@"
