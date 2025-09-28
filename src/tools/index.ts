import { NavigationTools } from './navigation.js';
import { InteractionTools } from './interaction.js';
import { ExtractionTools } from './extraction.js';
import { ConditionTools } from './conditions.js';
import { SessionTools } from './session.js';
import { AudioTools } from './audio.js';
import { JavaScriptTools } from './javascript.js';
import { DialogTools } from './dialogs.js';
import { StorageTools } from './storage.js';
import { AdvancedExtractionTools } from './extraction-advanced.js';
import { WindowTools } from './windows.js';
import { FrameTools } from './frames.js';
import { NetworkTools } from './network.js';
import { PerformanceTools } from './performance.js';
import { VideoTools } from './video.js';
import { SEOPerformanceTools } from './seo-performance.js';
import { SessionManager } from '../drivers/session.js';
import winston from 'winston';

export interface ToolRegistry {
  navigation: NavigationTools;
  interaction: InteractionTools;
  extraction: ExtractionTools;
  conditions: ConditionTools;
  session: SessionTools;
  audio: AudioTools;
  javascript: JavaScriptTools;
  dialogs: DialogTools;
  storage: StorageTools;
  advancedExtraction: AdvancedExtractionTools;
  windows: WindowTools;
  frames: FrameTools;
  network: NetworkTools;
  performance: PerformanceTools;
  video: VideoTools;
  seoPerformance: SEOPerformanceTools;
}

export function createToolRegistry(sessionManager: SessionManager, logger: winston.Logger): ToolRegistry {
  return {
    navigation: new NavigationTools(sessionManager, logger),
    interaction: new InteractionTools(sessionManager, logger),
    extraction: new ExtractionTools(sessionManager, logger),
    conditions: new ConditionTools(sessionManager, logger),
    session: new SessionTools(sessionManager, logger),
    audio: new AudioTools(sessionManager, logger),
    javascript: new JavaScriptTools(sessionManager, logger),
    dialogs: new DialogTools(sessionManager, logger),
    storage: new StorageTools(sessionManager, logger),
    advancedExtraction: new AdvancedExtractionTools(sessionManager, logger),
    windows: new WindowTools(sessionManager, logger),
    frames: new FrameTools(sessionManager, logger),
    network: new NetworkTools(sessionManager, logger),
    performance: new PerformanceTools(sessionManager, logger),
    video: new VideoTools(sessionManager, logger),
    seoPerformance: new SEOPerformanceTools(sessionManager, logger)
  };
}

