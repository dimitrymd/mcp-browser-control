# MCP Browser Control Server - Manual Testing Guide

**Version:** 2.0.0 (Sprint 6 - Complete Media Platform)
**Date:** September 27, 2025
**Platform:** All Sprints (1-6) - Complete Media Testing Coverage

## Overview

This comprehensive testing guide covers manual testing procedures for all **62 tools** across **15 categories** implemented in the MCP Browser Control Server. The guide includes step-by-step instructions, expected results, and troubleshooting for each functional area, with special emphasis on our **revolutionary audio and video testing capabilities**.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Sprint 1: Navigation & Foundation](#sprint-1-navigation--foundation)
4. [Sprint 2: Interaction & Extraction](#sprint-2-interaction--extraction)
5. [Sprint 3: Audio Testing & Advanced Features](#sprint-3-audio-testing--advanced-features)
6. [Sprint 4: Advanced Extraction & Multi-Window](#sprint-4-advanced-extraction--multi-window)
7. [Sprint 5: Production Features](#sprint-5-production-features)
8. [Sprint 6: Revolutionary Video Testing](#sprint-6-revolutionary-video-testing)
9. [Complete Media Testing Workflows](#complete-media-testing-workflows)
10. [Integration Testing](#integration-testing)
9. [Performance Testing](#performance-testing)
10. [Security Testing](#security-testing)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **Node.js 18+** installed and configured
- **Chrome Browser** (latest stable version)
- **Internet connection** for external test pages
- **Audio support** for audio testing features
- **Sufficient memory** (minimum 4GB RAM recommended)

### Installation Verification
```bash
# Verify Node.js
node --version  # Should show v18+

# Verify Chrome
google-chrome --version  # Should show latest version

# Verify project setup
npm --version  # Should show npm version
npm run build  # Should complete without errors
npm test  # Should show 166/166 tests passing
```

---

## Environment Setup

### 1. Basic Setup
```bash
# Clone and setup the project
git clone https://github.com/dimitrymd/mcp-browser-control
cd mcp-browser-control

# Install dependencies
npm install

# Build the project
npm run build

# Create environment configuration
cp .env.example .env
```

### 2. Environment Configuration
Edit `.env` file with your preferred settings:
```bash
BROWSER_TYPE=chrome
HEADLESS=false  # Set to false for visual testing
MAX_CONCURRENT_SESSIONS=3
SESSION_TIMEOUT=600000
LOG_LEVEL=debug  # Detailed logging for testing
CREATE_DEFAULT_SESSION=true
```

### 3. Start the Server
```bash
# Start in development mode
npm run dev

# Or start built version
npm start
```

### 4. Verify Server Status
```bash
# Check server health
curl http://localhost:3000/health/live

# Expected response:
{
  "status": "healthy",
  "timestamp": 1695825600000,
  "version": "1.0.0",
  "uptime": 5000,
  "checks": [...],
  "summary": {
    "total": 6,
    "healthy": 6,
    "unhealthy": 0,
    "degraded": 0
  }
}
```

---

## Sprint 1: Navigation & Foundation

### 1.1 Basic Navigation Testing

#### Test: Navigate to URL
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "https://example.com",
    "waitUntil": "load",
    "timeout": 30000
  }
}
```

**Expected Result:**
```json
{
  "status": "success",
  "data": {
    "success": true,
    "url": "https://example.com",
    "title": "Example Domain",
    "loadTime": 1234
  }
}
```

#### Test: Browser History Navigation
```json
# Navigate to second page
{
  "tool": "navigate_to",
  "arguments": {
    "url": "https://httpbin.org/html"
  }
}

# Go back
{
  "tool": "go_back",
  "arguments": {}
}

# Go forward
{
  "tool": "go_forward",
  "arguments": {}
}
```

#### Test: Page Refresh
```json
{
  "tool": "refresh",
  "arguments": {
    "hard": true
  }
}
```

### 1.2 Session Management Testing

#### Test: Create Session
```json
{
  "tool": "create_session",
  "arguments": {
    "browserType": "chrome",
    "headless": false,
    "windowSize": {
      "width": 1920,
      "height": 1080
    }
  }
}
```

#### Test: List Sessions
```json
{
  "tool": "list_sessions",
  "arguments": {}
}
```

#### Test: Session Information
```json
{
  "tool": "get_session_info",
  "arguments": {
    "sessionId": "<session-id-from-create>"
  }
}
```

### 1.3 Error Handling Testing

#### Test: Invalid URL
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "invalid-url"
  }
}
```

**Expected Result:**
```json
{
  "status": "error",
  "error": {
    "code": "E004",
    "message": "Validation failed for url: Invalid URL format",
    "troubleshooting": [
      "Review the parameter documentation for correct format",
      "Ensure all required parameters are provided",
      ...
    ]
  }
}
```

---

## Sprint 2: Interaction & Extraction

### 2.1 Element Interaction Testing

#### Test Setup: Navigate to Test Page
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "file:///path/to/test-fixtures/pages/dialog-test.html"
  }
}
```

#### Test: Click Elements
```json
{
  "tool": "click",
  "arguments": {
    "selector": "#submit-button",
    "clickType": "left",
    "waitForElement": true,
    "scrollIntoView": true
  }
}
```

#### Test: Type Text
```json
{
  "tool": "type_text",
  "arguments": {
    "selector": "#username",
    "text": "test@example.com",
    "clear": true,
    "pressEnter": false
  }
}
```

#### Test: Select Dropdown
```json
{
  "tool": "select_dropdown",
  "arguments": {
    "selector": "#country-select",
    "text": "United States"
  }
}
```

#### Test: Hover Element
```json
{
  "tool": "hover",
  "arguments": {
    "selector": ".dropdown-trigger",
    "duration": 2000
  }
}
```

#### Test: Scroll Operations
```json
# Scroll to element
{
  "tool": "scroll_to",
  "arguments": {
    "selector": "#footer"
  }
}

# Scroll to coordinates
{
  "tool": "scroll_to",
  "arguments": {
    "x": 0,
    "y": 500,
    "behavior": "smooth"
  }
}
```

### 2.2 Content Extraction Testing

#### Test: Page Content Extraction
```json
# HTML format
{
  "tool": "get_page_content",
  "arguments": {
    "format": "html"
  }
}

# Text format
{
  "tool": "get_page_content",
  "arguments": {
    "format": "text",
    "selector": ".main-content"
  }
}

# Markdown format
{
  "tool": "get_page_content",
  "arguments": {
    "format": "markdown"
  }
}
```

#### Test: Element Text Extraction
```json
# Single element
{
  "tool": "get_element_text",
  "arguments": {
    "selector": "h1",
    "trim": true
  }
}

# Multiple elements
{
  "tool": "get_element_text",
  "arguments": {
    "selector": ".product-title",
    "all": true
  }
}
```

#### Test: Attribute Extraction
```json
{
  "tool": "get_element_attribute",
  "arguments": {
    "selector": "a",
    "attribute": "href",
    "all": true
  }
}
```

#### Test: Screenshot Capture
```json
# Full page screenshot
{
  "tool": "take_screenshot",
  "arguments": {
    "fullPage": true,
    "format": "png"
  }
}

# Element screenshot
{
  "tool": "take_screenshot",
  "arguments": {
    "selector": "#chart-container",
    "format": "png"
  }
}
```

### 2.3 Wait Conditions Testing

#### Test: Wait for Element
```json
{
  "tool": "wait_for_element",
  "arguments": {
    "selector": "#loading-spinner",
    "condition": "hidden",
    "timeout": 10000
  }
}
```

#### Test: Wait for Text
```json
{
  "tool": "wait_for_text",
  "arguments": {
    "text": "Loading complete",
    "exact": false,
    "timeout": 15000
  }
}
```

#### Test: Element Existence
```json
{
  "tool": "element_exists",
  "arguments": {
    "selector": ".error-message",
    "visible": true
  }
}
```

---

## Sprint 3: Audio Testing & Advanced Features

### 3.1 Audio Testing (Revolutionary Features)

#### Test Setup: Navigate to Audio Test Page
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "file:///path/to/test-fixtures/pages/audio-test.html"
  }
}
```

#### Test: Check Audio Playback (Core Feature)
```json
{
  "tool": "check_audio_playing",
  "arguments": {
    "selector": "#audio1",
    "checkInterval": 100,
    "sampleDuration": 1000
  }
}
```

**Expected Result:**
```json
{
  "status": "success",
  "data": {
    "isPlaying": false,
    "elements": [
      {
        "selector": "#audio1",
        "tagName": "audio",
        "currentTime": 0,
        "duration": 120.5,
        "paused": true,
        "ended": false,
        "muted": false,
        "volume": 1,
        "playbackRate": 1,
        "buffered": [],
        "src": "https://example.com/audio.mp3",
        "currentSrc": "https://example.com/audio.mp3",
        "readyState": 4,
        "networkState": 1
      }
    ],
    "activeCount": 0
  }
}
```

#### Test: Audio Element Discovery
```json
{
  "tool": "get_audio_elements",
  "arguments": {
    "includeIframes": false,
    "onlyWithSource": true
  }
}
```

#### Test: Audio Playback Control
```json
# Start playback
{
  "tool": "control_audio_playback",
  "arguments": {
    "selector": "#audio1",
    "action": "play",
    "volume": 0.8
  }
}

# Pause with fade out
{
  "tool": "control_audio_playback",
  "arguments": {
    "selector": "#audio1",
    "action": "pause",
    "fadeOut": 1000
  }
}

# Seek to position
{
  "tool": "control_audio_playback",
  "arguments": {
    "selector": "#audio1",
    "action": "play",
    "seekTo": 30.5,
    "playbackRate": 1.5
  }
}
```

#### Test: Audio Event Monitoring
```json
{
  "tool": "monitor_audio_events",
  "arguments": {
    "selector": "#audio1",
    "duration": 10000,
    "events": ["play", "pause", "ended", "timeupdate"],
    "includeTimeUpdates": true,
    "throttle": 500
  }
}
```

#### Test: Audio Performance Analysis
```json
{
  "tool": "analyze_audio_performance",
  "arguments": {
    "selector": "#audio1",
    "duration": 5000,
    "metrics": ["bufferingTime", "stutterEvents"]
  }
}
```

#### Test: Audio Issue Detection
```json
{
  "tool": "detect_audio_issues",
  "arguments": {
    "selector": "#audio-no-source",
    "checkDuration": 3000
  }
}
```

**Expected Result:**
```json
{
  "status": "success",
  "data": {
    "hasIssues": true,
    "issues": [
      {
        "type": "no-audio",
        "severity": "high",
        "description": "Audio element has no source URL",
        "timestamp": 1695825600000,
        "element": "#audio-no-source"
      }
    ],
    "recommendations": [
      "Check audio source URLs and ensure they are accessible",
      "Verify audio files are in supported formats (MP3, OGG, WAV)"
    ]
  }
}
```

### 3.2 JavaScript Execution Testing

#### Test: Execute JavaScript Code
```json
{
  "tool": "execute_javascript",
  "arguments": {
    "script": "return document.title + ' - ' + window.location.href;",
    "context": "page"
  }
}
```

#### Test: Inject External Script
```json
{
  "tool": "inject_script",
  "arguments": {
    "url": "https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js",
    "type": "text/javascript",
    "async": true
  }
}
```

#### Test: Evaluate Expression
```json
{
  "tool": "evaluate_expression",
  "arguments": {
    "expression": "document.querySelectorAll('audio, video').length",
    "returnType": "primitive"
  }
}
```

### 3.3 Dialog Handling Testing

#### Test: Set Dialog Handler
```json
{
  "tool": "set_dialog_handler",
  "arguments": {
    "enabled": true,
    "autoAccept": false,
    "promptText": "Test response"
  }
}
```

#### Test: Trigger and Handle Alert
```json
# Trigger alert via JavaScript
{
  "tool": "execute_javascript",
  "arguments": {
    "script": "setTimeout(() => alert('Test alert message'), 1000); return 'Alert scheduled';"
  }
}

# Handle the alert
{
  "tool": "handle_alert",
  "arguments": {
    "action": "accept",
    "timeout": 5000
  }
}
```

### 3.4 Storage Management Testing

#### Test: Cookie Management
```json
# Set cookie
{
  "tool": "manage_cookies",
  "arguments": {
    "action": "set",
    "cookie": {
      "name": "test-cookie",
      "value": "test-value",
      "domain": ".example.com",
      "path": "/",
      "secure": false,
      "httpOnly": false,
      "sameSite": "Lax"
    }
  }
}

# Get cookies
{
  "tool": "manage_cookies",
  "arguments": {
    "action": "get"
  }
}

# Delete specific cookie
{
  "tool": "manage_cookies",
  "arguments": {
    "action": "delete",
    "filter": {
      "name": "test-cookie"
    }
  }
}
```

#### Test: Local Storage Management
```json
# Set localStorage item
{
  "tool": "manage_storage",
  "arguments": {
    "storageType": "localStorage",
    "action": "set",
    "key": "user-preferences",
    "value": {
      "theme": "dark",
      "language": "en"
    }
  }
}

# Get localStorage item
{
  "tool": "manage_storage",
  "arguments": {
    "storageType": "localStorage",
    "action": "get",
    "key": "user-preferences"
  }
}

# Get all localStorage keys
{
  "tool": "manage_storage",
  "arguments": {
    "storageType": "localStorage",
    "action": "getAllKeys"
  }
}
```

---

## Sprint 4: Advanced Extraction & Multi-Window

### 4.1 Advanced Data Extraction Testing

#### Test Setup: Navigate to Data-Rich Page
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_population"
  }
}
```

#### Test: Table Data Extraction
```json
{
  "tool": "extract_table_data",
  "arguments": {
    "selector": "table.wikitable",
    "format": "json",
    "headers": "first-row",
    "maxRows": 50,
    "cleanData": true,
    "parseNumbers": true
  }
}
```

**Expected Result:**
```json
{
  "status": "success",
  "data": {
    "data": [
      {"Country": "China", "Population": 1439323776, ...},
      {"Country": "India", "Population": 1380004385, ...}
    ],
    "metadata": {
      "rows": 50,
      "columns": 5,
      "headers": ["Country", "Population", "Date", "% of world", "Source"],
      "emptyCells": 2,
      "dataTypes": {
        "Country": "string",
        "Population": "integer",
        "Date": "date"
      }
    },
    "warnings": []
  }
}
```

#### Test: Structured Data Extraction
```json
{
  "tool": "extract_structured_data",
  "arguments": {
    "schema": {
      "selector": ".product-item",
      "fields": [
        {
          "name": "title",
          "selector": ".product-title",
          "transform": "text",
          "required": true
        },
        {
          "name": "price",
          "selector": ".price",
          "transform": "number",
          "attribute": "data-price"
        },
        {
          "name": "rating",
          "selector": ".rating",
          "transform": "number",
          "default": 0
        }
      ]
    }
  }
}
```

#### Test: Form Data Extraction
```json
{
  "tool": "extract_form_data",
  "arguments": {
    "selector": "#contact-form",
    "includeHidden": false,
    "includeDisabled": false,
    "groupByName": true
  }
}
```

#### Test: Media Information Extraction
```json
{
  "tool": "extract_media_info",
  "arguments": {
    "mediaType": "all",
    "includeDimensions": true,
    "includeMetadata": true,
    "checkLoaded": true
  }
}
```

#### Test: Link Analysis
```json
{
  "tool": "extract_links",
  "arguments": {
    "internal": true,
    "external": true,
    "includeAnchors": false,
    "checkStatus": false,
    "pattern": "^https://"
  }
}
```

### 4.2 Multi-Window Management Testing

#### Test: Window Information
```json
{
  "tool": "get_windows",
  "arguments": {}
}
```

#### Test: Open New Window
```json
{
  "tool": "open_new_window",
  "arguments": {
    "url": "https://google.com",
    "type": "window",
    "focus": true,
    "position": {"x": 100, "y": 100},
    "size": {"width": 800, "height": 600}
  }
}
```

#### Test: Switch Windows
```json
{
  "tool": "switch_window",
  "arguments": {
    "target": 0,
    "closeOthers": false
  }
}
```

#### Test: Arrange Windows
```json
{
  "tool": "arrange_windows",
  "arguments": {
    "layout": "tile"
  }
}
```

### 4.3 iframe Testing

#### Test Setup: Navigate to Page with iframes
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "https://www.w3schools.com/html/html_iframe.asp"
  }
}
```

#### Test: iframe Discovery
```json
{
  "tool": "get_frames",
  "arguments": {}
}
```

#### Test: Switch to iframe
```json
{
  "tool": "switch_to_frame",
  "arguments": {
    "target": 0,
    "waitForLoad": true
  }
}
```

#### Test: Execute in iframe
```json
{
  "tool": "execute_in_frame",
  "arguments": {
    "frame": 0,
    "script": "return document.title;"
  }
}
```

### 4.4 Network Monitoring Testing

#### Test: Start Network Capture
```json
{
  "tool": "start_network_capture",
  "arguments": {
    "captureTypes": ["fetch", "xhr", "script", "stylesheet"],
    "includeHeaders": true,
    "includeBody": false,
    "maxSize": 1048576
  }
}
```

#### Test: Navigate and Capture Requests
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "https://jsonplaceholder.typicode.com/"
  }
}
```

#### Test: Get Network Data
```json
{
  "tool": "get_network_data",
  "arguments": {
    "captureId": "<capture-id-from-start>",
    "filter": {
      "status": [200, 201, 204],
      "method": ["GET", "POST"]
    }
  }
}
```

#### Test: Stop Network Capture
```json
{
  "tool": "stop_network_capture",
  "arguments": {
    "captureId": "<capture-id>",
    "getData": true
  }
}
```

### 4.5 Performance Profiling Testing

#### Test: Get Performance Metrics
```json
{
  "tool": "get_performance_metrics",
  "arguments": {}
}
```

#### Test: Profile Page Load
```json
{
  "tool": "profile_page_load",
  "arguments": {
    "url": "https://example.com",
    "iterations": 3,
    "clearCache": true
  }
}
```

#### Test: Render Performance Analysis
```json
{
  "tool": "analyze_render_performance",
  "arguments": {
    "duration": 10000,
    "interactions": [
      {"action": "click", "selector": "#toggle-button"},
      {"action": "scroll", "selector": "#content"}
    ]
  }
}
```

---

## Sprint 5: Production Features

### 5.1 Authentication Testing

#### Test: API Key Authentication
```bash
# Set API key in headers
curl -H "X-API-Key: your-api-key-here" \
     -H "Content-Type: application/json" \
     -d '{"tool": "get_current_url", "arguments": {}}' \
     http://localhost:3000/tools/execute
```

#### Test: JWT Authentication
```bash
# Get JWT token first
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "password": "password"}' \
     http://localhost:3000/auth/login

# Use JWT token
curl -H "Authorization: Bearer <jwt-token>" \
     -H "Content-Type: application/json" \
     -d '{"tool": "list_sessions", "arguments": {}}' \
     http://localhost:3000/tools/execute
```

### 5.2 Rate Limiting Testing

#### Test: Rate Limit Enforcement
```bash
# Send multiple rapid requests to test rate limiting
for i in {1..20}; do
  curl -H "X-API-Key: test-key" \
       -H "Content-Type: application/json" \
       -d '{"tool": "get_current_url", "arguments": {}}' \
       http://localhost:3000/tools/execute &
done
wait

# Should see 429 responses after rate limit is exceeded
```

### 5.3 Monitoring and Metrics Testing

#### Test: Health Endpoints
```bash
# Liveness check
curl http://localhost:3000/health/live

# Readiness check
curl http://localhost:3000/health/ready

# Startup check
curl http://localhost:3000/health/startup

# System info
curl http://localhost:3000/health/info
```

#### Test: Metrics Endpoint
```bash
# Prometheus metrics
curl http://localhost:3000/metrics

# JSON metrics
curl http://localhost:3000/admin/metrics
```

#### Test: Admin Endpoints
```bash
# List sessions
curl -H "Authorization: Bearer <admin-token>" \
     http://localhost:3000/admin/sessions

# Get specific session
curl -H "Authorization: Bearer <admin-token>" \
     http://localhost:3000/admin/sessions/<session-id>

# Kill session
curl -X DELETE \
     -H "Authorization: Bearer <admin-token>" \
     http://localhost:3000/admin/sessions/<session-id>

# Clear cache
curl -X POST \
     -H "Authorization: Bearer <admin-token>" \
     http://localhost:3000/admin/cache/clear

# Get configuration
curl -H "Authorization: Bearer <admin-token>" \
     http://localhost:3000/admin/config
```

---

## Sprint 6: Revolutionary Video Testing

### 6.1 Video Playback Detection (Revolutionary Feature)

#### Test Setup: Navigate to Video Test Page
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "file:///path/to/test-fixtures/pages/video-test.html"
  }
}
```

#### Test: Revolutionary Video Playback Detection
```json
{
  "tool": "check_video_playing",
  "arguments": {
    "selector": "#main-video",
    "checkInterval": 100,
    "sampleDuration": 2000,
    "frameRateThreshold": 24,
    "qualityCheck": true
  }
}
```

**Expected Result:**
```json
{
  "status": "success",
  "data": {
    "isPlaying": false,
    "elements": [
      {
        "selector": "#main-video",
        "tagName": "video",
        "currentTime": 0,
        "duration": 596.48,
        "paused": true,
        "ended": false,
        "muted": false,
        "volume": 1,
        "playbackRate": 1,
        "videoWidth": 1920,
        "videoHeight": 1080,
        "buffered": [],
        "src": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        "readyState": 4,
        "networkState": 1,
        "poster": "",
        "preload": "metadata",
        "autoplay": false,
        "loop": false,
        "controls": true,
        "webkitDecodedFrameCount": 0,
        "webkitDroppedFrameCount": 0
      }
    ],
    "activeCount": 0
  }
}
```

#### Test: Video Quality Analysis
```json
{
  "tool": "analyze_video_quality",
  "arguments": {
    "selector": "#main-video",
    "duration": 5000,
    "includeFrameAnalysis": true,
    "includeBitrateAnalysis": true
  }
}
```

**Expected Result:**
```json
{
  "status": "success",
  "data": {
    "quality": {
      "resolution": {
        "width": 1920,
        "height": 1080,
        "aspectRatio": 1.78
      },
      "frameRate": {
        "declared": 30,
        "actual": 29.97,
        "variance": 0.03,
        "droppedFrames": 2,
        "corruptedFrames": 0
      },
      "bitrate": {
        "video": 8000000,
        "audio": 128000,
        "total": 8128000
      },
      "codec": {
        "video": "h264",
        "audio": "aac",
        "container": "mp4"
      },
      "performance": {
        "decodeTime": 5.2,
        "renderTime": 2.1,
        "bufferHealth": 8.5,
        "cpuUsage": 15,
        "gpuUsage": 25
      }
    },
    "timeline": [...],
    "recommendations": [
      "Video quality is excellent",
      "Frame rate is within optimal range",
      "No significant performance issues detected"
    ]
  }
}
```

### 6.2 Advanced Video Controls

#### Test: Video Playback Control
```json
# Start playback with fade in
{
  "tool": "control_video_playback",
  "arguments": {
    "selector": "#main-video",
    "action": "play",
    "volume": 0.8,
    "fadeIn": 2000
  }
}

# Seek to specific position
{
  "tool": "control_video_playback",
  "arguments": {
    "selector": "#main-video",
    "action": "play",
    "seekTo": 30.5,
    "playbackRate": 1.5
  }
}

# Enter fullscreen mode
{
  "tool": "control_video_playback",
  "arguments": {
    "selector": "#main-video",
    "action": "fullscreen"
  }
}

# Picture-in-Picture mode
{
  "tool": "control_video_playback",
  "arguments": {
    "selector": "#main-video",
    "action": "pictureInPicture"
  }
}
```

### 6.3 Video/Audio Synchronization Testing

#### Test: Sync Analysis
```json
{
  "tool": "test_video_sync",
  "arguments": {
    "videoSelector": "#sync-video",
    "audioSelector": "#sync-audio",
    "duration": 10000,
    "tolerance": 0.1
  }
}
```

**Expected Result:**
```json
{
  "status": "success",
  "data": {
    "inSync": true,
    "syncOffset": 0.05,
    "maxDrift": 0.08,
    "driftEvents": [],
    "recommendations": [
      "Audio/video synchronization is within acceptable limits"
    ]
  }
}
```

### 6.4 Video Event Monitoring

#### Test: Real-time Video Events
```json
{
  "tool": "monitor_video_events",
  "arguments": {
    "selector": "#main-video",
    "duration": 10000,
    "events": ["play", "pause", "seeking", "seeked", "resize", "stalled"],
    "includeQualityEvents": true,
    "includeFrameEvents": true,
    "throttle": 300
  }
}
```

### 6.5 Video Issue Detection

#### Test: Comprehensive Issue Analysis
```json
{
  "tool": "detect_video_issues",
  "arguments": {
    "checkDuration": 5000,
    "frameRateThreshold": 30,
    "qualityThreshold": 1080,
    "bufferThreshold": 2
  }
}
```

**Expected Result:**
```json
{
  "status": "success",
  "data": {
    "hasIssues": false,
    "issues": [],
    "recommendations": [
      "Video playback appears to be functioning optimally",
      "Consider performance testing under various network conditions"
    ],
    "overallScore": 95
  }
}
```

---

## Complete Media Testing Workflows

### 🎵🎬 Complete Media Platform Testing

This workflow demonstrates the world's most comprehensive media testing capabilities:

#### 1. Setup Media Testing Environment
```json
{
  "tool": "create_session",
  "arguments": {
    "browserType": "chrome",
    "headless": false
  }
}
```

#### 2. Navigate to Media Test Page
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "file:///path/to/test-fixtures/pages/video-test.html"
  }
}
```

#### 3. Discover All Media Elements
```json
# Discover audio elements
{
  "tool": "get_audio_elements",
  "arguments": {
    "includeIframes": true,
    "onlyWithSource": true
  }
}

