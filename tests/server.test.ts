import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import winston from 'winston';

// Mock external dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('selenium-webdriver', () => ({
  Builder: vi.fn().mockImplementation(() => ({
    forBrowser: vi.fn().mockReturnThis(),
    setChromeOptions: vi.fn().mockReturnThis(),
    setFirefoxOptions: vi.fn().mockReturnThis(),
    setChromeService: vi.fn().mockReturnThis(),
    setFirefoxService: vi.fn().mockReturnThis(),
    build: vi.fn().mockResolvedValue({
      quit: vi.fn().mockResolvedValue(undefined),
      getCurrentUrl: vi.fn().mockResolvedValue('about:blank'),
      getCapabilities: vi.fn().mockResolvedValue({}),
      executeScript: vi.fn().mockResolvedValue(true)
    })
  })),
  Capabilities: vi.fn(),
  until: {}
}));

vi.mock('selenium-webdriver/chrome.js', () => ({
  default: {
    Options: vi.fn().mockImplementation(() => ({
      addArguments: vi.fn().mockReturnThis(),
      setChromeBinaryPath: vi.fn().mockReturnThis()
    })),
    ServiceBuilder: vi.fn().mockImplementation(() => ({}))
  }
}));

vi.mock('selenium-webdriver/firefox.js', () => ({
  default: {
    Options: vi.fn().mockImplementation(() => ({
      addArguments: vi.fn().mockReturnThis(),
      setPreference: vi.fn().mockReturnThis()
    })),
    ServiceBuilder: vi.fn().mockImplementation(() => ({}))
  }
}));

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('mock-uuid-1234-5678-9012')
}));

import { WebDriverManager } from '../src/drivers/manager.js';
import { SessionManager } from '../src/drivers/session.js';
import { DriverOptions } from '../src/types/index.js';

const mockLogger = winston.createLogger({
  level: 'error',
  silent: true,
  transports: []
});

