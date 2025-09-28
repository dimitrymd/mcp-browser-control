#!/bin/bash

# MCP Browser Control Server Startup Script
# This script ensures the server starts with the correct environment

cd "/Users/dimitrymd/Documents/prj/mcp-browser-control"

# Set environment variables for production
export NODE_ENV=production
export LOG_LEVEL=warn
export HEADLESS=true
export BROWSER_TYPE=chrome
export MAX_SESSIONS=3

# Start the MCP server
exec node dist/server.js