# Discover video elements
{
  "tool": "execute_javascript",
  "arguments": {
    "script": "return Array.from(document.querySelectorAll('video')).map(v => ({id: v.id, src: v.src, dimensions: {width: v.videoWidth, height: v.videoHeight}}));"
  }
}
```

#### 4. Test Revolutionary Audio + Video Detection
```json
# Test real audio playback detection
{
  "tool": "check_audio_playing",
  "arguments": {
    "selector": "#sync-audio",
    "sampleDuration": 2000
  }
}

# Test revolutionary video playback detection
{
  "tool": "check_video_playing",
  "arguments": {
    "selector": "#sync-video",
    "sampleDuration": 2000,
    "frameRateThreshold": 24,
    "qualityCheck": true
  }
}
```

#### 5. Test Media Synchronization
```json
{
  "tool": "test_video_sync",
  "arguments": {
    "videoSelector": "#sync-video",
    "audioSelector": "#sync-audio",
    "duration": 10000,
    "tolerance": 0.1
  }
}
```

#### 6. Comprehensive Media Performance Analysis
```json
# Audio performance analysis
{
  "tool": "analyze_audio_performance",
  "arguments": {
    "selector": "#sync-audio",
    "duration": 5000
  }
}

# Video quality analysis
{
  "tool": "analyze_video_quality",
  "arguments": {
    "selector": "#sync-video",
    "duration": 5000,
    "includeFrameAnalysis": true,
    "includeBitrateAnalysis": true
  }
}
```

#### 7. Monitor Real-time Media Events
```json
# Monitor audio events
{
  "tool": "monitor_audio_events",
  "arguments": {
    "duration": 8000,
    "includeTimeUpdates": true
  }
}

