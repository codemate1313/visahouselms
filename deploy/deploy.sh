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

# Generate or update DEVELOPER_ACCESS_SLUG in backend/.env if missing or default
python3 -c "
import os, secrets
env_path = '$APP_DIR/backend/.env'
if not os.path.exists(env_path):
    print('⚠️ backend/.env does not exist yet. Creating it...')
    with open(env_path, 'w') as f:
        f.write('DEVELOPER_ACCESS_SLUG=vh-prod-' + secrets.token_hex(12) + '\n')
else:
    with open(env_path, 'r') as f:
        lines = f.read().splitlines()
    slug_found = False
    for i, line in enumerate(lines):
        if line.startswith('DEVELOPER_ACCESS_SLUG='):
            slug_found = True
            val = line.split('=', 1)[1].strip()
            if not val or val == 'vh-control-9f4c2a':
                new_val = 'vh-prod-' + secrets.token_hex(12)
                lines[i] = f'DEVELOPER_ACCESS_SLUG={new_val}'
                print(f'✅ Updated DEVELOPER_ACCESS_SLUG from \"{val}\" to a new secure production slug.')
            break
    if not slug_found:
        new_val = 'vh-prod-' + secrets.token_hex(12)
        lines.append(f'DEVELOPER_ACCESS_SLUG={new_val}')
        print('✅ Appended new secure DEVELOPER_ACCESS_SLUG to backend/.env.')
    with open(env_path, 'w') as f:
        f.write('\n'.join(lines) + '\n')
"

# Extract the slug to write to frontend/.env.production
developer_slug="$(grep -E '^DEVELOPER_ACCESS_SLUG=' "$APP_DIR/backend/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
if [ -z "$developer_slug" ] || [ "$developer_slug" = "vh-control-9f4c2a" ]; then
  echo "❌ Failed to set a production-safe DEVELOPER_ACCESS_SLUG in backend/.env."
  exit 1
fi

# Always write/override .env.production to ensure it contains the correct slug
{
  printf "VITE_API_BASE_URL=/api\n"
  printf "VITE_DEVELOPER_ACCESS_SLUG=%s\n" "$developer_slug"
} > .env.production

npm cache clean --force
rm -rf node_modules
npm install --include=dev
./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build

# The build keeps the previous build's hashed chunks so tabs that were already
# open - a student mid-exam - can still fetch what they were built against.
# Prune the ones no live session can still be holding.
if [ -d dist/assets ]; then
  find dist/assets -type f -mtime +14 -delete
  echo "🧹 Pruned build assets older than 14 days."
fi
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
