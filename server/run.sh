#!/bin/bash

set -e

kill_ports() {
    local ports=("7895" "4765")
    
    for port in "${ports[@]}"; do
        echo "Checking for processes on port $port..."
        pid=$(lsof -ti:$port)
        if [ -n "$pid" ]; then
            echo "Killing process on port $port (PID: $pid)..."
            kill -9 $pid
        else
            echo "No process running on port $port."
        fi
    done
}

kill_ports

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