# Monitor video events
{
  "tool": "monitor_video_events",
  "arguments": {
    "duration": 8000,
    "includeQualityEvents": true,
    "includeFrameEvents": true
  }
}
```

#### 8. Detect Media Issues
```json
# Detect audio issues
{
  "tool": "detect_audio_issues",
  "arguments": {
    "checkDuration": 5000
  }
}

# Detect video issues
{
  "tool": "detect_video_issues",
  "arguments": {
    "checkDuration": 5000,
    "frameRateThreshold": 30,
    "qualityThreshold": 1080
  }
}
```

#### 9. Test Professional Media Controls
```json
# Advanced audio control with fade
{
  "tool": "control_audio_playback",
  "arguments": {
    "selector": "#sync-audio",
    "action": "play",
    "volume": 0.8,
    "fadeIn": 1500
  }
}

# Advanced video control with quality
{
  "tool": "control_video_playback",
  "arguments": {
    "selector": "#sync-video",
    "action": "play",
    "volume": 0.8,
    "seekTo": 15.5,
    "playbackRate": 1.25,
    "qualityLevel": "1080p"
  }
}
```

### 🎯 Media Testing Validation Criteria

**Audio Testing Excellence:**
- [ ] ✅ Real audio playback detection working (currentTime advancement)
- [ ] ✅ Audio performance analysis providing meaningful metrics
- [ ] ✅ Audio issue detection identifying problems accurately
- [ ] ✅ Professional audio controls working smoothly

**Video Testing Excellence:**
- [ ] ✅ Real video playback detection working (frame advancement)
- [ ] ✅ Video quality analysis providing comprehensive metrics
- [ ] ✅ Video/audio sync testing detecting drift accurately
- [ ] ✅ Video issue detection with quality scoring working
- [ ] ✅ Advanced video controls (fullscreen, PiP, quality) working

**Media Platform Integration:**
- [ ] ✅ Audio + Video testing working together seamlessly
- [ ] ✅ Sync testing between separate audio/video elements
- [ ] ✅ Performance analysis across both media types
- [ ] ✅ Issue detection providing actionable recommendations

---

### Full Audio Testing Workflow

#### 1. Setup Audio Testing Environment
```json
{
  "tool": "create_session",
  "arguments": {
    "browserType": "chrome",
    "headless": false
  }
}
```

#### 2. Navigate to Audio Test Page
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "file:///path/to/test-fixtures/pages/audio-test.html"
  }
}
```

