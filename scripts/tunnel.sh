#!/usr/bin/env bash
# Opens SSH tunnels to Coolify-hosted Postgres and Redis
# Resolves container IPs dynamically so it survives restarts
# Usage: ./scripts/tunnel.sh

HOST="deploy@46.224.227.119"
PG_LOCAL=15432
PG_CONTAINER="zo0gk0wsow8gsswk8wgc88o8"
REDIS_LOCAL=16379
REDIS_CONTAINER="zg8kso8s0gcwc0swoog44cko"

# Resolve current container IPs
PG_IP=$(ssh "$HOST" "docker inspect $PG_CONTAINER --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'" 2>/dev/null)
REDIS_IP=$(ssh "$HOST" "docker inspect $REDIS_CONTAINER --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'" 2>/dev/null)

if [ -z "$PG_IP" ] || [ -z "$REDIS_IP" ]; then
  echo "Failed to resolve container IPs (PG=$PG_IP, Redis=$REDIS_IP)" >&2
  exit 1
fi

# Kill existing tunnels on these ports
for port in $PG_LOCAL $REDIS_LOCAL; do
  pid=$(lsof -ti ":$port" 2>/dev/null)
  [ -n "$pid" ] && kill "$pid" 2>/dev/null
done

ssh -f -N \
  -L "$PG_LOCAL:$PG_IP:5432" \
  -L "$REDIS_LOCAL:$REDIS_IP:6379" \
  -o ServerAliveInterval=60 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  "$HOST"

if [ $? -eq 0 ]; then
  echo "Tunnels open:"
  echo "  Postgres → localhost:$PG_LOCAL (container $PG_IP)"
  echo "  Redis    → localhost:$REDIS_LOCAL (container $REDIS_IP)"
else
  echo "Failed to open tunnels" >&2
  exit 1
fi
