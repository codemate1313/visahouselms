#!/bin/bash

# ==============================================================================
# Visa House LMS — Auto-Deployment Script
# Run this on your Oracle Cloud VM to pull updates and rebuild the app.
# ==============================================================================

# Exit immediately if any command fails
set -e

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

# 5. Restart systemd services
echo "🔄 Restarting FastAPI backend service..."
sudo systemctl restart visahouse-backend

echo "✨ Deployment successfully completed!"
