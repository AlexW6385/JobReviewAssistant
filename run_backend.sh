#!/bin/bash

# Get the directory where this script is located
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_PATH="/Users/alexwang/Documents/Projects/.venv"
PORT=8787

# 1. Check if the port is already in use
EXISTING_PID=$(lsof -t -i:$PORT)

if [ ! -z "$EXISTING_PID" ]; then
    echo "⚠️  Port $PORT is already in use by process $EXISTING_PID."
    echo "Stopping existing backend process..."
    kill -9 $EXISTING_PID
    sleep 1
    echo "✅ Previous process stopped."
fi

# 2. Check if virtual environment exists
if [ ! -d "$VENV_PATH" ]; then
    echo "❌ Error: Virtual environment not found at $VENV_PATH"
    exit 1
fi

# 3. Run the backend using the python interpreter from the virtual environment
echo "🚀 Starting JobReviewAssistant Backend on port $PORT..."
echo "Using Python: $VENV_PATH/bin/python"

cd "$PROJECT_ROOT/backend"
"$VENV_PATH/bin/python" server.py
