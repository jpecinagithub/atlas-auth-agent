#!/bin/bash
# Deploy atlas-auth-agent en Oracle Server
# Ejecutar desde local: bash deploy-oracle.sh

set -e

SERVER="oracle"
REMOTE_PATH="/home/ubuntu/PROYECTOS/atlas-auth-agent"
AGENT_PORT=3015

echo "=== 1. Subiendo proyecto al servidor ==="
ssh $SERVER "mkdir -p $REMOTE_PATH"

rsync -av --exclude='node_modules' \
          --exclude='.git' \
          --exclude='harness/node_modules' \
          --exclude='harness/dist' \
          --exclude='.env' \
          --exclude='*.log' \
          "$(dirname "$0")/" \
          "$SERVER:$REMOTE_PATH/"

echo "=== 2. Subiendo .env del servidor ==="
scp "$(dirname "$0")/.env.server" "$SERVER:$REMOTE_PATH/.env"

echo "=== 3. Instalando dependencias ==="
ssh $SERVER "cd $REMOTE_PATH && npm install --omit=dev"

echo "=== 4. Registrando en PM2 ==="
ssh $SERVER "cd $REMOTE_PATH && pm2 delete atlas-agent 2>/dev/null || true && pm2 start agent.js --name atlas-agent && pm2 save"

echo "=== 5. Estado PM2 ==="
ssh $SERVER "pm2 show atlas-agent"

echo ""
echo "✅ Agente desplegado en http://143.47.63.169:$AGENT_PORT"
echo "   Configura Nginx para proxear /atlas/ → localhost:$AGENT_PORT"
