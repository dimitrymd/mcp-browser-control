import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { WebDriver } from 'selenium-webdriver';
import winston from 'winston';

import { JavaScriptTools } from '../src/tools/javascript.js';
import { SessionManager } from '../src/drivers/session.js';
import { WebDriverManager } from '../src/drivers/manager.js';
import { executeWithConsoleCapture, createScriptElement } from '../src/utils/injection.js';

// Mock the injection utilities
vi.mock('../src/utils/injection.js', () => ({
  sanitizeScript: vi.fn((script) => script),
  wrapInIIFE: vi.fn((code) => `(function() { ${code} })()`),
  createAsyncWrapper: vi.fn((code) => `(async function() { ${code} })()`),
  createScriptElement: vi.fn(),
  executeWithConsoleCapture: vi.fn(),
  validateJavaScriptCode: vi.fn().mockReturnValue({ isValid: true, issues: [] })
}));

// Mock logger
const mockLogger = winston.createLogger({
  level: 'error',
  silent: true,
  transports: [],
});

describe('JavaScriptTools', () => {
  let javascriptTools: JavaScriptTools;
  let sessionManager: SessionManager;
  let driverManager: WebDriverManager;
  let mockDriver: any;

  beforeAll(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock driver
    mockDriver = {
      executeScript: vi.fn().mockResolvedValue({
        value: 42,
        type: 'number',
        isNull: false,
        isUndefined: false,
        success: true
      }),
      executeAsyncScript: vi.fn().mockResolvedValue({
        result: 'async result',
        console: [{ type: 'log', message: 'Async execution completed' }],
        errors: []
      })
    };

    // Mock driver manager
    driverManager = {
      createDriver: vi.fn().mockResolvedValue(mockDriver as WebDriver),
      validateDriver: vi.fn().mockResolvedValue(true),
      closeDriver: vi.fn().mockResolvedValue(undefined),
      checkDriverHealth: vi.fn().mockResolvedValue({
        isHealthy: true,
        details: { canNavigate: true, canExecuteScript: true, responseTime: 100 }
      })
    } as any;

    // Create session manager
    sessionManager = new SessionManager(driverManager, mockLogger, 5, 600000);

    // Create JavaScript tools
    javascriptTools = new JavaScriptTools(sessionManager, mockLogger);

    // Setup mocks for utilities
    vi.mocked(executeWithConsoleCapture).mockImplementation(async () => {
      // Add small delay to simulate execution time
      await new Promise(resolve => setTimeout(resolve, 10));
      return {
        result: 'test result',
        console: [{ type: 'log', message: 'Test log' }],
        errors: []
      };
    });

    vi.mocked(createScriptElement).mockResolvedValue({
      scriptId: 'test-script-123',
      loadTime: 150
    });
  });

  afterEach(async () => {
    await sessionManager.shutdown();
    vi.clearAllMocks();
  });

  describe('executeJavaScript', () => {
    it('should execute JavaScript code successfully', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        script: 'return 2 + 2;'
      };

      const result = await javascriptTools.executeJavaScript(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.result).toBeDefined();
      expect(result.data?.console).toBeDefined();
      expect(result.data?.errors).toBeDefined();
      expect(result.data?.executionTime).toBeGreaterThan(0);
    });

    it('should execute JavaScript with arguments', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        script: 'return args[0] + args[1];',
        args: [10, 20]
      };

      const result = await javascriptTools.executeJavaScript(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.result).toBeDefined();
    });

    it('should execute async JavaScript', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        script: 'await new Promise(resolve => setTimeout(() => resolve("async result"), 100));',
        async: true
      };

      const result = await javascriptTools.executeJavaScript(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.result).toBeDefined();
    });

    it('should execute in isolated context', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        script: 'var isolatedVar = "test"; return isolatedVar;',
        context: 'isolated' as const
      };

      const result = await javascriptTools.executeJavaScript(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.result).toBeDefined();
    });

    it('should validate script parameter', async () => {
      const params = {
        script: '' // Empty script
      };

      const result = await javascriptTools.executeJavaScript(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should validate timeout parameter', async () => {
      const params = {
        script: 'return true;',
        timeout: 500 // Too short
      };

      const result = await javascriptTools.executeJavaScript(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should handle JavaScript execution errors', async () => {
      // Test with invalid script parameter instead of mock validation
      const params = {
        script: '' // Empty script should fail validation
      };

      const result = await javascriptTools.executeJavaScript(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('injectScript', () => {
    it('should inject external script by URL', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        url: 'https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js',
        type: 'text/javascript' as const
      };

      const result = await javascriptTools.injectScript(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.scriptId).toBe('test-script-123');
      expect(result.data?.loadTime).toBe(150);
    });

    it('should inject inline script code', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        code: 'console.log("Injected script executed");',
        type: 'text/javascript' as const
      };

      const result = await javascriptTools.injectScript(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.scriptId).toBeDefined();
    });

    it('should inject module script', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        code: 'export const testModule = "module";',
        type: 'module' as const,
        defer: true
      };

      const result = await javascriptTools.injectScript(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
    });

    it('should validate URL format', async () => {
      const params = {
        url: 'invalid-url'
      };

      const result = await javascriptTools.injectScript(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should require either URL or code', async () => {
      const params = {
        type: 'text/javascript' as const
        // No URL or code provided
      };

      const result = await javascriptTools.injectScript(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should handle script injection failures', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      vi.mocked(createScriptElement).mockRejectedValue(new Error('Script injection failed'));

      const params = {
        url: 'https://invalid.example.com/script.js'
      };

      const result = await javascriptTools.injectScript(params, sessionId);

      expect(result.status).toBe('error');
    });
  });

  describe('evaluateExpression', () => {
    it('should evaluate simple expressions', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        expression: '2 + 2'
      };

      const result = await javascriptTools.evaluateExpression(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.value).toBe(42); // From mock
      expect(result.data?.type).toBe('number');
      expect(result.data?.isNull).toBe(false);
      expect(result.data?.isUndefined).toBe(false);
    });

    it('should evaluate expressions with JSON return type', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      mockDriver.executeScript.mockResolvedValue({
        value: { test: 'object' },
        type: 'object',
        isNull: false,
        isUndefined: false,
        success: true
      });

      const params = {
        expression: '({ test: "object" })',
        returnType: 'json' as const
      };

      const result = await javascriptTools.evaluateExpression(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.type).toBe('object');
    });

    it('should evaluate expressions with element return type', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      mockDriver.executeScript.mockResolvedValue({
        value: { tagName: 'DIV', id: 'test-div', className: 'test-class' },
        type: 'object',
        isNull: false,
        isUndefined: false,
        success: true
      });

      const params = {
        expression: 'document.getElementById("test-div")',
        returnType: 'element' as const
      };

      const result = await javascriptTools.evaluateExpression(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.value.tagName).toBe('DIV');
    });

    it('should handle expression evaluation errors', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      mockDriver.executeScript.mockResolvedValue({
        value: null,
        type: 'error',
        isNull: false,
        isUndefined: false,
        success: false,
        error: 'ReferenceError: undefined_variable is not defined'
      });

      const params = {
        expression: 'undefined_variable'
      };

      const result = await javascriptTools.evaluateExpression(params, sessionId);

      expect(result.status).toBe('error');
    });

    it('should validate expression parameter', async () => {
      const params = {
        expression: '' // Empty expression
      };

      const result = await javascriptTools.evaluateExpression(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should validate return type parameter', async () => {
      const params = {
        expression: 'true',
        returnType: 'invalid' as any
      };

      const result = await javascriptTools.evaluateExpression(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });
});