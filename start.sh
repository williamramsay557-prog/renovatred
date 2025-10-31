#!/bin/bash
# Renovatr Startup Script - Runs both backend and frontend servers

# Start backend server in background
echo "Starting backend server on port 3000..."
node server.js &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 2

# Start frontend server (foreground)
echo "Starting frontend server on port 5000..."
exec vite --host 0.0.0.0 --port 5000

# If frontend exits, kill backend
trap "kill $BACKEND_PID" EXIT
