#!/bin/bash

# Kill anything currently running on port 5173 or 8000
echo "Cleaning up ports 5173 and 8000..."
lsof -ti :5173 | xargs kill -9 2>/dev/null
lsof -ti :8000 | xargs kill -9 2>/dev/null

# Trap SIGINT (Ctrl+C) and gracefully kill both processes
trap 'echo "\nStopping both servers..."; kill $BACKEND_PID $FRONTEND_PID; exit' SIGINT

cd backend

echo "Starting Backend (FastAPI)..."
source .venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload &

BACKEND_PID=$!

echo "Starting Frontend (React/Vite)..."
cd ../frontend
npm run dev -- --port 5173 --strictPort &
FRONTEND_PID=$!

# Wait for both background processes so the script doesn't exit immediately
wait $BACKEND_PID $FRONTEND_PID