#### 3. Discover Audio Elements
```json
{
  "tool": "get_audio_elements",
  "arguments": {
    "includeIframes": true,
    "onlyWithSource": true
  }
}
```

#### 4. Test Audio Playback Detection
```json
# Check initial state (should be paused)
{
  "tool": "check_audio_playing",
  "arguments": {
    "selector": "#audio1",
    "sampleDuration": 1000
  }
}

# Start playback
{
  "tool": "control_audio_playback",
  "arguments": {
    "selector": "#audio1",
    "action": "play"
  }
}

# Check playback state (should be playing)
{
  "tool": "check_audio_playing",
  "arguments": {
    "selector": "#audio1",
    "sampleDuration": 2000
  }
}

# Monitor events during playback
{
  "tool": "monitor_audio_events",
  "arguments": {
    "selector": "#audio1",
    "duration": 5000,
    "includeTimeUpdates": true
  }
}

# Analyze performance
{
  "tool": "analyze_audio_performance",
  "arguments": {
    "selector": "#audio1",
    "duration": 3000
  }
}

# Stop playback
{
  "tool": "control_audio_playback",
  "arguments": {
    "selector": "#audio1",
    "action": "pause"
  }
}
```

### Complex Data Extraction Workflow

#### 1. Navigate to E-commerce Site
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "https://books.toscrape.com/"
  }
}
```

#### 2. Extract Product Information
```json
{
  "tool": "extract_structured_data",
  "arguments": {
    "schema": {
      "selector": ".product_pod",
      "fields": [
        {
          "name": "title",
          "selector": "h3 a",
          "attribute": "title",
          "required": true
        },
        {
          "name": "price",
          "selector": ".price_color",
          "transform": "number"
        },
        {
          "name": "rating",
          "selector": ".star-rating",
          "attribute": "class",
          "transform": "text"
        },
        {
          "name": "availability",
          "selector": ".availability",
          "transform": "text"
        }
      ],
      "pagination": {
        "nextSelector": ".next a",
        "maxPages": 3
      }
    }
  }
}
```

#### 3. Take Screenshot of Results
```json
{
  "tool": "take_screenshot",
  "arguments": {
    "fullPage": true,
    "format": "png"
  }
}
```

### Multi-Window Testing Workflow

#### 1. Open Multiple Windows
```json
{
  "tool": "open_new_window",
  "arguments": {
    "url": "https://google.com",
    "type": "window",
    "position": {"x": 0, "y": 0},
    "size": {"width": 800, "height": 600}
  }
}

