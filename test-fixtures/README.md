# Test Fixtures

This directory contains test files and fixtures for the MCP Browser Control Server.

## Audio Test Files

### Pages
- `pages/audio-test.html` - Comprehensive audio testing page with multiple audio/video elements
- `pages/dialog-test.html` - Dialog, storage, and JavaScript testing page

### Audio Files (External URLs)
The test pages use external audio URLs for testing:

- **MP3 Format**: Bell ringing sound from soundjay.com
- **WAV Format**: Clock ticking sound from soundjay.com
- **OGG Format**: Alternative format for cross-browser testing
- **MP4 Video**: Big Buck Bunny sample from Google Cloud Storage

### Test Scenarios

#### Audio Testing Features
1. **Multiple audio elements** with different formats
2. **Video element** for video-specific testing
3. **Audio with no source** for error testing
4. **Auto-play audio** for autoplay policy testing
5. **Comprehensive event listeners** for all audio events
6. **JavaScript utilities** for audio analysis
7. **Performance monitoring** functions

#### Dialog Testing Features
1. **Alert dialogs** with different message types
2. **Confirm dialogs** with various prompts
3. **Prompt dialogs** with default values
4. **Delayed dialogs** for timeout testing
5. **Multiple consecutive dialogs** for queue testing
6. **Dialog handler testing** for automatic handling

#### Storage Testing Features
1. **localStorage operations** (get, set, clear)
2. **sessionStorage operations** (get, set, clear)
3. **Cookie management** (set, get with various options)
4. **Cross-browser storage compatibility** testing

## Usage

### Local Testing
```bash
# Start a local HTTP server to serve the test pages
npx http-server test-fixtures/pages -p 3000 -c-1

# Navigate to test pages:
# http://localhost:3000/audio-test.html
# http://localhost:3000/dialog-test.html
```

### MCP Tool Testing
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "http://localhost:3000/audio-test.html"
  }
}

{
  "tool": "check_audio_playing",
  "arguments": {
    "selector": "#audio1",
    "sampleDuration": 1000
  }
}

{
  "tool": "control_audio_playback",
  "arguments": {
    "selector": "#audio1",
    "action": "play"
  }
}

{
  "tool": "monitor_audio_events",
  "arguments": {
    "duration": 5000,
    "includeTimeUpdates": true
  }
}
```

### JavaScript Testing
```json
{
  "tool": "execute_javascript",
  "arguments": {
    "script": "return analyzeAudioElement('audio1');"
  }
}

{
  "tool": "inject_script",
  "arguments": {
    "code": "console.log('Test script injected successfully');"
  }
}
```

### Dialog Testing
```json
{
  "tool": "set_dialog_handler",
  "arguments": {
    "enabled": true,
    "autoAccept": true
  }
}

{
  "tool": "execute_javascript",
  "arguments": {
    "script": "alert('This will be auto-handled');"
  }
}

{
  "tool": "handle_alert",
  "arguments": {
    "action": "accept",
    "timeout": 5000
  }
}
```

### Storage Testing
```json
{
  "tool": "manage_storage",
  "arguments": {
    "storageType": "localStorage",
    "action": "set",
    "key": "test-data",
    "value": "MCP test value"
  }
}

{
  "tool": "manage_cookies",
  "arguments": {
    "action": "set",
    "cookie": {
      "name": "mcp-test",
      "value": "testing",
      "path": "/",
      "secure": false
    }
  }
}

{
  "tool": "clear_browser_data",
  "arguments": {
    "dataTypes": ["localStorage", "cookies"]
  }
}
```

## Notes

- **External URLs**: Test pages use external audio/video URLs that may not always be available
- **Browser Policies**: Autoplay may be blocked by browser policies
- **Permissions**: Some features may require user interaction or permissions
- **Cross-Origin**: Some advanced features may be limited by CORS policies
- **Network**: Audio/video loading depends on network connectivity

## Test Coverage

These fixtures provide comprehensive coverage for:
- ✅ Audio playback detection and control
- ✅ Video element testing
- ✅ JavaScript execution and injection
- ✅ Dialog handling (alert, confirm, prompt)
- ✅ Storage management (localStorage, sessionStorage, cookies)
- ✅ Error scenarios and edge cases
- ✅ Performance monitoring and analysis
- ✅ Cross-browser compatibility testing