// Tool definitions for MCP server registration
export const toolDefinitions = [
  {
    name: 'navigate_to',
    description: 'Navigate browser to a specified URL with configurable wait conditions',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'Target URL to navigate to (HTTP/HTTPS only)'
        },
        waitUntil: {
          type: 'string',
          enum: ['load', 'domcontentloaded'],
          default: 'load',
          description: 'Wait condition for navigation completion'
        },
        timeout: {
          type: 'number',
          minimum: 1000,
          maximum: 300000,
          default: 30000,
          description: 'Maximum wait time in milliseconds'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID (optional, uses default if not provided)'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'go_back',
    description: 'Navigate to the previous page in browser history',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID (optional, uses default if not provided)'
        }
      },
      required: []
    }
  },
  {
    name: 'go_forward',
    description: 'Navigate to the next page in browser history',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID (optional, uses default if not provided)'
        }
      },
      required: []
    }
  },
  {
    name: 'refresh',
    description: 'Reload the current page with optional cache bypass',
    inputSchema: {
      type: 'object' as const,
      properties: {
        hard: {
          type: 'boolean',
          default: false,
          description: 'Perform hard refresh to bypass cache'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID (optional, uses default if not provided)'
        }
      },
      required: []
    }
  },
  {
    name: 'get_current_url',
    description: 'Get the current URL and title of the active page',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID (optional, uses default if not provided)'
        }
      },
      required: []
    }
  },
  // Interaction Tools
  {
    name: 'click',
    description: 'Click on an element with configurable click types and wait conditions',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector or XPath to the element'
        },
        clickType: {
          type: 'string',
          enum: ['left', 'right', 'middle', 'double'],
          default: 'left',
          description: 'Type of click to perform'
        },
        waitForElement: {
          type: 'boolean',
          default: true,
          description: 'Wait for element to be ready before clicking'
        },
        timeout: {
          type: 'number',
          default: 10000,
          description: 'Maximum wait time in milliseconds'
        },
        scrollIntoView: {
          type: 'boolean',
          default: true,
          description: 'Scroll element into view before clicking'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'type_text',
    description: 'Type text into an input element',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector or XPath to the input element'
        },
        text: {
          type: 'string',
          description: 'Text to type into the element'
        },
        clear: {
          type: 'boolean',
          default: false,
          description: 'Clear the field before typing'
        },
        delay: {
          type: 'number',
          default: 0,
          description: 'Delay between keystrokes in milliseconds'
        },
        pressEnter: {
          type: 'boolean',
          default: false,
          description: 'Press Enter after typing'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['selector', 'text']
    }
  },
  // Extraction Tools
  {
    name: 'get_page_content',
    description: 'Extract page content in various formats',
    inputSchema: {
      type: 'object' as const,
      properties: {
        format: {
          type: 'string',
          enum: ['html', 'text', 'markdown'],
          description: 'Output format for the content'
        },
        selector: {
          type: 'string',
          description: 'Optional selector to extract specific element content'
        },
        includeHidden: {
          type: 'boolean',
          default: false,
          description: 'Include hidden elements in extraction'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['format']
    }
  },
  {
    name: 'get_element_text',
    description: 'Get text content from elements',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector or XPath to the element(s)'
        },
        all: {
          type: 'boolean',
          default: false,
          description: 'Get text from all matching elements'
        },
        trim: {
          type: 'boolean',
          default: true,
          description: 'Trim whitespace from text'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_element_attribute',
    description: 'Get attribute value from elements',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector or XPath to the element(s)'
        },
        attribute: {
          type: 'string',
          description: 'Attribute name to extract'
        },
        all: {
          type: 'boolean',
          default: false,
          description: 'Get attribute from all matching elements'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['selector', 'attribute']
    }
  },
  {
    name: 'take_screenshot',
    description: 'Take a screenshot of the page or specific element',
    inputSchema: {
      type: 'object' as const,
      properties: {
        fullPage: {
          type: 'boolean',
          default: false,
          description: 'Capture the full page'
        },
        selector: {
          type: 'string',
          description: 'Selector for specific element screenshot'
        },
        format: {
          type: 'string',
          enum: ['png', 'jpeg', 'base64'],
          default: 'png',
          description: 'Screenshot format'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  // Condition Tools
  {
    name: 'wait_for_element',
    description: 'Wait for an element to meet a specific condition',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector or XPath to the element'
        },
        condition: {
          type: 'string',
          enum: ['present', 'visible', 'clickable', 'hidden', 'removed'],
          description: 'Condition to wait for'
        },
        timeout: {
          type: 'number',
          default: 10000,
          description: 'Maximum wait time in milliseconds'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['selector', 'condition']
    }
  },
  {
    name: 'wait_for_text',
    description: 'Wait for specific text to appear on the page',
    inputSchema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'Text to wait for'
        },
        selector: {
          type: 'string',
          description: 'Optional selector to search within specific element'
        },
        exact: {
          type: 'boolean',
          default: false,
          description: 'Require exact text match'
        },
        timeout: {
          type: 'number',
          default: 10000,
          description: 'Maximum wait time in milliseconds'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'element_exists',
    description: 'Check if an element exists on the page',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector or XPath to check'
        },
        visible: {
          type: 'boolean',
          default: false,
          description: 'Check if element is visible'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['selector']
    }
  },
  // Session Management Tools
  {
    name: 'create_session',
    description: 'Create a new browser session',
    inputSchema: {
      type: 'object' as const,
      properties: {
        browserType: {
          type: 'string',
          enum: ['chrome', 'firefox'],
          default: 'chrome',
          description: 'Browser type to use'
        },
        headless: {
          type: 'boolean',
          default: true,
          description: 'Run browser in headless mode'
        },
        windowSize: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' }
          },
          description: 'Browser window size'
        }
      },
      required: []
    }
  },
  {
    name: 'close_session',
    description: 'Close a browser session',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Session ID to close'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'list_sessions',
    description: 'List all active browser sessions',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'get_session_info',
    description: 'Get detailed information about a browser session',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Session ID to get info for'
        }
      },
      required: ['sessionId']
    }
  },
  // Audio Testing Tools
  {
    name: 'check_audio_playing',
    description: 'Check if audio is currently playing with actual playback detection',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'Optional selector for specific audio/video element'
        },
        checkInterval: {
          type: 'number',
          default: 100,
          description: 'Milliseconds between playback checks'
        },
        sampleDuration: {
          type: 'number',
          default: 500,
          description: 'How long to sample for actual playback'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'get_audio_elements',
    description: 'Find and analyze all audio/video elements on the page',
    inputSchema: {
      type: 'object' as const,
      properties: {
        includeIframes: {
          type: 'boolean',
          default: false,
          description: 'Search for audio elements in iframes'
        },
        onlyWithSource: {
          type: 'boolean',
          default: false,
          description: 'Only return elements with audio sources'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'control_audio_playback',
    description: 'Control audio/video playback with advanced options',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the audio/video element'
        },
        action: {
          type: 'string',
          enum: ['play', 'pause', 'stop', 'mute', 'unmute', 'toggle'],
          description: 'Playback action to perform'
        },
        volume: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Volume level (0-1)'
        },
        seekTo: {
          type: 'number',
          minimum: 0,
          description: 'Seek to specific time in seconds'
        },
        playbackRate: {
          type: 'number',
          minimum: 0.25,
          maximum: 4,
          description: 'Playback speed multiplier'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['selector', 'action']
    }
  },
  {
    name: 'monitor_audio_events',
    description: 'Monitor audio events for specified duration',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'Optional selector for specific element to monitor'
        },
        duration: {
          type: 'number',
          minimum: 100,
          description: 'Monitoring duration in milliseconds'
        },
        events: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific events to track'
        },
        includeTimeUpdates: {
          type: 'boolean',
          default: false,
          description: 'Include timeupdate events (can be verbose)'
        },
        throttle: {
          type: 'number',
          default: 1000,
          description: 'Throttle time updates (ms)'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['duration']
    }
  },
  {
    name: 'analyze_audio_performance',
    description: 'Analyze audio playback performance metrics',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the audio/video element'
        },
        duration: {
          type: 'number',
          minimum: 500,
          description: 'Analysis duration in milliseconds'
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific metrics to track'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['selector', 'duration']
    }
  },
  {
    name: 'detect_audio_issues',
    description: 'Detect common audio playback issues',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'Optional selector for specific element'
        },
        checkDuration: {
          type: 'number',
          default: 5000,
          description: 'Duration to check for issues in milliseconds'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  // JavaScript Execution Tools
  {
    name: 'execute_javascript',
    description: 'Execute JavaScript code in page context with console capture',
    inputSchema: {
      type: 'object' as const,
      properties: {
        script: {
          type: 'string',
          description: 'JavaScript code to execute'
        },
        args: {
          type: 'array',
          description: 'Arguments to pass to the script'
        },
        async: {
          type: 'boolean',
          default: false,
          description: 'Execute as async function'
        },
        timeout: {
          type: 'number',
          default: 30000,
          description: 'Execution timeout in milliseconds'
        },
        context: {
          type: 'string',
          enum: ['page', 'isolated'],
          default: 'page',
          description: 'Execution context'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['script']
    }
  },
  {
    name: 'inject_script',
    description: 'Inject external scripts or inline code into the page',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'Script URL to inject'
        },
        code: {
          type: 'string',
          description: 'Inline JavaScript code'
        },
        type: {
          type: 'string',
          enum: ['module', 'text/javascript'],
          default: 'text/javascript',
          description: 'Script type'
        },
        defer: {
          type: 'boolean',
          default: false,
          description: 'Defer script execution'
        },
        async: {
          type: 'boolean',
          default: false,
          description: 'Async script loading'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'evaluate_expression',
    description: 'Evaluate JavaScript expressions and return results',
    inputSchema: {
      type: 'object' as const,
      properties: {
        expression: {
          type: 'string',
          description: 'JavaScript expression to evaluate'
        },
        returnType: {
          type: 'string',
          enum: ['primitive', 'json', 'element'],
          default: 'primitive',
          description: 'Format for return value'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['expression']
    }
  },
  // Dialog Handling Tools
  {
    name: 'handle_alert',
    description: 'Handle browser alert, confirm, or prompt dialogs',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['accept', 'dismiss', 'getText', 'sendKeys'],
          description: 'Action to perform on the dialog'
        },
        text: {
          type: 'string',
          description: 'Text to send for prompt dialogs'
        },
        timeout: {
          type: 'number',
          default: 10000,
          description: 'Timeout to wait for dialog in milliseconds'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'set_dialog_handler',
    description: 'Set up automatic dialog handling',
    inputSchema: {
      type: 'object' as const,
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Enable or disable the dialog handler'
        },
        autoAccept: {
          type: 'boolean',
          default: false,
          description: 'Automatically accept all dialogs'
        },
        promptText: {
          type: 'string',
          description: 'Default text for prompt dialogs'
        },
        callback: {
          type: 'string',
          description: 'JavaScript function to handle dialogs'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['enabled']
    }
  },
  // Storage Management Tools
  {
    name: 'manage_cookies',
    description: 'Manage browser cookies (get, set, delete, clear)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'set', 'delete', 'clear'],
          description: 'Cookie management action'
        },
        cookie: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
            domain: { type: 'string' },
            path: { type: 'string' },
            secure: { type: 'boolean' },
            httpOnly: { type: 'boolean' },
            sameSite: { type: 'string', enum: ['Lax', 'Strict', 'None'] },
            expires: { type: 'number' }
          },
          description: 'Cookie data for set action'
        },
        filter: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            name: { type: 'string' }
          },
          description: 'Filter criteria for get/delete actions'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'manage_storage',
    description: 'Manage localStorage and sessionStorage',
    inputSchema: {
      type: 'object' as const,
      properties: {
        storageType: {
          type: 'string',
          enum: ['localStorage', 'sessionStorage'],
          description: 'Type of storage to manage'
        },
        action: {
          type: 'string',
          enum: ['get', 'set', 'remove', 'clear', 'getAllKeys'],
          description: 'Storage action to perform'
        },
        key: {
          type: 'string',
          description: 'Storage key for get/set/remove actions'
        },
        value: {
          description: 'Value to store for set action'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['storageType', 'action']
    }
  },
  {
    name: 'clear_browser_data',
    description: 'Clear various types of browser data',
    inputSchema: {
      type: 'object' as const,
      properties: {
        dataTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['cookies', 'localStorage', 'sessionStorage', 'indexedDB', 'cache']
          },
          description: 'Types of data to clear'
        },
        timeRange: {
          type: 'object',
          properties: {
            start: { type: 'number' },
            end: { type: 'number' }
          },
          description: 'Time range for data clearing'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['dataTypes']
    }
  },
  // Sprint 4: Advanced Extraction Tools
  {
    name: 'extract_table_data',
    description: 'Extract table data with advanced formatting and validation',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the table element'
        },
        format: {
          type: 'string',
          enum: ['json', 'csv', 'array', 'object'],
          description: 'Output format for extracted data'
        },
        headers: {
          description: 'Header handling strategy or custom headers array'
        },
        skipRows: {
          type: 'number',
          minimum: 0,
          description: 'Number of rows to skip from the beginning'
        },
        maxRows: {
          type: 'number',
          minimum: 1,
          description: 'Maximum number of rows to extract'
        },
        cleanData: {
          type: 'boolean',
          default: true,
          description: 'Clean and normalize extracted data'
        },
        parseNumbers: {
          type: 'boolean',
          default: false,
          description: 'Automatically parse numeric values'
        },
        parseDates: {
          type: 'boolean',
          default: false,
          description: 'Automatically parse date values'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['selector', 'format']
    }
  },
  {
    name: 'extract_structured_data',
    description: 'Extract structured data using field schemas with pagination support',
    inputSchema: {
      type: 'object' as const,
      properties: {
        schema: {
          type: 'object',
          properties: {
            selector: { type: 'string' },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  selector: { type: 'string' },
                  attribute: { type: 'string' },
                  transform: {
                    type: 'string',
                    enum: ['text', 'number', 'date', 'boolean', 'url']
                  },
                  multiple: { type: 'boolean' },
                  required: { type: 'boolean' },
                  default: {}
                },
                required: ['name', 'selector']
              }
            },
            pagination: {
              type: 'object',
              properties: {
                nextSelector: { type: 'string' },
                maxPages: { type: 'number' }
              }
            }
          },
          required: ['selector', 'fields']
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['schema']
    }
  },
  {
    name: 'extract_form_data',
    description: 'Extract form field information and values',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for form element (optional, searches entire page if not provided)'
        },
        includeHidden: {
          type: 'boolean',
          default: false,
          description: 'Include hidden form fields'
        },
        includeDisabled: {
          type: 'boolean',
          default: false,
          description: 'Include disabled form fields'
        },
        groupByName: {
          type: 'boolean',
          default: false,
          description: 'Group fields by name attribute'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'extract_media_info',
    description: 'Extract comprehensive information about media elements',
    inputSchema: {
      type: 'object' as const,
      properties: {
        mediaType: {
          type: 'string',
          enum: ['image', 'video', 'audio', 'all'],
          default: 'all',
          description: 'Type of media elements to extract'
        },
        includeDimensions: {
          type: 'boolean',
          default: true,
          description: 'Include dimension information'
        },
        includeMetadata: {
          type: 'boolean',
          default: true,
          description: 'Include metadata like duration, file size'
        },
        checkLoaded: {
          type: 'boolean',
          default: true,
          description: 'Check if media is fully loaded'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'extract_links',
    description: 'Extract and analyze all links on the page',
    inputSchema: {
      type: 'object' as const,
      properties: {
        internal: {
          type: 'boolean',
          default: true,
          description: 'Include internal links'
        },
        external: {
          type: 'boolean',
          default: true,
          description: 'Include external links'
        },
        includeAnchors: {
          type: 'boolean',
          default: false,
          description: 'Include anchor links (#fragments)'
        },
        checkStatus: {
          type: 'boolean',
          default: false,
          description: 'Check HTTP status of links'
        },
        pattern: {
          type: 'string',
          description: 'Regex pattern to filter links'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  // Sprint 4: Window Management Tools
  {
    name: 'get_windows',
    description: 'Get information about all browser windows and tabs',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'switch_window',
    description: 'Switch to a different browser window or tab',
    inputSchema: {
      type: 'object' as const,
      properties: {
        target: {
          description: 'Window handle (string) or index (number)'
        },
        closeOthers: {
          type: 'boolean',
          default: false,
          description: 'Close all other windows after switching'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['target']
    }
  },
  {
    name: 'open_new_window',
    description: 'Open a new browser window or tab',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'URL to open in new window'
        },
        type: {
          type: 'string',
          enum: ['tab', 'window'],
          default: 'tab',
          description: 'Type of new window to open'
        },
        focus: {
          type: 'boolean',
          default: true,
          description: 'Focus the new window after opening'
        },
        position: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' }
          },
          description: 'Window position (for window type)'
        },
        size: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' }
          },
          description: 'Window size (for window type)'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'close_window',
    description: 'Close a browser window or tab',
    inputSchema: {
      type: 'object' as const,
      properties: {
        handle: {
          type: 'string',
          description: 'Window handle to close (current window if not specified)'
        },
        force: {
          type: 'boolean',
          default: false,
          description: 'Force close even if it is the last window'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'arrange_windows',
    description: 'Arrange multiple browser windows in specific layouts',
    inputSchema: {
      type: 'object' as const,
      properties: {
        layout: {
          type: 'string',
          enum: ['cascade', 'tile', 'stack', 'custom'],
          description: 'Window arrangement layout'
        },
        windows: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific window handles to arrange'
        },
        customLayout: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              handle: { type: 'string' },
              position: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' } }
              },
              size: {
                type: 'object',
                properties: { width: { type: 'number' }, height: { type: 'number' } }
              }
            }
          },
          description: 'Custom layout specification'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['layout']
    }
  },
  // Sprint 4: iframe Support Tools
  {
    name: 'get_frames',
    description: 'Get information about all iframes on the page',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'switch_to_frame',
    description: 'Switch to a specific iframe context',
    inputSchema: {
      type: 'object' as const,
      properties: {
        target: {
          description: 'Frame selector, name, ID (string) or index (number)'
        },
        waitForLoad: {
          type: 'boolean',
          default: true,
          description: 'Wait for frame to fully load'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['target']
    }
  },
  {
    name: 'switch_to_parent_frame',
    description: 'Switch back to parent frame context',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'execute_in_frame',
    description: 'Execute JavaScript code within a specific iframe',
    inputSchema: {
      type: 'object' as const,
      properties: {
        frame: {
          description: 'Frame selector, name, ID (string) or index (number)'
        },
        script: {
          type: 'string',
          description: 'JavaScript code to execute'
        },
        args: {
          type: 'array',
          description: 'Arguments to pass to the script'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['frame', 'script']
    }
  },
  // Sprint 4: Network Monitoring Tools
  {
    name: 'start_network_capture',
    description: 'Start capturing network requests',
    inputSchema: {
      type: 'object' as const,
      properties: {
        captureTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['xhr', 'fetch', 'document', 'script', 'stylesheet', 'image', 'media', 'font', 'websocket']
          },
          description: 'Types of network requests to capture'
        },
        urlPattern: {
          type: 'string',
          description: 'Regex pattern to filter URLs'
        },
        includeHeaders: {
          type: 'boolean',
          default: true,
          description: 'Include request/response headers'
        },
        includeBody: {
          type: 'boolean',
          default: false,
          description: 'Include request/response bodies'
        },
        maxSize: {
          type: 'number',
          default: 1048576,
          description: 'Maximum body size to capture (bytes)'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['captureTypes']
    }
  },
  {
    name: 'get_network_data',
    description: 'Retrieve captured network request data',
    inputSchema: {
      type: 'object' as const,
      properties: {
        captureId: {
          type: 'string',
          description: 'Network capture ID'
        },
        filter: {
          type: 'object',
          properties: {
            status: {
              type: 'array',
              items: { type: 'number' },
              description: 'Filter by HTTP status codes'
            },
            method: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by HTTP methods'
            },
            url: {
              type: 'string',
              description: 'URL pattern filter'
            },
            minDuration: { type: 'number' },
            maxDuration: { type: 'number' }
          },
          description: 'Filters to apply to captured data'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'stop_network_capture',
    description: 'Stop network capture and optionally retrieve data',
    inputSchema: {
      type: 'object' as const,
      properties: {
        captureId: {
          type: 'string',
          description: 'Network capture ID to stop'
        },
        getData: {
          type: 'boolean',
          default: true,
          description: 'Return captured data when stopping'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['captureId']
    }
  },
  {
    name: 'block_requests',
    description: 'Block, redirect, or modify network requests',
    inputSchema: {
      type: 'object' as const,
      properties: {
        patterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'URL patterns to match for blocking'
        },
        action: {
          type: 'string',
          enum: ['block', 'redirect', 'modify'],
          description: 'Action to take on matched requests'
        },
        redirectUrl: {
          type: 'string',
          format: 'uri',
          description: 'URL to redirect to (for redirect action)'
        },
        modifyHeaders: {
          type: 'object',
          description: 'Headers to modify (for modify action)'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['patterns', 'action']
    }
  },
  // Sprint 4: Performance Profiling Tools
  {
    name: 'get_performance_metrics',
    description: 'Get comprehensive page performance metrics',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'profile_page_load',
    description: 'Profile page load performance with multiple iterations',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'URL to profile'
        },
        iterations: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 1,
          description: 'Number of load iterations'
        },
        clearCache: {
          type: 'boolean',
          default: false,
          description: 'Clear cache between iterations'
        },
        throttling: {
          type: 'object',
          properties: {
            cpu: {
              type: 'number',
              minimum: 1,
              maximum: 10,
              description: 'CPU throttling factor'
            },
            network: {
              type: 'string',
              enum: ['offline', 'slow-2g', 'fast-3g', '4g'],
              description: 'Network throttling type'
            }
          },
          description: 'Performance throttling options'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'analyze_render_performance',
    description: 'Analyze rendering performance with FPS and jank detection',
    inputSchema: {
      type: 'object' as const,
      properties: {
        duration: {
          type: 'number',
          minimum: 1000,
          maximum: 60000,
          description: 'Monitoring duration in milliseconds'
        },
        interactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['click', 'scroll', 'hover']
              },
              selector: { type: 'string' }
            },
            required: ['action', 'selector']
          },
          description: 'User interactions to perform during monitoring'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['duration']
    }
  },
  // Sprint 6: Revolutionary Video Testing Tools 🎬
  {
    name: 'check_video_playing',
    description: 'Check if video is actually playing with frame advancement detection',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'Optional selector for specific video element'
        },
        checkInterval: {
          type: 'number',
          default: 100,
          description: 'Milliseconds between playback checks'
        },
        sampleDuration: {
          type: 'number',
          default: 1000,
          description: 'How long to sample for actual playback detection'
        },
        frameRateThreshold: {
          type: 'number',
          default: 10,
          description: 'Minimum frame rate for valid playback'
        },
        qualityCheck: {
          type: 'boolean',
          default: true,
          description: 'Include quality analysis in playback check'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'analyze_video_quality',
    description: 'Analyze video quality with frame rate, resolution, and performance metrics',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the video element'
        },
        duration: {
          type: 'number',
          minimum: 1000,
          description: 'Analysis duration in milliseconds'
        },
        sampleInterval: {
          type: 'number',
          default: 200,
          description: 'Sampling interval for quality metrics'
        },
        includeFrameAnalysis: {
          type: 'boolean',
          default: true,
          description: 'Include frame rate and drop analysis'
        },
        includeBitrateAnalysis: {
          type: 'boolean',
          default: true,
          description: 'Include bitrate and bandwidth analysis'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['selector', 'duration']
    }
  },
  {
    name: 'test_video_sync',
    description: 'Test audio/video synchronization with drift detection',
    inputSchema: {
      type: 'object' as const,
      properties: {
        videoSelector: {
          type: 'string',
          description: 'CSS selector for the video element'
        },
        audioSelector: {
          type: 'string',
          description: 'Optional CSS selector for separate audio element'
        },
        duration: {
          type: 'number',
          minimum: 1000,
          description: 'Test duration in milliseconds'
        },
        tolerance: {
          type: 'number',
          default: 0.1,
          description: 'Acceptable sync tolerance in seconds'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['videoSelector', 'duration']
    }
  },
  {
    name: 'control_video_playback',
    description: 'Control video playback with advanced options including quality and fullscreen',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the video element'
        },
        action: {
          type: 'string',
          enum: ['play', 'pause', 'stop', 'mute', 'unmute', 'toggle', 'fullscreen', 'exitFullscreen', 'pictureInPicture'],
          description: 'Video playback action to perform'
        },
        volume: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Volume level (0-1)'
        },
        seekTo: {
          type: 'number',
          minimum: 0,
          description: 'Seek to specific time in seconds'
        },
        playbackRate: {
          type: 'number',
          minimum: 0.25,
          maximum: 4,
          description: 'Playback speed multiplier'
        },
        qualityLevel: {
          type: 'string',
          description: 'Target quality level (e.g., 1080p, 720p, 480p)'
        },
        fadeIn: {
          type: 'number',
          description: 'Fade in duration in milliseconds'
        },
        fadeOut: {
          type: 'number',
          description: 'Fade out duration in milliseconds'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['selector', 'action']
    }
  },
  {
    name: 'monitor_video_events',
    description: 'Monitor video events with quality and frame rate tracking',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'Optional selector for specific video element'
        },
        duration: {
          type: 'number',
          minimum: 100,
          description: 'Monitoring duration in milliseconds'
        },
        events: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific video events to track'
        },
        includeQualityEvents: {
          type: 'boolean',
          default: true,
          description: 'Include quality change events'
        },
        includeFrameEvents: {
          type: 'boolean',
          default: false,
          description: 'Include frame update events (can be verbose)'
        },
        throttle: {
          type: 'number',
          default: 500,
          description: 'Throttle event updates (ms)'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['duration']
    }
  },
  {
    name: 'detect_video_issues',
    description: 'Detect video playback issues with quality scoring',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'Optional selector for specific video element'
        },
        checkDuration: {
          type: 'number',
          default: 5000,
          description: 'Duration to check for issues in milliseconds'
        },
        frameRateThreshold: {
          type: 'number',
          default: 24,
          description: 'Minimum acceptable frame rate'
        },
        qualityThreshold: {
          type: 'number',
          default: 720,
          description: 'Minimum acceptable vertical resolution'
        },
        bufferThreshold: {
          type: 'number',
          default: 2,
          description: 'Minimum buffer level in seconds'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },

  // SEO Performance Analysis Tools
  {
    name: 'analyze_core_web_vitals',
    description: 'Analyze Core Web Vitals (LCP, FID, CLS, INP, FCP, TTFB) with performance scoring',
    inputSchema: {
      type: 'object' as const,
      properties: {
        mobile: {
          type: 'boolean',
          default: false,
          description: 'Test mobile vs desktop performance'
        },
        includeFieldData: {
          type: 'boolean',
          default: false,
          description: 'Include real user metrics from Chrome UX Report'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'monitor_page_performance',
    description: 'Monitor page performance with resource analysis and optimization opportunities',
    inputSchema: {
      type: 'object' as const,
      properties: {
        duration: {
          type: 'number',
          default: 5000,
          description: 'Monitoring duration in milliseconds'
        },
        includeResources: {
          type: 'boolean',
          default: true,
          description: 'Include resource loading analysis'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'analyze_page_speed',
    description: 'Comprehensive page speed analysis with Lighthouse-style scoring (Performance, SEO, Accessibility, Best Practices)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        strategy: {
          type: 'string',
          enum: ['mobile', 'desktop'],
          default: 'desktop',
          description: 'Analysis strategy - mobile or desktop'
        },
        category: {
          type: 'string',
          enum: ['performance', 'accessibility', 'best-practices', 'seo'],
          default: 'performance',
          description: 'Primary analysis category focus'
        },
        includeScreenshot: {
          type: 'boolean',
          default: false,
          description: 'Include screenshot in analysis results'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'detect_performance_issues',
    description: 'Detect performance issues with business impact analysis and optimization recommendations',
    inputSchema: {
      type: 'object' as const,
      properties: {
        thresholds: {
          type: 'object',
          description: 'Custom performance thresholds for issue detection'
        },
        monitoringDuration: {
          type: 'number',
          default: 5000,
          description: 'Monitoring duration in milliseconds'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'benchmark_performance',
    description: 'Benchmark performance against industry standards with percentile ranking and improvement recommendations',
    inputSchema: {
      type: 'object' as const,
      properties: {
        industryType: {
          type: 'string',
          enum: ['ecommerce', 'news', 'saas', 'general'],
          default: 'general',
          description: 'Industry type for benchmarking'
        },
        competitorUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional competitor URLs for comparison'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },

  // Sprint 2: Competitive Intelligence & Advanced SEO Tools
  {
    name: 'monitor_competitor_seo',
    description: 'Monitor competitor SEO performance with Google Lighthouse data and competitive intelligence analysis',
    inputSchema: {
      type: 'object' as const,
      properties: {
        competitorUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of competitor URLs to analyze'
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          default: ['performance', 'seo'],
          description: 'Metrics to analyze (performance, seo, accessibility, best-practices)'
        },
        alertThresholds: {
          type: 'object',
          description: 'Alert thresholds for competitive threats (e.g., {performanceScore: 90})'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: ['competitorUrls']
    }
  },
  {
    name: 'audit_meta_tags',
    description: 'Comprehensive meta tag audit with SEO optimization recommendations and social media tag analysis',
    inputSchema: {
      type: 'object' as const,
      properties: {
        includeOpenGraph: {
          type: 'boolean',
          default: true,
          description: 'Include Open Graph (Facebook) meta tag analysis'
        },
        includeTwitterCards: {
          type: 'boolean',
          default: true,
          description: 'Include Twitter Card meta tag analysis'
        },
        checkDuplicates: {
          type: 'boolean',
          default: true,
          description: 'Check for duplicate meta tags and content'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  },
  {
    name: 'analyze_seo_content',
    description: 'Comprehensive SEO content analysis with keyword density, readability scoring, and content quality assessment',
    inputSchema: {
      type: 'object' as const,
      properties: {
        targetKeywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of target keywords to analyze density for'
        },
        analyzeReadability: {
          type: 'boolean',
          default: true,
          description: 'Include readability scoring analysis'
        },
        checkDuplicateContent: {
          type: 'boolean',
          default: false,
          description: 'Check for duplicate content issues'
        },
        sessionId: {
          type: 'string',
          format: 'uuid',
          description: 'Browser session ID'
        }
      },
      required: []
    }
  }
];

// Tool execution mapping
export function executeTool(
  toolName: string,
  args: any,
  tools: ToolRegistry
): Promise<any> {
  const { sessionId, ...params } = args;

  // Navigation tools
  switch (toolName) {
    case 'navigate_to':
      return tools.navigation.navigateTo(params, sessionId);
    case 'go_back':
      return tools.navigation.goBack(sessionId);
    case 'go_forward':
      return tools.navigation.goForward(sessionId);
    case 'refresh':
      return tools.navigation.refresh(params, sessionId);
    case 'get_current_url':
      return tools.navigation.getCurrentUrl(sessionId);

    // Interaction tools
    case 'click':
      return tools.interaction.click(params, sessionId);
    case 'type_text':
      return tools.interaction.typeText(params, sessionId);
    case 'select_dropdown':
      return tools.interaction.selectDropdown(params, sessionId);
    case 'hover':
      return tools.interaction.hover(params, sessionId);
    case 'scroll_to':
      return tools.interaction.scrollTo(params, sessionId);

    // Extraction tools
    case 'get_page_content':
      return tools.extraction.getPageContent(params, sessionId);
    case 'get_element_text':
      return tools.extraction.getElementText(params, sessionId);
    case 'get_element_attribute':
      return tools.extraction.getElementAttribute(params, sessionId);
    case 'take_screenshot':
      return tools.extraction.takeScreenshot(params, sessionId);
    case 'get_element_properties':
      return tools.extraction.getElementProperties(params, sessionId);

    // Condition tools
    case 'wait_for_element':
      return tools.conditions.waitForElement(params, sessionId);
    case 'wait_for_text':
      return tools.conditions.waitForText(params, sessionId);
    case 'element_exists':
      return tools.conditions.elementExists(params, sessionId);

    // Session management tools
    case 'create_session':
      return tools.session.createSession(params);
    case 'close_session':
      return tools.session.closeSession(params);
    case 'list_sessions':
      return tools.session.listSessions();
    case 'get_session_info':
      return tools.session.getSessionInfo(params);

    // Audio testing tools
    case 'check_audio_playing':
      return tools.audio.checkAudioPlaying(params, sessionId);
    case 'get_audio_elements':
      return tools.audio.getAudioElements(params, sessionId);
    case 'control_audio_playback':
      return tools.audio.controlAudioPlayback(params, sessionId);
    case 'monitor_audio_events':
      return tools.audio.monitorAudioEvents(params, sessionId);
    case 'analyze_audio_performance':
      return tools.audio.analyzeAudioPerformance(params, sessionId);
    case 'detect_audio_issues':
      return tools.audio.detectAudioIssues(params, sessionId);

    // JavaScript execution tools
    case 'execute_javascript':
      return tools.javascript.executeJavaScript(params, sessionId);
    case 'inject_script':
      return tools.javascript.injectScript(params, sessionId);
    case 'evaluate_expression':
      return tools.javascript.evaluateExpression(params, sessionId);

    // Dialog handling tools
    case 'handle_alert':
      return tools.dialogs.handleAlert(params, sessionId);
    case 'set_dialog_handler':
      return tools.dialogs.setDialogHandler(params, sessionId);

    // Storage management tools
    case 'manage_cookies':
      return tools.storage.manageCookies(params, sessionId);
    case 'manage_storage':
      return tools.storage.manageStorage(params, sessionId);
    case 'clear_browser_data':
      return tools.storage.clearBrowserData(params, sessionId);

    // Sprint 4: Advanced extraction tools
    case 'extract_table_data':
      return tools.advancedExtraction.extractTableData(params, sessionId);
    case 'extract_structured_data':
      return tools.advancedExtraction.extractStructuredData(params, sessionId);
    case 'extract_form_data':
      return tools.advancedExtraction.extractFormData(params, sessionId);
    case 'extract_media_info':
      return tools.advancedExtraction.extractMediaInfo(params, sessionId);
    case 'extract_links':
      return tools.advancedExtraction.extractLinks(params, sessionId);

    // Sprint 4: Window management tools
    case 'get_windows':
      return tools.windows.getWindows(params, sessionId);
    case 'switch_window':
      return tools.windows.switchWindow(params, sessionId);
    case 'open_new_window':
      return tools.windows.openNewWindow(params, sessionId);
    case 'close_window':
      return tools.windows.closeWindow(params, sessionId);
    case 'arrange_windows':
      return tools.windows.arrangeWindows(params, sessionId);

    // Sprint 4: iframe support tools
    case 'get_frames':
      return tools.frames.getFrames(params, sessionId);
    case 'switch_to_frame':
      return tools.frames.switchToFrame(params, sessionId);
    case 'switch_to_parent_frame':
      return tools.frames.switchToParentFrame(params, sessionId);
    case 'execute_in_frame':
      return tools.frames.executeInFrame(params, sessionId);

    // Sprint 4: Network monitoring tools
    case 'start_network_capture':
      return tools.network.startNetworkCapture(params, sessionId);
    case 'get_network_data':
      return tools.network.getNetworkData(params, sessionId);
    case 'stop_network_capture':
      return tools.network.stopNetworkCapture(params, sessionId);
    case 'block_requests':
      return tools.network.blockRequests(params, sessionId);

    // Sprint 4: Performance profiling tools
    case 'get_performance_metrics':
      return tools.performance.getPerformanceMetrics(params, sessionId);
    case 'profile_page_load':
      return tools.performance.profilePageLoad(params, sessionId);
    case 'analyze_render_performance':
      return tools.performance.analyzeRenderPerformance(params, sessionId);

    // Sprint 6: Revolutionary video testing tools
    case 'check_video_playing':
      return tools.video.checkVideoPlaying(params, sessionId);
    case 'analyze_video_quality':
      return tools.video.analyzeVideoQuality(params, sessionId);
    case 'test_video_sync':
      return tools.video.testVideoSync(params, sessionId);
    case 'control_video_playback':
      return tools.video.controlVideoPlayback(params, sessionId);
    case 'monitor_video_events':
      return tools.video.monitorVideoEvents(params, sessionId);
    case 'detect_video_issues':
      return tools.video.detectVideoIssues(params, sessionId);

    // SEO Performance Tools
    case 'analyze_core_web_vitals':
      return tools.seoPerformance.analyzeCoreWebVitals(params, sessionId);
    case 'monitor_page_performance':
      return tools.seoPerformance.monitorPagePerformance(params, sessionId);
    case 'analyze_page_speed':
      return tools.seoPerformance.analyzePageSpeed(params, sessionId);
    case 'detect_performance_issues':
      return tools.seoPerformance.detectPerformanceIssues(params, sessionId);
    case 'benchmark_performance':
      return tools.seoPerformance.benchmarkPerformance(params, sessionId);

    // Sprint 2: Competitive Intelligence Tools
    case 'monitor_competitor_seo':
      return tools.seoPerformance.monitorCompetitorSEO(params, sessionId);
    case 'audit_meta_tags':
      return tools.seoPerformance.auditMetaTags(params, sessionId);
    case 'analyze_seo_content':
      return tools.seoPerformance.analyzeSEOContent(params, sessionId);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Legacy function for backward compatibility
export function executeNavigationTool(
  toolName: string,
  args: any,
  tools: ToolRegistry
): Promise<any> {
  return executeTool(toolName, args, tools);
}