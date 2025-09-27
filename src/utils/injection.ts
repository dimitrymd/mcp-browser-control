import { WebDriver } from 'selenium-webdriver';
import winston from 'winston';

/**
 * Script injection and sanitization utilities
 */

/**
 * Sanitize JavaScript code for safe execution
 */
export function sanitizeScript(script: string): string {
  if (!script || typeof script !== 'string') {
    return '';
  }

  // Remove potentially dangerous patterns
  let sanitized = script
    // Remove eval() calls
    .replace(/\beval\s*\(/g, '// eval(')
    // Remove Function constructor
    .replace(/new\s+Function\s*\(/g, '// new Function(')
    // Remove dangerous window properties
    .replace(/window\.(location|document)\s*=/g, '// window.$1 =')
    // Remove script injections
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove inline event handlers
    .replace(/on\w+\s*=/gi, '// $&')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '// javascript:');

  return sanitized.trim();
}

/**
 * Wrap code in an Immediately Invoked Function Expression (IIFE)
 */
export function wrapInIIFE(code: string): string {
  if (!code || typeof code !== 'string') {
    return '(function() { return null; })();';
  }

  return `(function() {
    try {
      ${code}
    } catch (error) {
      console.error('Script execution error:', error);
      return { error: error.message };
    }
  })();`;
}

/**
 * Create async wrapper for code execution
 */
export function createAsyncWrapper(code: string): string {
  if (!code || typeof code !== 'string') {
    return 'Promise.resolve(null)';
  }

  return `(async function() {
    try {
      const result = await (async () => {
        ${code}
      })();
      return result;
    } catch (error) {
      console.error('Async script execution error:', error);
      return { error: error.message };
    }
  })()`;
}

/**
 * Inject common polyfills for cross-browser compatibility
 */
export async function injectPolyfills(driver: WebDriver, logger?: winston.Logger): Promise<void> {
  try {
    await driver.executeScript(`
      // Console polyfill
      if (!window.console) {
        window.console = {
          log: function() {},
          error: function() {},
          warn: function() {},
          info: function() {},
          debug: function() {}
        };
      }

      // Promise polyfill (basic)
      if (!window.Promise) {
        window.Promise = function(executor) {
          const self = this;
          self.state = 'pending';
          self.value = undefined;
          self.handlers = [];

          function resolve(result) {
            if (self.state === 'pending') {
              self.state = 'fulfilled';
              self.value = result;
              self.handlers.forEach(handler => handler.onFulfilled(result));
            }
          }

          function reject(error) {
            if (self.state === 'pending') {
              self.state = 'rejected';
              self.value = error;
              self.handlers.forEach(handler => handler.onRejected(error));
            }
          }

          self.then = function(onFulfilled, onRejected) {
            return new Promise((resolve, reject) => {
              function handle() {
                if (self.state === 'fulfilled') {
                  if (onFulfilled) {
                    try {
                      resolve(onFulfilled(self.value));
                    } catch (error) {
                      reject(error);
                    }
                  } else {
                    resolve(self.value);
                  }
                } else if (self.state === 'rejected') {
                  if (onRejected) {
                    try {
                      resolve(onRejected(self.value));
                    } catch (error) {
                      reject(error);
                    }
                  } else {
                    reject(self.value);
                  }
                }
              }

              if (self.state === 'pending') {
                self.handlers.push({ onFulfilled, onRejected });
              } else {
                setTimeout(handle, 0);
              }
            });
          };

          try {
            executor(resolve, reject);
          } catch (error) {
            reject(error);
          }
        };
      }

      // AudioContext polyfill
      if (!window.AudioContext && window.webkitAudioContext) {
        window.AudioContext = window.webkitAudioContext;
      }

      // Add MCP testing utilities
      window.MCPTestUtils = {
        captureConsole: function() {
          const logs = [];
          const originalLog = console.log;
          const originalError = console.error;
          const originalWarn = console.warn;

          console.log = function(...args) { logs.push({type: 'log', message: args.join(' ')}); originalLog.apply(console, args); };
          console.error = function(...args) { logs.push({type: 'error', message: args.join(' ')}); originalError.apply(console, args); };
          console.warn = function(...args) { logs.push({type: 'warn', message: args.join(' ')}); originalWarn.apply(console, args); };

          return {
            getLogs: () => logs,
            restore: () => {
              console.log = originalLog;
              console.error = originalError;
              console.warn = originalWarn;
            }
          };
        }
      };
    `);

    logger?.debug('Polyfills injected successfully');
  } catch (error) {
    logger?.warn('Failed to inject polyfills', { error });
    // Don't throw - polyfill injection is not critical
  }
}

/**
 * Create event listener code
 */
export function createEventListener(event: string, handler: string): string {
  const sanitizedEvent = event.replace(/[^a-zA-Z0-9]/g, '');
  const sanitizedHandler = sanitizeScript(handler);

  return `
    (function() {
      const eventType = '${sanitizedEvent}';
      const handler = function(event) {
        try {
          ${sanitizedHandler}
        } catch (error) {
          console.error('Event handler error:', error);
        }
      };

      document.addEventListener(eventType, handler);

      return {
        eventType: eventType,
        removeListener: function() {
          document.removeEventListener(eventType, handler);
        }
      };
    })();
  `;
}

/**
 * Create a script element for injection
 */
export async function createScriptElement(
  driver: WebDriver,
  options: {
    url?: string;
    code?: string;
    type?: 'module' | 'text/javascript';
    defer?: boolean;
    async?: boolean;
    id?: string;
  },
  logger?: winston.Logger
): Promise<{ scriptId: string; loadTime: number }> {
  const startTime = Date.now();

  try {
    const result = await driver.executeScript(`
      const options = arguments[0];
      const scriptId = options.id || 'mcp-script-' + Date.now();

      const script = document.createElement('script');
      script.id = scriptId;
      script.type = options.type || 'text/javascript';

      if (options.defer) script.defer = true;
      if (options.async) script.async = true;

      return new Promise((resolve, reject) => {
        script.onload = function() {
          resolve({ scriptId: scriptId, success: true });
        };

        script.onerror = function() {
          reject(new Error('Script failed to load'));
        };

        if (options.url) {
          script.src = options.url;
        } else if (options.code) {
          script.textContent = options.code;
        } else {
          reject(new Error('Must provide either url or code'));
          return;
        }

        document.head.appendChild(script);

        // If inline script, resolve immediately
        if (options.code) {
          setTimeout(() => resolve({ scriptId: scriptId, success: true }), 10);
        }
      });
    `, options);

    const loadTime = Date.now() - startTime;
    const scriptResult = result as { scriptId: string; success: boolean };

    logger?.debug('Script element created successfully', {
      scriptId: scriptResult.scriptId,
      loadTime,
      options
    });

    return {
      scriptId: scriptResult.scriptId,
      loadTime
    };

  } catch (error) {
    logger?.error('Failed to create script element', { options, error });
    throw new Error(`Script injection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute code with console capture
 */
export async function executeWithConsoleCapture(
  driver: WebDriver,
  code: string,
  logger?: winston.Logger
): Promise<{
  result: any;
  console: Array<{ type: string; message: string }>;
  errors: Array<{ message: string; stack: string }>;
}> {
  try {
    const result = await driver.executeScript(`
      const code = arguments[0];

      // Set up console capture
      const consoleLogs = [];
      const errors = [];
      const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
      };

      console.log = function(...args) {
        consoleLogs.push({type: 'log', message: args.join(' ')});
        originalConsole.log.apply(console, args);
      };
      console.error = function(...args) {
        consoleLogs.push({type: 'error', message: args.join(' ')});
        originalConsole.error.apply(console, args);
      };
      console.warn = function(...args) {
        consoleLogs.push({type: 'warn', message: args.join(' ')});
        originalConsole.warn.apply(console, args);
      };
      console.info = function(...args) {
        consoleLogs.push({type: 'info', message: args.join(' ')});
        originalConsole.info.apply(console, args);
      };

      let result;
      try {
        // Execute the code
        result = eval(code);
      } catch (error) {
        errors.push({
          message: error.message,
          stack: error.stack || ''
        });
        result = null;
      }

      // Restore console
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;

      return {
        result: result,
        console: consoleLogs,
        errors: errors
      };
    `, code);

    return result as any;
  } catch (error) {
    logger?.error('Console capture execution failed', { error });
    return {
      result: null,
      console: [],
      errors: [{ message: error instanceof Error ? error.message : 'Unknown error', stack: '' }]
    };
  }
}

/**
 * Validate JavaScript code for basic safety
 */
export function validateJavaScriptCode(code: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!code || typeof code !== 'string') {
    return { isValid: false, issues: ['Code must be a non-empty string'] };
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    { pattern: /\beval\s*\(/i, message: 'eval() is not allowed' },
    { pattern: /new\s+Function\s*\(/i, message: 'Function constructor is not allowed' },
    { pattern: /document\.write/i, message: 'document.write is not recommended' },
    { pattern: /innerHTML\s*=.*<script/i, message: 'Script injection via innerHTML is not allowed' },
    { pattern: /location\.(href|replace|assign)/i, message: 'Page navigation is not allowed' },
    { pattern: /window\.open/i, message: 'Opening new windows is not allowed' }
  ];

  dangerousPatterns.forEach(({ pattern, message }) => {
    if (pattern.test(code)) {
      issues.push(message);
    }
  });

  // Check for syntax issues (basic)
  try {
    new Function(code);
  } catch (error) {
    issues.push(`Syntax error: ${error instanceof Error ? error.message : 'Unknown syntax error'}`);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}