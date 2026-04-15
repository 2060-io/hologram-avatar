#!/usr/bin/env bash
# =============================================================================
# X Agent VS — Local Setup
# =============================================================================
#
# This script sets up the X Agent VS locally:
#   1. Deploys the VS Agent via Docker + ngrok
#   2. Sets up the veranad CLI account
#   3. Obtains a Service credential from organization
#
# Requires organization to be running and its admin API reachable.
#
# Prerequisites:
#   - Docker, ngrok (authenticated), curl, jq
#   - Organization running (ORG_VS_ADMIN_URL reachable)
#
# Usage:
#   source x-agent/config.env
#   ./x-agent/scripts/setup.sh
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SERVICE_DIR/.." && pwd)"

# Load configuration
# shellcheck source=../config.env
source "$SERVICE_DIR/config.env"

# shellcheck source=../common/common.sh
source "${REPO_ROOT}/common/common.sh"

# ---------------------------------------------------------------------------
# Configuration — override via environment or config.env
# ---------------------------------------------------------------------------

NETWORK="${NETWORK:-testnet}"
VS_AGENT_IMAGE="${VS_AGENT_IMAGE:-veranalabs/vs-agent:latest}"
VS_AGENT_CONTAINER_NAME="${VS_AGENT_CONTAINER_NAME:-x-agent}"
VS_AGENT_ADMIN_PORT="${VS_AGENT_ADMIN_PORT:-3030}"
VS_AGENT_PUBLIC_PORT="${VS_AGENT_PUBLIC_PORT:-3031}"
VS_AGENT_DATA_DIR="${VS_AGENT_DATA_DIR:-${SERVICE_DIR}/data}"
SERVICE_NAME="${SERVICE_NAME:-X Agent}"
USER_ACC="${USER_ACC:-org-vs-admin}"
OUTPUT_FILE="${OUTPUT_FILE:-${SERVICE_DIR}/ids.env}"

# Organization
ORG_VS_ADMIN_URL="${ORG_VS_ADMIN_URL:-http://localhost:3000}"
ORG_VS_PUBLIC_URL="${ORG_VS_PUBLIC_URL:-}"

# Service details
SERVICE_TYPE="${SERVICE_TYPE:-AIAgent}"
SERVICE_DESCRIPTION="${SERVICE_DESCRIPTION:-AI agent for publishing and managing posts on X (Twitter)}"
SERVICE_LOGO_URL="${SERVICE_LOGO_URL:-https://hologram.zone/images/x.svg}"
SERVICE_MIN_AGE="${SERVICE_MIN_AGE:-0}"
SERVICE_TERMS="${SERVICE_TERMS:-https://hologram.zone/page/terms-of-service/}"
SERVICE_PRIVACY="${SERVICE_PRIVACY:-https://hologram.zone/page/privacy-policy/}"

# ---------------------------------------------------------------------------
# Ensure veranad is available
# ---------------------------------------------------------------------------

if ! command -v veranad &> /dev/null; then
  log "veranad not found — downloading..."
  VERANAD_VERSION="${VERANAD_VERSION:-v0.9.4}"
  PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
  esac
  mkdir -p "${HOME}/.local/bin"
  curl -sfL "https://github.com/verana-labs/verana/releases/download/${VERANAD_VERSION}/veranad-${PLATFORM}-${ARCH}" \
    -o "${HOME}/.local/bin/veranad"
  chmod +x "${HOME}/.local/bin/veranad"
  export PATH="${HOME}/.local/bin:$PATH"
  ok "veranad installed: $(veranad version)"
fi

# ---------------------------------------------------------------------------
# Set network-specific variables
# ---------------------------------------------------------------------------

set_network_vars "$NETWORK"
log "Network: $NETWORK (chain: $CHAIN_ID)"

ADMIN_API="http://localhost:${VS_AGENT_ADMIN_PORT}"

# =============================================================================
# STEP 1: Deploy VS Agent
# =============================================================================

log "Step 1: Deploy VS Agent"

# Clean up any previous instance
docker rm -f "$VS_AGENT_CONTAINER_NAME" 2>/dev/null || true
rm -rf "${VS_AGENT_DATA_DIR}/data/wallet"

# Pull image
log "Pulling VS Agent image..."
if ! docker pull --platform linux/amd64 "$VS_AGENT_IMAGE" 2>&1 | tail -1; then
  if docker image inspect "$VS_AGENT_IMAGE" > /dev/null 2>&1; then
    warn "Pull failed — using locally cached image: $VS_AGENT_IMAGE"
  else
    err "Pull failed and no local image found for: $VS_AGENT_IMAGE"
    exit 1
  fi
fi

# Start ngrok tunnel
log "Starting ngrok tunnel on port ${VS_AGENT_PUBLIC_PORT}..."
pkill -f "ngrok http ${VS_AGENT_PUBLIC_PORT}" 2>/dev/null || true
sleep 1
ngrok http "$VS_AGENT_PUBLIC_PORT" --log=stdout > /tmp/ngrok-x-agent.log 2>&1 &
NGROK_PID=$!
sleep 5

