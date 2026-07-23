#!/bin/bash

# Trap SIGINT (Ctrl+C) and gracefully kill both processes
trap 'echo "\nStopping both servers..."; kill $BACKEND_PID $FRONTEND_PID; exit' SIGINT

echo "Starting Backend (FastAPI)..."
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload &
BACKEND_PID=$!

echo "Starting Frontend (React/Vite)..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Wait for both background processes so the script doesn't exit immediately
wait $BACKEND_PID $FRONTEND_PID
