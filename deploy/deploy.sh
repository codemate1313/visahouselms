#!/bin/bash

# ==============================================================================
# Visa House LMS — Auto-Deployment Script
# Run this on your Oracle Cloud VM to pull updates and rebuild the app.
# ==============================================================================

# Exit immediately if any command fails
set -e

echo "🚀 Starting deployment..."

# 1. Pull latest code from GitHub
echo "📥 Pulling latest commits from Git..."
git pull

# 2. Update Backend Python environment
echo "🐍 Updating backend packages..."
cd backend
source .venv/bin/activate
pip install -r requirements.txt

# 3. Run migrations
echo "🗄️ Running database migrations..."
alembic upgrade head
cd ..

# 4. Rebuild Frontend static files
echo "⚛️ Building Vite/React frontend..."
cd frontend
npm install
npm run build
cd ..

# 5. Restart systemd services
echo "🔄 Restarting FastAPI backend service..."
sudo systemctl restart visahouse-backend

echo "✨ Deployment successfully completed!"