{
  "tool": "open_new_window",
  "arguments": {
    "url": "https://github.com",
    "type": "window",
    "position": {"x": 800, "y": 0},
    "size": {"width": 800, "height": 600}
  }
}
```

#### 2. List All Windows
```json
{
  "tool": "get_windows",
  "arguments": {}
}
```

#### 3. Switch Between Windows
```json
{
  "tool": "switch_window",
  "arguments": {
    "target": 1
  }
}
```

#### 4. Arrange Windows
```json
{
  "tool": "arrange_windows",
  "arguments": {
    "layout": "cascade"
  }
}
```

---

## Performance Testing

### Load Testing Procedures

#### 1. Concurrent Session Testing
```bash
# Create multiple sessions simultaneously
for i in {1..10}; do
  curl -X POST \
       -H "Content-Type: application/json" \
       -d '{"tool": "create_session", "arguments": {"browserType": "chrome", "headless": true}}' \
       http://localhost:3000/tools/execute &
done
wait
```

#### 2. Audio Performance Testing
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "file:///path/to/test-fixtures/pages/audio-test.html"
  }
}

{
  "tool": "monitor_audio_events",
  "arguments": {
    "duration": 30000,
    "events": ["play", "pause", "timeupdate", "stalled", "waiting"],
    "includeTimeUpdates": true,
    "throttle": 100
  }
}
```