describe('Server Components - Comprehensive Coverage', () => {

  describe('WebDriverManager', () => {
    let driverManager: WebDriverManager;

    beforeEach(() => {
      driverManager = new WebDriverManager(mockLogger);
    });

    it('should create Chrome driver', async () => {
      const options: DriverOptions = {
        headless: true,
        windowSize: { width: 1920, height: 1080 }
      };

      const driver = await driverManager.createDriver('chrome', options);

      expect(driver).toBeDefined();
      expect(driver.quit).toBeDefined();
    });

    it('should create Firefox driver', async () => {
      const options: DriverOptions = {
        headless: true,
        userAgent: 'Test Agent'
      };

      const driver = await driverManager.createDriver('firefox', options);

      expect(driver).toBeDefined();
    });

    it('should throw error for unsupported browser', async () => {
      const options: DriverOptions = { headless: true };

      await expect(
        driverManager.createDriver('safari' as any, options)
      ).rejects.toThrow();
    });

    it('should validate driver', async () => {
      const options: DriverOptions = { headless: true };
      const driver = await driverManager.createDriver('chrome', options);

      const isValid = await driverManager.validateDriver(driver);
      expect(isValid).toBe(true);
    });

    it('should close driver safely', async () => {
      const options: DriverOptions = { headless: true };
      const driver = await driverManager.createDriver('chrome', options);

      // Should not throw
      await expect(driverManager.closeDriver(driver)).resolves.not.toThrow();
    });

    it('should get driver capabilities', async () => {
      const options: DriverOptions = { headless: true };
      const driver = await driverManager.createDriver('chrome', options);

      const capabilities = await driverManager.getDriverCapabilities(driver);
      expect(capabilities).toBeDefined();
    });

    it('should check driver health', async () => {
      const options: DriverOptions = { headless: true };
      const driver = await driverManager.createDriver('chrome', options);

      const health = await driverManager.checkDriverHealth(driver);

      expect(health).toHaveProperty('isHealthy');
      expect(health).toHaveProperty('details');
      expect(health.details).toHaveProperty('canNavigate');
      expect(health.details).toHaveProperty('canExecuteScript');
      expect(health.details).toHaveProperty('responseTime');
    });

    it('should handle driver creation errors', async () => {
      // Mock Builder to throw error
      const { Builder } = await import('selenium-webdriver');
      vi.mocked(Builder).mockImplementationOnce(() => ({
        forBrowser: vi.fn().mockReturnThis(),
        setChromeOptions: vi.fn().mockReturnThis(),
        build: vi.fn().mockRejectedValue(new Error('Driver creation failed'))
      } as any));

      const options: DriverOptions = { headless: true };

      await expect(
        driverManager.createDriver('chrome', options)
      ).rejects.toThrow('Failed to create chrome driver');
    });
  });

  describe('SessionManager', () => {
    let sessionManager: SessionManager;
    let driverManager: WebDriverManager;

    beforeEach(() => {
      driverManager = new WebDriverManager(mockLogger);
      sessionManager = new SessionManager(driverManager, mockLogger, 5, 600000);
    });

    afterEach(async () => {
      await sessionManager.shutdown();
    });

    it('should create sessions', async () => {
      const options: DriverOptions = { headless: true };
      const sessionId = await sessionManager.createSession('chrome', options);

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    it('should enforce concurrent session limits', async () => {
      const smallSessionManager = new SessionManager(driverManager, mockLogger, 1, 600000);

      const options: DriverOptions = { headless: true };

      // Create first session
      await smallSessionManager.createSession('chrome', options);

      // Second session should fail
      await expect(
        smallSessionManager.createSession('chrome', options)
      ).rejects.toThrow('Maximum concurrent sessions limit reached');

      await smallSessionManager.shutdown();
    });

    it('should get session information', async () => {
      const options: DriverOptions = { headless: true };
      const sessionId = await sessionManager.createSession('chrome', options);

      const session = sessionManager.getSession(sessionId);

      expect(session.id).toBe(sessionId);
      expect(session.browserType).toBe('chrome');
      expect(session.isReady).toBe(true);
    });

    it('should destroy sessions', async () => {
      const options: DriverOptions = { headless: true };
      const sessionId = await sessionManager.createSession('chrome', options);

      await sessionManager.destroySession(sessionId);

      expect(() => sessionManager.getSession(sessionId)).toThrow();
    });

    it('should list sessions', async () => {
      const options: DriverOptions = { headless: true };
      await sessionManager.createSession('chrome', options);
      const sessions = sessionManager.listSessions();

      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0]).toHaveProperty('id');
      expect(sessions[0]).toHaveProperty('browserType');
    });

    it('should get session metrics', async () => {
      const options: DriverOptions = { headless: true };
      await sessionManager.createSession('chrome', options);

      const metrics = sessionManager.getSessionMetrics();

      expect(metrics).toHaveProperty('totalSessions');
      expect(metrics).toHaveProperty('activeSessions');
      expect(metrics).toHaveProperty('averageSessionAge');
      expect(metrics.totalSessions).toBe(1);
    });

    it('should track session actions', async () => {
      const options: DriverOptions = { headless: true };
      const sessionId = await sessionManager.createSession('chrome', options);

      sessionManager.trackAction(sessionId, 'test_action', '#selector', true, 100);

      const session = sessionManager.getSession(sessionId);
      expect(session.actionHistory.length).toBe(1);
      expect(session.actionHistory[0].action).toBe('test_action');
      expect(session.actionHistory[0].success).toBe(true);
      expect(session.performanceMetrics.totalActions).toBe(1);
      expect(session.performanceMetrics.successfulActions).toBe(1);
    });

    it('should update scroll position', async () => {
      const options: DriverOptions = { headless: true };
      const sessionId = await sessionManager.createSession('chrome', options);

      sessionManager.updateScrollPosition(sessionId, 100, 200);

      const session = sessionManager.getSession(sessionId);
      expect(session.scrollPosition.x).toBe(100);
      expect(session.scrollPosition.y).toBe(200);
    });

    it('should set active element', async () => {
      const options: DriverOptions = { headless: true };
      const sessionId = await sessionManager.createSession('chrome', options);

      sessionManager.setActiveElement(sessionId, '#test-element');

      const session = sessionManager.getSession(sessionId);
      expect(session.activeElement).toBe('#test-element');
    });

    it('should get performance metrics', async () => {
      const options: DriverOptions = { headless: true };
      const sessionId = await sessionManager.createSession('chrome', options);

      // Add small delay to ensure session age > 0
      await new Promise(resolve => setTimeout(resolve, 10));

      // Add some action history
      sessionManager.trackAction(sessionId, 'action1', '#sel1', true, 100);
      sessionManager.trackAction(sessionId, 'action2', '#sel2', false, 200);

      const metrics = sessionManager.getSessionPerformanceMetrics(sessionId);

      expect(metrics.totalActions).toBe(2);
      expect(metrics.successfulActions).toBe(1);
      expect(metrics.successRate).toBe(0.5);
      expect(metrics.averageActionTime).toBe(150);
      expect(metrics.sessionAge).toBeGreaterThan(0);
    });

    it('should check session health', async () => {
      const options: DriverOptions = { headless: true };
      const sessionId = await sessionManager.createSession('chrome', options);

      const isHealthy = await sessionManager.checkSessionHealth(sessionId);
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should refresh sessions', async () => {
      const options: DriverOptions = { headless: true };
      const sessionId = await sessionManager.createSession('chrome', options);

      await expect(sessionManager.refreshSession(sessionId)).resolves.not.toThrow();
    });

    it('should handle session not found errors', () => {
      expect(() => sessionManager.getSession('nonexistent')).toThrow('Session not found');
    });

    it('should maintain action history limit', async () => {
      const options: DriverOptions = { headless: true };
      const sessionId = await sessionManager.createSession('chrome', options);

      // Add more than 10 actions
      for (let i = 0; i < 15; i++) {
        sessionManager.trackAction(sessionId, `action-${i}`, `#sel-${i}`, true);
      }

      const session = sessionManager.getSession(sessionId);
      expect(session.actionHistory.length).toBe(10); // Should be limited to 10
    });

    it('should calculate average action time correctly', async () => {
      const options: DriverOptions = { headless: true };
      const sessionId = await sessionManager.createSession('chrome', options);

      sessionManager.trackAction(sessionId, 'action1', '#sel1', true, 100);
      sessionManager.trackAction(sessionId, 'action2', '#sel2', true, 300);

      const session = sessionManager.getSession(sessionId);
      expect(session.performanceMetrics.averageActionTime).toBe(200);
    });
  });

  describe('Tool Registry Integration', () => {
    it('should import tool classes without errors', async () => {
      // Test that all tool classes can be imported
      const { NavigationTools } = await import('../src/tools/navigation.js');
      const { InteractionTools } = await import('../src/tools/interaction.js');
      const { ExtractionTools } = await import('../src/tools/extraction.js');
      const { AudioTools } = await import('../src/tools/audio.js');

      expect(NavigationTools).toBeDefined();
      expect(InteractionTools).toBeDefined();
      expect(ExtractionTools).toBeDefined();
      expect(AudioTools).toBeDefined();
    });

    it('should create tool registry', async () => {
      const { createToolRegistry } = await import('../src/tools/index.js');

      const mockSessionManager = {
        listSessions: vi.fn().mockReturnValue([]),
        getSession: vi.fn(),
        createSession: vi.fn(),
        destroySession: vi.fn(),
        trackAction: vi.fn()
      };

      const registry = createToolRegistry(mockSessionManager as any, mockLogger);

      expect(registry).toHaveProperty('navigation');
      expect(registry).toHaveProperty('interaction');
      expect(registry).toHaveProperty('extraction');
      expect(registry).toHaveProperty('conditions');
      expect(registry).toHaveProperty('session');
      expect(registry).toHaveProperty('audio');
      expect(registry).toHaveProperty('javascript');
      expect(registry).toHaveProperty('dialogs');
      expect(registry).toHaveProperty('storage');
      expect(registry).toHaveProperty('advancedExtraction');
      expect(registry).toHaveProperty('windows');
      expect(registry).toHaveProperty('frames');
      expect(registry).toHaveProperty('network');
      expect(registry).toHaveProperty('performance');
    });

    it('should have all tool definitions', async () => {
      const { toolDefinitions } = await import('../src/tools/index.js');

      expect(Array.isArray(toolDefinitions)).toBe(true);
      expect(toolDefinitions.length).toBeGreaterThan(50);

      // Check that each tool definition has required properties
      toolDefinitions.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type');
        expect(tool.inputSchema.type).toBe('object');
      });
    });

    it('should execute tools through unified handler', async () => {
      const { executeTool } = await import('../src/tools/index.js');

      const mockRegistry = {
        navigation: {
          getCurrentUrl: vi.fn().mockResolvedValue({
            status: 'success',
            data: { url: 'https://example.com', title: 'Example' }
          })
        }
      };

      const result = await executeTool('get_current_url', {}, mockRegistry as any);

      expect(result.status).toBe('success');
      expect(result.data.url).toBe('https://example.com');
    });

    it('should throw error for unknown tools', async () => {
      const { executeTool } = await import('../src/tools/index.js');

      const mockRegistry = {};

      // Use try-catch instead of expect.rejects for better error handling
      try {
        await executeTool('unknown_tool', {}, mockRegistry as any);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('Unknown tool: unknown_tool');
      }
    });
  });

  describe('Configuration and Environment', () => {
    beforeEach(() => {
      // Reset environment variables
      Object.keys(process.env).forEach(key => {
        if (key.startsWith('BROWSER_') || key.startsWith('MAX_') || key.startsWith('SESSION_') || key.startsWith('LOG_')) {
          delete process.env[key];
        }
      });
    });

    it('should validate environment configuration', async () => {
      const { validateEnvironmentConfig } = await import('../src/utils/validation.js');

      // Set valid environment
      process.env.BROWSER_TYPE = 'chrome';
      process.env.HEADLESS = 'true';
      process.env.MAX_CONCURRENT_SESSIONS = '5';
      process.env.SESSION_TIMEOUT = '600000';
      process.env.LOG_LEVEL = 'info';

      const config = validateEnvironmentConfig();

      expect(config.browserType).toBe('chrome');
      expect(config.headless).toBe(true);
      expect(config.maxConcurrent).toBe(5);
      expect(config.sessionTimeout).toBe(600000);
      expect(config.logLevel).toBe('info');
    });

    it('should use defaults for missing environment variables', async () => {
      const { validateEnvironmentConfig } = await import('../src/utils/validation.js');

      const config = validateEnvironmentConfig();

      expect(config.browserType).toBe('chrome');
      expect(config.headless).toBe(true);
    });

    it('should validate server configuration', async () => {
      const { validateServerConfig } = await import('../src/utils/validation.js');

      const validConfig = {
        name: 'mcp-browser-control',
        version: '1.0.0',
        selenium: {
          browserType: 'chrome' as const,
          headless: true
        },
        session: {
          maxConcurrent: 5,
          timeout: 600000
        },
        logging: {
          level: 'info' as const,
          console: true
        }
      };

      expect(() => validateServerConfig(validConfig)).not.toThrow();
    });
  });

  describe('Error Handling Integration', () => {
    it('should create proper error responses', async () => {
      const { createErrorResponse, ValidationError } = await import('../src/utils/errors.js');

      const error = new ValidationError('Test validation error', 'testField', 'testValue');
      const response = createErrorResponse(error);

      expect(response.status).toBe('error');
      expect(response.error.code).toBe('E004');
      expect(response.error.field).toBe('testField');
      expect(response.error.value).toBe('testValue');
      expect(response.error.troubleshooting).toBeDefined();
    });

    it('should handle unknown errors', async () => {
      const { createErrorResponse } = await import('../src/utils/errors.js');

      const unknownError = new Error('Unknown error type');
      const response = createErrorResponse(unknownError);

      expect(response.status).toBe('error');
      expect(response.error.code).toBe('E999');
      expect(response.error.originalMessage).toBe('Unknown error type');
    });
  });

  describe('Utility Function Integration', () => {
    it('should validate navigation parameters', async () => {
      const { validateNavigateToParams } = await import('../src/utils/validation.js');

      const validParams = {
        url: 'https://example.com',
        waitUntil: 'load' as const,
        timeout: 30000
      };

      const result = validateNavigateToParams(validParams);

      expect(result.url).toBe('https://example.com');
      expect(result.waitUntil).toBe('load');
      expect(result.timeout).toBe(30000);
    });

    it('should normalize selectors', async () => {
      const { normalizeSelector } = await import('../src/utils/selectors.js');

      expect(normalizeSelector('  #test  ')).toBe('#test');
      expect(normalizeSelector('.class')).toBe('.class');
      expect(normalizeSelector('//div')).toBe('//div');
    });

    it('should sanitize strings', async () => {
      const { sanitizeString } = await import('../src/utils/validation.js');

      const input = '  text with \x00 control chars  ';
      const result = sanitizeString(input);

      expect(result).toBe('text with  control chars');
    });
  });
});