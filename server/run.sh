#!/bin/bash

set -e

kill_port() {
    echo "Checking for processes on ports 7895 and 4567..."
    pid1=$(lsof -ti:7895)
    if [ -n "$pid1" ]; then
        echo "Killing process on port 7895 (PID: $pid1)..."
        kill -9 $pid1
    else
        echo "No process running on port 7895."
    fi
    pid2=$(lsof -ti:4765)
    if [ -n "$pid2" ]; then
        echo "Killing process on port 4765 (PID: $pid2)..."
        kill -9 $pid2
    else
        echo "No process running on port 4765."
    fi
}

kill_port

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

if [ -f "requirements.txt" ]; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

echo "Starting launcher.py..."
python launcher.py