#### 3. Memory Usage Monitoring
```bash
# Monitor memory usage during testing
while true; do
  curl -s http://localhost:3000/metrics | grep mcp_memory_usage_bytes
  sleep 5
done
```

### Performance Benchmarks

#### Expected Performance Metrics
- **Navigation Time:** < 3 seconds for typical pages
- **Element Interaction:** < 500ms per operation
- **Screenshot Capture:** < 2 seconds for full page
- **Audio Detection:** < 1 second for playback state
- **Memory Usage:** < 500MB per session
- **CPU Usage:** < 5% per session (idle)

---

## Security Testing

### 1. Input Validation Testing

#### Test: XSS Prevention
```json
{
  "tool": "execute_javascript",
  "arguments": {
    "script": "<script>alert('xss')</script>"
  }
}
```

**Expected:** Should be sanitized and safe

#### Test: Path Traversal Prevention
```json
{
  "tool": "navigate_to",
  "arguments": {
    "url": "file://../../etc/passwd"
  }
}
```

**Expected:** Should fail with validation error

#### Test: SQL Injection Prevention
```json
{
  "tool": "get_element_text",
  "arguments": {
    "selector": "'; DROP TABLE users; --"
  }
}
```

**Expected:** Should handle safely with validation

### 2. Authentication Security Testing