NGROK_URL=$(curl -sf http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url // empty')
if [ -z "$NGROK_URL" ]; then
  err "Failed to get ngrok URL. Is ngrok installed and authenticated?"
  exit 1
fi
NGROK_DOMAIN=$(echo "$NGROK_URL" | sed 's|https://||')
ok "ngrok tunnel: $NGROK_URL (domain: $NGROK_DOMAIN)"

# Start VS Agent container
log "Starting VS Agent container..."
mkdir -p "$VS_AGENT_DATA_DIR"
docker run --platform linux/amd64 -d \
  -p "${VS_AGENT_PUBLIC_PORT}:3001" \
  -p "${VS_AGENT_ADMIN_PORT}:3000" \
  -v "${VS_AGENT_DATA_DIR}:/root/.afj" \
  -e "AGENT_PUBLIC_DID=did:webvh:${NGROK_DOMAIN}" \
  -e "AGENT_LABEL=${SERVICE_NAME}" \
  -e "AGENT_INVITATION_IMAGE_URL=${SERVICE_LOGO_URL}" \
  -e "ENABLE_PUBLIC_API_SWAGGER=true" \
  -e "EVENTS_BASE_URL=http://host.docker.internal:${CHATBOT_PORT:-3003}" \
  -e "USE_CORS=true" \
  --name "$VS_AGENT_CONTAINER_NAME" \
  "$VS_AGENT_IMAGE"

ok "VS Agent container started: $VS_AGENT_CONTAINER_NAME"

# Wait for agent
log "Waiting for VS Agent to initialize (up to 90s)..."
if wait_for_agent "$ADMIN_API" 90; then
  ok "VS Agent is ready"
else
  err "VS Agent did not start within timeout"
  docker logs "$VS_AGENT_CONTAINER_NAME" 2>&1 | tail -20
  exit 1
fi

# Get agent DID
AGENT_DID=$(curl -sf "${ADMIN_API}/v1/agent" | jq -r '.publicDid')
if [ -z "$AGENT_DID" ] || [ "$AGENT_DID" = "null" ]; then
  err "Could not retrieve agent DID"
  exit 1
fi
ok "Agent DID: $AGENT_DID"

# =============================================================================
# STEP 2: Set up veranad CLI account
# =============================================================================

log "Step 2: Set up veranad CLI account"
setup_veranad_account "$USER_ACC" "$FAUCET_URL"

# =============================================================================
# STEP 3: Obtain Service credential from organization
# =============================================================================

log "Step 3: Obtain Service credential from organization"

# Verify organization admin API is reachable
if ! curl -sf "${ORG_VS_ADMIN_URL}/api" > /dev/null 2>&1; then
  err "Organization admin API not reachable at ${ORG_VS_ADMIN_URL}"
  err "Make sure organization is running and ORG_VS_ADMIN_URL is set correctly."
  exit 1
fi
ok "Organization admin API reachable: $ORG_VS_ADMIN_URL"

# Skip if Service credential is already linked on the local agent
if has_linked_vp "$NGROK_URL" "service"; then
  ok "Service credential already linked — skipping"
else
  # Discover Service VTJSC from ECS TR
  SERVICE_VTJSC_OUTPUT=$(discover_ecs_vtjsc "$ECS_TR_PUBLIC_URL" "service")
  SERVICE_JSC_URL=$(echo "$SERVICE_VTJSC_OUTPUT" | sed -n '1p')
  CS_SERVICE_ID=$(echo "$SERVICE_VTJSC_OUTPUT" | sed -n '2p')

  # Download logo
  SERVICE_LOGO_DATA_URI=$(download_logo_data_uri "$SERVICE_LOGO_URL")

  # Build Service credential claims
  SERVICE_CLAIMS=$(jq -n \
    --arg id "$AGENT_DID" \
    --arg name "$SERVICE_NAME" \
    --arg type "$SERVICE_TYPE" \
    --arg desc "$SERVICE_DESCRIPTION" \
    --arg logo "$SERVICE_LOGO_DATA_URI" \
    --argjson age "$SERVICE_MIN_AGE" \
    --arg terms "$SERVICE_TERMS" \
    --arg privacy "$SERVICE_PRIVACY" \
    '{id: $id, name: $name, type: $type, description: $desc, logo: $logo, minimumAgeRequired: $age, termsAndConditions: $terms, privacyPolicy: $privacy}')

  # Issue Service credential from organization, link on local agent
  issue_remote_and_link "$ORG_VS_ADMIN_URL" "$ADMIN_API" "service" "$SERVICE_JSC_URL" "$AGENT_DID" "$SERVICE_CLAIMS"
fi

# =============================================================================
# Save IDs
# =============================================================================

log "Saving resource IDs to ${OUTPUT_FILE}"

cat > "$OUTPUT_FILE" <<EOF
# X Agent VS — Resource IDs
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Network: ${NETWORK}

AGENT_DID=${AGENT_DID}
NGROK_URL=${NGROK_URL}
VS_AGENT_CONTAINER_NAME=${VS_AGENT_CONTAINER_NAME}
VS_AGENT_ADMIN_PORT=${VS_AGENT_ADMIN_PORT}
VS_AGENT_PUBLIC_PORT=${VS_AGENT_PUBLIC_PORT}
USER_ACC=${USER_ACC}
EOF

ok "IDs saved to ${OUTPUT_FILE}"

# =============================================================================
# Summary
# =============================================================================

log "X Agent VS setup complete!"
echo ""
echo "  Agent DID         : $AGENT_DID"
echo "  Public URL        : $NGROK_URL"
echo "  Admin API         : $ADMIN_API"
echo ""
echo "  Start the full stack with Docker Compose:"
echo "    export NGROK_DOMAIN=${NGROK_DOMAIN}"
echo "    export OPENAI_API_KEY=sk-..."
echo "    export X_API_KEY=your-key"
echo "    export X_API_SECRET=your-secret"
echo "    export X_ACCESS_TOKEN=your-token"
echo "    export X_ACCESS_TOKEN_SECRET=your-token-secret"
echo "    export X_BEARER_TOKEN=your-bearer-token"
echo "    docker compose -f x-agent/docker/docker-compose.yml up"
echo ""
echo "  To stop:"
echo "    docker stop $VS_AGENT_CONTAINER_NAME"
echo "    kill $NGROK_PID  # ngrok"
echo ""
