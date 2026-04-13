#!/usr/bin/env bash
# =============================================================================
# Start the Passport Issuer chatbot locally
# =============================================================================
#
# Prerequisites:
#   - Passport VS Agent running (setup.sh completed)
#   - config.env sourced
#   - Docker available (the chatbot runs as a container)
#
# Usage:
#   source passport/config.env
#   ./passport/scripts/start.sh
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load configuration
# shellcheck source=../config.env
source "$SERVICE_DIR/config.env"

# Defaults (can be overridden by env)
VS_AGENT_ADMIN_URL="${VS_AGENT_ADMIN_URL:-http://localhost:${VS_AGENT_ADMIN_PORT:-3004}}"
CHATBOT_PORT="${CHATBOT_PORT:-2903}"
CHATBOT_IMAGE="${CHATBOT_IMAGE:-io2060/hologram-gov-id-issuer-app:v1.4.4-dev.1}"

echo "============================================="
echo " Passport Issuer — Local Start"
echo "============================================="
echo "  VS-Agent URL      : $VS_AGENT_ADMIN_URL"
echo "  Chatbot port      : $CHATBOT_PORT"
echo "  Chatbot image     : $CHATBOT_IMAGE"
echo "  Vision URL        : ${VISION_URL:-https://vision.demos.dev.2060.io}"
echo "  WebRTC Server URL : ${WEBRTC_SERVER_URL:-https://webrtc.demos.dev.2060.io}"
echo ""

CONTAINER_NAME="passport-issuer"

# Stop previous instance if running
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

# Pull image
echo "Pulling chatbot image..."
docker pull --platform linux/amd64 "$CHATBOT_IMAGE" 2>&1 | tail -1

# Start the chatbot container
echo "Starting Passport Issuer chatbot..."
docker run --platform linux/amd64 -d \
  -p "${CHATBOT_PORT}:${CHATBOT_PORT}" \
  -e "AGENT_PORT=${CHATBOT_PORT}" \
  -e "SERVICE_AGENT_ADMIN_URL=http://host.docker.internal:${VS_AGENT_ADMIN_PORT:-3004}" \
  -e "POSTGRES_HOST=${POSTGRES_HOST:-host.docker.internal}" \
  -e "POSTGRES_USER=${POSTGRES_USER:-passport}" \
  -e "POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-passport}" \
  -e "VISION_URL=${VISION_URL:-https://vision.demos.dev.2060.io}" \
  -e "WEBRTC_SERVER_URL=${WEBRTC_SERVER_URL:-https://webrtc.demos.dev.2060.io}" \
  -e "PUBLIC_BASE_URL=${PUBLIC_BASE_URL:-http://localhost:${CHATBOT_PORT}}" \
  -e "ID_VERIFICATION_TIMEOUT_SECONDS=${ID_VERIFICATION_TIMEOUT_SECONDS:-900}" \
  -e "LOG_LEVEL=${LOG_LEVEL:-3}" \
  --name "$CONTAINER_NAME" \
  "$CHATBOT_IMAGE"

echo ""
echo "Passport Issuer chatbot started: $CONTAINER_NAME"
echo "  Port: $CHATBOT_PORT"
echo ""
echo "  To stop:"
echo "    docker stop $CONTAINER_NAME"
echo ""