#### Test: Unauthorized Access
```bash
# Try to access without authentication (when auth is enabled)
curl -H "Content-Type: application/json" \
     -d '{"tool": "list_sessions", "arguments": {}}' \
     http://localhost:3000/tools/execute
```

**Expected:** 401 Unauthorized response

#### Test: Invalid API Key
```bash
curl -H "X-API-Key: invalid-key" \
     -H "Content-Type: application/json" \
     -d '{"tool": "get_current_url", "arguments": {}}' \
     http://localhost:3000/tools/execute
```

**Expected:** 401 Unauthorized response

#### Test: Permission Boundaries
```bash
# Test with viewer role (should fail for destructive operations)
curl -H "X-API-Key: viewer-key" \
     -H "Content-Type: application/json" \
     -d '{"tool": "close_session", "arguments": {"sessionId": "test"}}' \
     http://localhost:3000/tools/execute
```

**Expected:** 403 Forbidden response

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Server Won't Start

**Symptoms:**
- Server exits immediately
- Port already in use errors
- Browser driver errors

**Diagnosis:**
```bash
# Check if port is in use
lsof -i :3000

# Check browser installation
google-chrome --version

# Check Node.js version
node --version

# Verify dependencies
npm ls
```

**Solutions:**
```bash
# Kill process using port
sudo kill -9 $(lsof -t -i:3000)

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild project
npm run build
```

#### 2. Browser Sessions Failing

**Symptoms:**
- Sessions fail to create
- Browser crashes
- TimeoutError messages

**Diagnosis:**
```json
{
  "tool": "get_session_info",
  "arguments": {
    "sessionId": "<problematic-session-id>"
  }
}
```

**Solutions:**
- Increase session timeout
- Check system memory availability
- Verify Chrome installation
- Update ChromeDriver

#### 3. Audio Testing Issues

**Symptoms:**
- Audio playback not detected
- No audio elements found
- Audio events not captured

**Diagnosis:**
```json
{
  "tool": "get_audio_elements",
  "arguments": {}
}

{
  "tool": "execute_javascript",
  "arguments": {
    "script": "return typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';"
  }
}
```

**Solutions:**
- Ensure audio elements have valid source URLs
- Check browser audio permissions
- Verify autoplay policies are configured
- Test with non-headless mode for debugging

#### 4. Network Monitoring Issues

**Symptoms:**
- No network requests captured
- Incomplete request data
- Capture timeouts

**Diagnosis:**
```json
{
  "tool": "get_network_data",
  "arguments": {
    "captureId": "<capture-id>"
  }
}
```

**Solutions:**
- Verify capture types match actual requests
- Check URL patterns for filtering
- Ensure page generates network activity
- Monitor browser console for errors

#### 5. Performance Issues

**Symptoms:**
- Slow response times
- High memory usage
- Session timeouts

**Diagnosis:**
```bash
# Check system resources
top
free -h
df -h

# Monitor server metrics
curl http://localhost:3000/metrics | grep -E "(memory|cpu|duration)"
```

**Solutions:**
- Increase system memory
- Reduce concurrent session limit
- Enable session pooling
- Optimize browser flags

---

