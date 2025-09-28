# MCP Browser Control Examples Guide

This directory contains example scripts demonstrating how to use the MCP Browser Control server for various browser automation tasks.

## Overview

The MCP Browser Control server uses the standard MCP (Model Context Protocol) architecture where:

- The **server** runs as a stdio-based MCP server (not HTTP)
- **Clients** connect using MCP client libraries from `@modelcontextprotocol/sdk`
- Communication happens through the MCP protocol, not direct API calls

## How to Use These Examples

### 1. Setup the MCP Server

Build and configure the MCP server:

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Connect with an MCP Client

#### For Claude Desktop

Add this to your MCP settings:

```json
{
  "mcpServers": {
    "browser-control": {
      "command": "node",
      "args": ["/path/to/mcp-browser-control/dist/server.js"]
    }
  }
}
```

## Available Example Workflows

### 1. Audio Testing Workflow (`audio-testing-workflow.js`)
Demonstrates comprehensive audio testing capabilities:
- Audio playback detection
- Performance monitoring during audio playback
- Real-time audio analysis
- Cross-browser audio testing

### 2. Form Automation Example (`form-automation-example.js`)
Shows form interaction and data extraction:
- Form field filling
- Dropdown selections
- Checkbox/radio button handling
- Form submission and validation

### 3. Multi-Window Testing (`multi-window-testing.js`)
Illustrates multi-window browser automation:
- Window management
- Context switching
- Cross-window data sharing
- Parallel window operations

### 4. Video Testing Workflow (`video-testing-workflow.js`)
Comprehensive video testing and media analysis:
- Video playback testing
- Media performance monitoring
- Video quality analysis
- Streaming media testing

## Available MCP Tools

When connected to the MCP server, you can use these tools:

### Navigation Tools
- `navigate_to` - Navigate to a URL
- `go_back` - Navigate back in history
- `go_forward` - Navigate forward in history
- `refresh_page` - Refresh the current page

### Element Interaction
- `click_element` - Click on page elements
- `type_text` - Type text into form fields
- `select_option` - Select dropdown options
- `upload_file` - Upload files

### Data Extraction
- `extract_text` - Extract text from elements
- `extract_attributes` - Get element attributes
- `extract_links` - Extract all links from page
- `take_screenshot` - Take page screenshots (saved to local `screenshots/` directory)

### Session Management
- `create_session` - Create new browser session
- `close_session` - Close browser session
- `list_sessions` - List active sessions

### Audio Testing (Revolutionary Feature)
- `start_audio_capture` - Begin audio monitoring
- `stop_audio_capture` - End audio monitoring
- `analyze_audio_performance` - Analyze audio metrics
- `detect_audio_playback` - Real-time audio detection

### And many more...

## Understanding the Examples

The example files demonstrate **workflow patterns** and **tool usage**. Each example shows:

1. **Tool calling patterns** - How to sequence MCP tool calls for complex workflows
2. **Parameter structures** - Expected inputs for each tool
3. **Response handling** - How to process tool outputs
4. **Error handling** - Robust automation practices

## Implementation Notes

- Examples use conceptual JavaScript syntax to show workflow patterns
- Actual usage requires MCP protocol communication through your client
- All browser operations are performed server-side via Selenium WebDriver
- Tools are called via MCP protocol, not direct function calls

For more information about MCP protocol, visit: https://modelcontextprotocol.io/