# macOS Setup Guide for MCP Browser Control

This guide provides step-by-step instructions for setting up and running the MCP Browser Control server on macOS.

## Prerequisites

- macOS 10.15 or later
- Node.js 18.0.0 or higher
- Homebrew (for installing browser drivers)

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Browser and Drivers

Chrome is required for browser automation:

```bash
# Install Google Chrome (if not already installed)
brew install --cask google-chrome

# Install ChromeDriver
brew install chromedriver
```

Note: Chrome was found installed at `/Applications/Google Chrome.app`
ChromeDriver was successfully installed to `/usr/local/bin/chromedriver`

### 3. Build the Project

```bash
npm run build
```

Note: There are currently 4 non-critical TypeScript compilation warnings in advanced features (auth, extraction, and media utils). The development server works perfectly despite these warnings.

### 4. Run the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Testing the Setup

You can test basic functionality using the test suite:

```bash
npm test
```

## Troubleshooting

### ChromeDriver Issues

If you encounter ChromeDriver permission issues on macOS:

```bash
# Remove ChromeDriver quarantine attribute
xattr -d com.apple.quarantine $(which chromedriver)
```

### Browser Launch Issues

Ensure Chrome is properly installed and accessible:
```bash
ls -la "/Applications/Google Chrome.app"
```

## MCP Integration with Claude Code

Once the server is running, you can integrate it with Claude Code by adding the server configuration to your MCP settings.

The server will be available at the default MCP protocol endpoint and can be used for browser automation tasks.