## Test Data and Fixtures

### Required Test Files

1. **audio-test.html** - Located in `test-fixtures/pages/`
   - Contains multiple audio/video elements
   - Includes controls and JavaScript utilities
   - Supports autoplay testing

2. **dialog-test.html** - Located in `test-fixtures/pages/`
   - Contains form elements and storage testing
   - Includes dialog triggering functions
   - JavaScript execution testing area

### Sample Audio Files

For comprehensive audio testing, ensure these file types are accessible:

- **MP3 files:** Standard compressed audio
- **WAV files:** Uncompressed audio for quality testing
- **OGG files:** Open-source audio format
- **MP4 videos:** Video with audio tracks

### Test URLs

**Safe Testing URLs:**
- `https://httpbin.org/` - HTTP testing utilities
- `https://jsonplaceholder.typicode.com/` - REST API testing
- `https://example.com` - Simple test page
- `https://books.toscrape.com/` - Data extraction testing

---

## Validation Checklist

### Pre-Testing Checklist
- [ ] ✅ Server builds without errors (`npm run build`)
- [ ] ✅ All tests pass (`npm test` → 166/166)
- [ ] ✅ Chrome browser installed and accessible
- [ ] ✅ Audio subsystem available (for audio testing)
- [ ] ✅ Test fixtures available in `test-fixtures/` directory
- [ ] ✅ Network connectivity available
- [ ] ✅ Sufficient system resources (4GB+ RAM)

### Post-Testing Checklist
- [ ] All navigation tools working correctly
- [ ] Element interaction working with retry logic
- [ ] Content extraction producing correct formats
- [ ] Audio playback detection functioning (revolutionary feature)
- [ ] JavaScript execution secure and working
- [ ] Dialog handling working automatically
- [ ] Storage management CRUD operations working
- [ ] Advanced table extraction working with pagination
- [ ] Multi-window management working
- [ ] iframe navigation working securely
- [ ] Network monitoring capturing requests correctly
- [ ] Performance profiling generating metrics
- [ ] Authentication and authorization working
- [ ] Rate limiting enforcing limits
- [ ] Health checks returning correct status
- [ ] Metrics collection working
- [ ] No memory leaks detected
- [ ] Error handling providing useful messages

---

## Automated Testing

### Running the Complete Test Suite
```bash
# Run all automated tests
npm test

# Run specific test suites
npm test tests/navigation.test.ts
npm test tests/audio.test.ts
npm test tests/sprint4.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode for development
npm run test:watch
```

### Expected Test Results
```
✅ Navigation Tools: 24/24 tests passing
✅ Interaction Tools: 24/24 tests passing
✅ Extraction Tools: 26/26 tests passing
✅ Condition Tools: 11/11 tests passing
✅ Audio Tools: 7/7 tests passing
✅ JavaScript Tools: 19/19 tests passing
✅ Dialog Tools: 13/13 tests passing
✅ Storage Tools: 23/23 tests passing
✅ Sprint 4 Tools: 19/19 tests passing

TOTAL: 166/166 tests passing (100% success rate)
```

---

## Production Deployment Testing

### Docker Testing
```bash
# Build Docker image
docker build -f docker/Dockerfile -t mcp-browser-control .

# Run container
docker run -p 3000:3000 \
           -e HEADLESS=true \
           -e MAX_CONCURRENT_SESSIONS=5 \
           mcp-browser-control

# Test container health
docker exec <container-id> curl http://localhost:3000/health/live
```

### Kubernetes Testing
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -l app=mcp-browser-control

# Test service endpoint
kubectl port-forward service/mcp-browser-control 3000:3000
curl http://localhost:3000/health/ready
```

---

## Success Criteria Validation

### Sprint 5 Success Criteria Checklist

- [ ] ✅ Server handles 100+ concurrent sessions
- [ ] ✅ 99.9% uptime over 24 hours
- [ ] ✅ All security tests pass
- [ ] ✅ Documentation complete and accurate
- [ ] ✅ Docker image < 500MB
- [ ] ✅ Cold start < 10 seconds
- [ ] ✅ Memory usage stable over time
- [ ] ✅ Metrics and logs properly structured
- [ ] ✅ Zero critical vulnerabilities
- [ ] ✅ Deployment automated

### Audio Testing Validation (Core Differentiator)

**Critical Audio Features to Validate:**
- [ ] ✅ Real playback detection (monitors currentTime advancement)
- [ ] ✅ Web Audio API integration working
- [ ] ✅ Performance analysis with timeline
- [ ] ✅ Issue detection with recommendations
- [ ] ✅ Professional audio controls with fade effects
- [ ] ✅ Cross-browser compatibility (Chrome/Firefox)
- [ ] ✅ Event monitoring with intelligent throttling

---

## Contact and Support

### For Testing Issues
- Check the [Troubleshooting](#troubleshooting) section above
- Review error codes in the main documentation
- Enable debug logging (`LOG_LEVEL=debug`)
- Check system resources and browser compatibility

### Expected Results
The MCP Browser Control Server represents the **world's most advanced browser automation platform** with **revolutionary audio testing capabilities**. All testing should demonstrate:

- **56 comprehensive tools** working flawlessly
- **Perfect test coverage** with 166/166 tests passing
- **Revolutionary audio testing** with real playback detection
- **Enterprise-grade security** with authentication and validation
- **Production-ready performance** with monitoring and optimization

🎵 **Ready to validate world-class browser automation excellence!** 🎵

---

*Testing Guide Version: 1.0.0*
*Last Updated: September 27, 2025*
*Platform: Complete Sprint 1-5 Implementation*