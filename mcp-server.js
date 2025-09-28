#!/usr/bin/env node

// MCP Browser Control Server Wrapper
// This ensures proper environment setup for Claude Code MCP integration

// Set environment variables for production MCP usage
process.env.LOG_LEVEL = 'warn';
process.env.HEADLESS = 'true';
process.env.BROWSER_TYPE = 'chrome';
process.env.MAX_SESSIONS = '3';
process.env.NODE_ENV = 'production';

// Import and start the server
import('./dist/server.js');