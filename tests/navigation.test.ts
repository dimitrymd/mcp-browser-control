import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { WebDriver } from 'selenium-webdriver';
import winston from 'winston';

import { NavigationTools } from '../src/tools/navigation.js';
import { SessionManager } from '../src/drivers/session.js';
import { WebDriverManager } from '../src/drivers/manager.js';
import { NavigationError, TimeoutError, ValidationError } from '../src/utils/errors.js';

// Mock dependencies
vi.mock('selenium-webdriver');
vi.mock('../src/drivers/manager.js');

// Create a mock logger
const mockLogger = winston.createLogger({
  level: 'error',
  silent: true,
  transports: [],
});

describe('NavigationTools', () => {
  let navigationTools: NavigationTools;
  let sessionManager: SessionManager;
  let driverManager: WebDriverManager;
  let mockDriver: any;

  beforeAll(() => {
    // Setup global mocks
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Create mock driver
    mockDriver = {
      get: vi.fn().mockResolvedValue(undefined),
      getCurrentUrl: vi.fn().mockResolvedValue('https://example.com'),
      getTitle: vi.fn().mockResolvedValue('Example Domain'),
      navigate: vi.fn().mockReturnValue({
        back: vi.fn().mockResolvedValue(undefined),
        forward: vi.fn().mockResolvedValue(undefined),
        refresh: vi.fn().mockResolvedValue(undefined),
      }),
      executeScript: vi.fn().mockResolvedValue('complete'),
      wait: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock driver manager
    driverManager = new WebDriverManager(mockLogger);
    vi.mocked(driverManager.createDriver).mockResolvedValue(mockDriver as WebDriver);
    vi.mocked(driverManager.validateDriver).mockResolvedValue(true);
    vi.mocked(driverManager.checkDriverHealth).mockResolvedValue({
      isHealthy: true,
      details: {
        canNavigate: true,
        canExecuteScript: true,
        responseTime: 100,
      },
    });

    // Create session manager
    sessionManager = new SessionManager(driverManager, mockLogger, 5, 600000);

    // Create navigation tools
    navigationTools = new NavigationTools(sessionManager, mockLogger);
  });

  afterEach(async () => {
    // Clean up sessions
    await sessionManager.shutdown();
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('navigateTo', () => {
    it('should navigate to a valid URL successfully', async () => {
      // Create a session first
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        url: 'https://example.com',
        waitUntil: 'load' as const,
        timeout: 30000,
      };

      const result = await navigationTools.navigateTo(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data).toEqual({
        success: true,
        url: 'https://example.com',
        title: 'Example Domain',
        loadTime: expect.any(Number),
      });

      expect(mockDriver.get).toHaveBeenCalledWith('https://example.com');
    });

    it('should validate URL parameters', async () => {
      const invalidParams = {
        url: 'ftp://invalid.com',
      };

      const result = await navigationTools.navigateTo(invalidParams);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should handle navigation timeout', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      // Mock a timeout scenario
      mockDriver.wait.mockRejectedValue(new Error('TimeoutError'));

      const params = {
        url: 'https://slow-site.com',
        timeout: 1000,
      };

      const result = await navigationTools.navigateTo(params, sessionId);

      expect(result.status).toBe('error');
    });

    it('should reject dangerous URLs', async () => {
      const params = {
        url: 'file:///etc/passwd',
      };

      const result = await navigationTools.navigateTo(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should handle different wait conditions', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      // Mock driver.wait to execute the callback function
      mockDriver.wait.mockImplementation(async (callback: Function) => {
        if (typeof callback === 'function') {
          await callback();
        }
        return true;
      });

      const params = {
        url: 'https://example.com',
        waitUntil: 'domcontentloaded' as const,
      };

      const result = await navigationTools.navigateTo(params, sessionId);

      expect(result.status).toBe('success');
      expect(mockDriver.executeScript).toHaveBeenCalledWith(expect.stringContaining('document.readyState'));
    });
  });

  describe('goBack', () => {
    it('should navigate back successfully', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const result = await navigationTools.goBack(sessionId);

      expect(result.status).toBe('success');
      expect(result.data).toEqual({
        success: true,
        url: 'https://example.com',
        title: 'Example Domain',
        loadTime: expect.any(Number),
      });

      expect(mockDriver.navigate().back).toHaveBeenCalled();
    });

    it('should handle back navigation failure', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      mockDriver.navigate().back.mockRejectedValue(new Error('Navigation failed'));

      const result = await navigationTools.goBack(sessionId);

      expect(result.status).toBe('error');
    });

    it('should handle invalid session ID', async () => {
      const result = await navigationTools.goBack('invalid-session-id');

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E001'); // SessionError
    });
  });

  describe('goForward', () => {
    it('should navigate forward successfully', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const result = await navigationTools.goForward(sessionId);

      expect(result.status).toBe('success');
      expect(mockDriver.navigate().forward).toHaveBeenCalled();
    });

    it('should handle forward navigation failure', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      mockDriver.navigate().forward.mockRejectedValue(new Error('No forward history'));

      const result = await navigationTools.goForward(sessionId);

      expect(result.status).toBe('error');
    });
  });

  describe('refresh', () => {
    it('should refresh page normally', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = { hard: false };
      const result = await navigationTools.refresh(params, sessionId);

      expect(result.status).toBe('success');
      expect(mockDriver.navigate().refresh).toHaveBeenCalled();
    });

    it('should perform hard refresh', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = { hard: true };
      const result = await navigationTools.refresh(params, sessionId);

      expect(result.status).toBe('success');
      expect(mockDriver.executeScript).toHaveBeenCalledWith('location.reload(true);');
    });

    it('should handle refresh with invalid parameters', async () => {
      const invalidParams = { hard: 'not-a-boolean' };
      const result = await navigationTools.refresh(invalidParams);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('getCurrentUrl', () => {
    it('should get current URL and title', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const result = await navigationTools.getCurrentUrl(sessionId);

      expect(result.status).toBe('success');
      expect(result.data).toEqual({
        url: 'https://example.com',
        title: 'Example Domain',
      });

      expect(mockDriver.getCurrentUrl).toHaveBeenCalled();
      expect(mockDriver.getTitle).toHaveBeenCalled();
    });

    it('should handle driver errors', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      mockDriver.getCurrentUrl.mockRejectedValue(new Error('Driver error'));

      const result = await navigationTools.getCurrentUrl(sessionId);

      expect(result.status).toBe('error');
    });
  });

  describe('Error Handling', () => {
    it('should create proper error responses for validation errors', async () => {
      const params = {
        url: 'invalid-url',
      };

      const result = await navigationTools.navigateTo(params);

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
      expect(result.error).toHaveProperty('troubleshooting');
    });

    it('should handle WebDriver errors gracefully', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      mockDriver.get.mockRejectedValue(new Error('WebDriver connection lost'));

      const params = {
        url: 'https://example.com',
      };

      const result = await navigationTools.navigateTo(params, sessionId);

      expect(result.status).toBe('error');
    });

    it('should handle timeout errors specifically', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const timeoutError = new Error('TimeoutError');
      timeoutError.name = 'TimeoutError';
      mockDriver.wait.mockRejectedValue(timeoutError);

      const params = {
        url: 'https://slow-site.com',
        timeout: 1000,
      };

      const result = await navigationTools.navigateTo(params, sessionId);

      expect(result.status).toBe('error');
    });
  });

  describe('Session Management Integration', () => {
    it('should update session state after navigation', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        url: 'https://new-site.com',
      };

      mockDriver.getCurrentUrl.mockResolvedValue('https://new-site.com');
      mockDriver.getTitle.mockResolvedValue('New Site');

      await navigationTools.navigateTo(params, sessionId);

      const sessionState = await sessionManager.getSessionState(sessionId);
      expect(sessionState.url).toBe('https://new-site.com');
      expect(sessionState.title).toBe('New Site');
    });

    it('should handle concurrent navigation requests', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params1 = { url: 'https://site1.com' };
      const params2 = { url: 'https://site2.com' };

      // Execute concurrent navigations
      const [result1, result2] = await Promise.all([
        navigationTools.navigateTo(params1, sessionId),
        navigationTools.navigateTo(params2, sessionId),
      ]);

      // Both should complete (though the final state is indeterminate)
      expect([result1.status, result2.status]).toEqual(['success', 'success']);
    });
  });

  describe('URL Validation', () => {
    it('should accept valid HTTP URLs', async () => {
      const params = { url: 'http://example.com' };
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const result = await navigationTools.navigateTo(params, sessionId);
      expect(result.status).toBe('success');
    });

    it('should accept valid HTTPS URLs', async () => {
      const params = { url: 'https://secure.example.com/path?query=value' };
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const result = await navigationTools.navigateTo(params, sessionId);
      expect(result.status).toBe('success');
    });

    it('should reject non-HTTP protocols', async () => {
      const protocols = ['ftp://example.com', 'file:///path', 'javascript:alert(1)', 'data:text/html,<script>'];

      for (const url of protocols) {
        const result = await navigationTools.navigateTo({ url });
        expect(result.status).toBe('error');
        expect(result.error?.code).toBe('E004');
      }
    });

    it('should handle malformed URLs', async () => {
      const malformedUrls = ['not-a-url', 'http://', 'https://'];

      for (const url of malformedUrls) {
        const result = await navigationTools.navigateTo({ url });
        expect(result.status).toBe('error');
        // Malformed URLs result in generic errors (E999) from URL constructor
        expect(['E004', 'E999']).toContain(result.error?.code);
      }
    });
  });
});