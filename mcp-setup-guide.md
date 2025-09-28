# MCP Browser Control Setup Guide

## Quick Setup for Claude Desktop

### 1. Configuration File Location
The MCP server is configured in: `~/.claude/mcp.json`

### 2. Current Configuration
```json
{
  "mcpServers": {
    "mcp-browser-control": {
      "command": "node",
      "args": ["dist/server.js"],
      "cwd": "/Users/dimitrymd/Documents/prj/mcp-browser-control",
      "env": {
        "NODE_ENV": "production",
        "BROWSER_TYPE": "chrome",
        "HEADLESS": "true",
        "MAX_SESSIONS": "3",
        "SESSION_TIMEOUT": "600000",
        "LOG_LEVEL": "warn"
      }
    }
  }
}
```

### 3. Available Tools (62 total)

#### Core Navigation
- `navigate_to` - Navigate to any URL
- `go_back` / `go_forward` - Browser history navigation
- `refresh` - Reload pages
- `get_current_url` - Get page info

#### Element Interaction
- `click` - Click elements with advanced options
- `type_text` - Type into form fields
- `hover` - Mouse hover interactions
- `scroll_to` - Scroll to elements or positions

#### Content Extraction
- `get_page_content` - Extract HTML, text, or markdown
- `get_element_text` - Get text from specific elements
- `get_element_attribute` - Extract element attributes
- `take_screenshot` - Capture page or element screenshots

#### Audio Testing (Revolutionary)
- `check_audio_playing` - Real playback detection
- `control_audio_playback` - Play/pause/seek controls
- `monitor_audio_events` - Track audio events
- `analyze_audio_performance` - Performance metrics
- `detect_audio_issues` - Issue detection

#### Video Testing (Industry-First)
- `check_video_playing` - Frame advancement detection
- `analyze_video_quality` - Quality metrics and analysis
- `control_video_playback` - Advanced video controls
- `monitor_video_events` - Video event tracking
- `detect_video_issues` - Quality issue detection

#### Session Management
- `create_session` - Create new browser sessions
- `close_session` - Close sessions
- `list_sessions` - View active sessions
- `get_session_info` - Session details

#### Advanced Features
- `extract_table_data` - Smart table extraction
- `extract_structured_data` - Schema-based extraction
- `extract_links` - Link analysis
- `extract_media_info` - Media element details
- `manage_cookies` - Cookie operations
- `execute_javascript` - Run custom JS code
- `handle_alert` - Dialog management
- `get_windows` / `switch_window` - Multi-window support
- `start_network_capture` - Network monitoring
- `get_performance_metrics` - Performance analysis

### 4. Restart Claude Desktop
After updating the configuration, restart Claude Desktop to load the MCP server.

### 5. Verification
You can verify the setup by asking Claude Desktop to:
- List available tools
- Navigate to a website
- Extract content from a page
- Take a screenshot

### 6. Troubleshooting

#### Server Won't Start
- Ensure Chrome is installed
- Check that the path in `cwd` is correct
- Verify the project is built (`npm run build`)

#### Connection Issues
- Check Claude Desktop logs
- Verify the `mcp.json` syntax is valid
- Ensure no other process is using the server

#### Performance Issues
- Reduce `MAX_SESSIONS` if system resources are limited
- Set `HEADLESS=true` for better performance
- Increase `SESSION_TIMEOUT` for long-running operations

### 7. Advanced Configuration

#### Non-Headless Mode (Visible Browser)
To see browser windows during automation:
```json
"env": {
  "HEADLESS": "false"
}
```

#### Debug Mode
For detailed logging:
```json
"env": {
  "LOG_LEVEL": "debug"
}
```

#### Custom Browser
To use Firefox instead of Chrome:
```json
"env": {
  "BROWSER_TYPE": "firefox"
}
```

## Usage Examples

Once connected, you can ask Claude Desktop:

- "Take a screenshot of example.com"
- "Extract all text from my website funwayinteractive.com"
- "Check if there are any audio elements playing on youtube.com"
- "Navigate to google.com and search for 'MCP browser automation'"
- "Extract all links from a news website"
- "Monitor video playback quality on a streaming site"

The MCP Browser Control server provides 62 comprehensive tools for complete web automation and testing!