#!/bin/bash

# ==============================================================================
# Visa House LMS — Auto-Deployment Script
# Run this on your Oracle Cloud VM to pull updates and rebuild the app.
# ==============================================================================

# Exit immediately if any command fails, including failures inside pipelines.
set -Eeuo pipefail

APP_DIR="/var/www/visahouse"
BACKEND_HEALTH_URL="http://127.0.0.1:8000/health/db"

wait_for_backend() {
  echo "🩺 Waiting for backend database health..."
  for attempt in $(seq 1 30); do
    if curl -fsS "$BACKEND_HEALTH_URL" >/dev/null; then
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
git pull --ff-only

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
  printf "VITE_API_BASE_URL=/api\n" > .env.production
fi
npm ci
npm run build
cd ..

# 5. Sync systemd service, fix writable directories, and restart
echo "🔧 Updating backend service definition..."
sudo cp deploy/visahouse-backend.service /etc/systemd/system/visahouse-backend.service
sudo systemctl daemon-reload

echo "🔐 Fixing app permissions..."
sudo chown -R ubuntu:www-data "$APP_DIR"
sudo mkdir -p "$APP_DIR/storage" "$APP_DIR/data"
sudo chown -R ubuntu:www-data "$APP_DIR/storage" "$APP_DIR/data"
sudo chmod -R g+rwX "$APP_DIR/storage" "$APP_DIR/data"

echo "🔄 Restarting FastAPI backend service..."
sudo systemctl restart visahouse-backend
wait_for_backend

echo "🧪 Validating Nginx configuration..."
sudo nginx -t
sudo systemctl reload nginx

echo "✨ Deployment successfully completed!"
