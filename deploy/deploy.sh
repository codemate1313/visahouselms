#!/bin/bash

# ==============================================================================
# Visa House LMS — Auto-Deployment Script
# Run this on your Oracle Cloud VM to pull updates and rebuild the app.
# ==============================================================================

# Exit immediately if any command fails, including failures inside pipelines.
set -Eeuo pipefail

APP_DIR="/var/www/visahouse"
BACKEND_HEALTH_URL="http://127.0.0.1:8000/health/db"
BACKEND_HEALTH_HOST="${BACKEND_HEALTH_HOST:-thecodemate.tech}"

wait_for_backend() {
  echo "🩺 Waiting for backend database health..."
  for attempt in $(seq 1 30); do
    if curl -fsS -H "Host: $BACKEND_HEALTH_HOST" "$BACKEND_HEALTH_URL" >/dev/null; then
      echo "✅ Backend and database are healthy."
      return 0
    fi
    sleep 2
  done

  echo "❌ Backend health check failed. Recent service logs:"
  sudo journalctl -u visahouse-backend -n 120 --no-pager || true
  return 1
}

echo "🚀 Starting deployment..."

# 1. Pull latest code from GitHub without creating an implicit merge commit
echo "📥 Pulling latest commits from Git..."
git config --global --add safe.directory "$APP_DIR"
git fetch --prune origin main
git checkout main
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️ Local checkout has uncommitted changes. Stashing before deployment reset..."
  git stash push --include-untracked -m "pre-deploy-$(date -u +%Y%m%d%H%M%S)" || true
fi
git reset --hard origin/main
git clean -fd

# 2. Update Backend Python environment
echo "🐍 Updating backend packages..."
cd backend
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# 3. Run migrations
echo "🗄️ Running database migrations..."
python -m alembic upgrade head
cd ..

# 4. Rebuild Frontend static files
echo "⚛️ Building Vite/React frontend..."
cd frontend
if [ ! -f .env.production ]; then
  developer_slug=""
  if [ -f "$APP_DIR/backend/.env" ]; then
    developer_slug="$(grep -E '^DEVELOPER_ACCESS_SLUG=' "$APP_DIR/backend/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
  fi
  if [ -z "$developer_slug" ]; then
    echo "❌ DEVELOPER_ACCESS_SLUG is required in backend/.env before building the frontend."
    exit 1
  fi
  if [ "$developer_slug" = "vh-control-9f4c2a" ]; then
    echo "❌ DEVELOPER_ACCESS_SLUG must be changed from the local development default before production deployment."
    exit 1
  fi
  {
    printf "VITE_API_BASE_URL=/api\n"
    printf "VITE_DEVELOPER_ACCESS_SLUG=%s\n" "$developer_slug"
  } > .env.production
fi
npm ci
npm run build
cd ..

# 5. Sync systemd service, fix writable directories, and restart
echo "🔧 Updating backend service definition..."
sudo cp deploy/visahouse-backend.service /etc/systemd/system/visahouse-backend.service
sudo systemctl daemon-reload

echo "🔐 Fixing app permissions..."
sudo mkdir -p "$APP_DIR/storage" "$APP_DIR/data" "$APP_DIR/backend/storage"
sudo chown -R www-data:www-data "$APP_DIR/storage" "$APP_DIR/data" "$APP_DIR/backend/storage"
sudo chmod -R g+rwX "$APP_DIR/storage" "$APP_DIR/data" "$APP_DIR/backend/storage"

echo "🔄 Restarting FastAPI backend service..."
sudo systemctl restart visahouse-backend
wait_for_backend

echo "🧪 Validating Nginx configuration..."
sudo nginx -t
sudo systemctl reload nginx

echo "✨ Deployment successfully completed!"
