#!/bin/bash

# MCP Browser Control Server startup script
# Handles audio setup, virtual display, and graceful shutdown

set -e

echo "🚀 Starting MCP Browser Control Server..."

# Setup virtual display for headless operation
if [ "$HEADLESS" = "true" ]; then
    echo "📺 Setting up virtual display..."
    export DISPLAY=:99
    Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
    XVFB_PID=$!
    echo "Virtual display started (PID: $XVFB_PID)"
fi

# Setup audio subsystem for audio testing
echo "🎵 Setting up audio subsystem..."
export PULSE_RUNTIME_PATH=/tmp/pulse-runtime
export PULSE_STATE_PATH=/tmp/pulse-state

# Create pulse directories
mkdir -p $PULSE_RUNTIME_PATH $PULSE_STATE_PATH

# Start PulseAudio in daemon mode
pulseaudio --start --log-target=newfile:/tmp/pulseaudio.log --log-level=info &
PULSE_PID=$!
echo "PulseAudio started (PID: $PULSE_PID)"

# Create virtual audio sink for testing
sleep 2
pactl load-module module-null-sink sink_name=virtual_audio_sink || echo "Virtual audio sink already exists"

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 3

# Verify Chrome installation
echo "🌐 Verifying Chrome installation..."
google-chrome --version || (echo "❌ Chrome not found" && exit 1)

# Verify audio setup
echo "🔊 Verifying audio setup..."
pactl info > /dev/null || echo "⚠️  Audio subsystem not fully available"

# Set up signal handlers for graceful shutdown
cleanup() {
    echo "🛑 Shutting down MCP Browser Control Server..."

    # Kill application if running
    if [ ! -z "$APP_PID" ]; then
        echo "Stopping application (PID: $APP_PID)..."
        kill -TERM $APP_PID 2>/dev/null || true
        wait $APP_PID 2>/dev/null || true
    fi

    # Stop PulseAudio
    if [ ! -z "$PULSE_PID" ]; then
        echo "Stopping PulseAudio (PID: $PULSE_PID)..."
        kill -TERM $PULSE_PID 2>/dev/null || true
    fi

    # Stop Xvfb
    if [ ! -z "$XVFB_PID" ]; then
        echo "Stopping virtual display (PID: $XVFB_PID)..."
        kill -TERM $XVFB_PID 2>/dev/null || true
    fi

    echo "✅ Shutdown complete"
    exit 0
}

# Trap signals
trap cleanup SIGTERM SIGINT SIGQUIT

# Start the MCP Browser Control Server
echo "🎯 Starting MCP Browser Control Server..."
echo "Environment: $NODE_ENV"
echo "Browser: $BROWSER_TYPE"
echo "Headless: $HEADLESS"
echo "Max Sessions: $MAX_CONCURRENT_SESSIONS"

# Run with proper signal handling
node dist/server.js &
APP_PID=$!

echo "✅ MCP Browser Control Server started (PID: $APP_PID)"
echo "🌐 Server ready for connections"

# Wait for application to exit
wait $APP_PID
EXIT_CODE=$?

echo "Application exited with code: $EXIT_CODE"

# Cleanup
cleanup