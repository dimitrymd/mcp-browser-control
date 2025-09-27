import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { WebDriver } from 'selenium-webdriver';
import winston from 'winston';

import { StorageTools } from '../src/tools/storage.js';
import { SessionManager } from '../src/drivers/session.js';
import { WebDriverManager } from '../src/drivers/manager.js';

// Mock logger
const mockLogger = winston.createLogger({
  level: 'error',
  silent: true,
  transports: [],
});

describe('StorageTools', () => {
  let storageTools: StorageTools;
  let sessionManager: SessionManager;
  let driverManager: WebDriverManager;
  let mockDriver: any;

  beforeAll(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock driver with storage capabilities
    mockDriver = {
      manage: vi.fn().mockReturnValue({
        getCookies: vi.fn().mockResolvedValue([
          {
            name: 'test-cookie',
            value: 'test-value',
            domain: '.example.com',
            path: '/',
            secure: false,
            httpOnly: false,
            sameSite: 'Lax',
            expiry: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
          }
        ]),
        addCookie: vi.fn().mockResolvedValue(undefined),
        deleteCookie: vi.fn().mockResolvedValue(undefined),
        deleteAllCookies: vi.fn().mockResolvedValue(undefined)
      }),
      executeScript: vi.fn().mockImplementation((script: string, ...args: any[]) => {
        if (script.includes('localStorage') || script.includes('sessionStorage')) {
          const action = args[1]; // Second argument is action
          const key = args[2]; // Third argument is key
          const value = args[3]; // Fourth argument is value

          if (action === 'set') {
            return Promise.resolve({
              data: value,
              size: 26,
              keys: [key]
            });
          } else {
            return Promise.resolve({
              data: { 'test-key': 'test-value' },
              size: 26,
              keys: ['test-key']
            });
          }
        }
        return Promise.resolve(undefined);
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

    // Create storage tools
    storageTools = new StorageTools(sessionManager, mockLogger);
  });

  afterEach(async () => {
    await sessionManager.shutdown();
    vi.clearAllMocks();
  });

  describe('manageCookies', () => {
    it('should get all cookies', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        action: 'get' as const
      };

      const result = await storageTools.manageCookies(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.cookies).toHaveLength(1);
      expect(result.data?.cookies[0].name).toBe('test-cookie');
      expect(result.data?.cookies[0].value).toBe('test-value');
    });

    it('should set new cookie', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        action: 'set' as const,
        cookie: {
          name: 'new-cookie',
          value: 'new-value',
          domain: '.example.com',
          path: '/',
          secure: true,
          httpOnly: false,
          sameSite: 'Strict' as const,
          expires: Date.now() + 86400000 // 24 hours
        }
      };

      const result = await storageTools.manageCookies(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.affected).toBe(1);
      expect(result.data?.cookies[0].name).toBe('new-cookie');
      expect(mockDriver.manage().addCookie).toHaveBeenCalled();
    });

    it('should delete specific cookie', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        action: 'delete' as const,
        filter: { name: 'test-cookie' }
      };

      const result = await storageTools.manageCookies(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.affected).toBe(1);
      expect(mockDriver.manage().deleteCookie).toHaveBeenCalledWith('test-cookie');
    });

    it('should clear all cookies', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        action: 'clear' as const
      };

      const result = await storageTools.manageCookies(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.affected).toBe(-1); // Unknown count for clear all
      expect(mockDriver.manage().deleteAllCookies).toHaveBeenCalled();
    });

    it('should filter cookies by domain', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        action: 'get' as const,
        filter: { domain: 'example.com' }
      };

      const result = await storageTools.manageCookies(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.cookies).toHaveLength(1);
    });

    it('should validate action parameter', async () => {
      const params = {
        action: 'invalid' as any
      };

      const result = await storageTools.manageCookies(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should validate cookie for set action', async () => {
      const params = {
        action: 'set' as const,
        cookie: {
          name: 'test-cookie'
          // Missing value parameter for set action
        }
      };

      const result = await storageTools.manageCookies(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('manageStorage', () => {
    it('should get localStorage value', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        storageType: 'localStorage' as const,
        action: 'get' as const,
        key: 'test-key'
      };

      const result = await storageTools.manageStorage(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.data).toBeDefined();
      expect(result.data?.size).toBeGreaterThan(0);
      expect(result.data?.keys).toContain('test-key');
    });

    it('should set localStorage value', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        storageType: 'localStorage' as const,
        action: 'set' as const,
        key: 'new-key',
        value: 'new-value'
      };

      const result = await storageTools.manageStorage(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.data).toBe('new-value');
    });

    it('should remove localStorage item', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        storageType: 'localStorage' as const,
        action: 'remove' as const,
        key: 'test-key'
      };

      const result = await storageTools.manageStorage(params, sessionId);

      expect(result.status).toBe('success');
    });

    it('should clear all localStorage', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        storageType: 'localStorage' as const,
        action: 'clear' as const
      };

      const result = await storageTools.manageStorage(params, sessionId);

      expect(result.status).toBe('success');
    });

    it('should get all localStorage keys', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        storageType: 'localStorage' as const,
        action: 'getAllKeys' as const
      };

      const result = await storageTools.manageStorage(params, sessionId);

      expect(result.status).toBe('success');
      expect(Array.isArray(result.data?.keys)).toBe(true);
    });

    it('should work with sessionStorage', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        storageType: 'sessionStorage' as const,
        action: 'get' as const,
        key: 'session-key'
      };

      const result = await storageTools.manageStorage(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.data).toBeDefined();
    });

    it('should validate storage type', async () => {
      const params = {
        storageType: 'invalid' as any,
        action: 'get' as const
      };

      const result = await storageTools.manageStorage(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should validate action parameter', async () => {
      const params = {
        storageType: 'localStorage' as const,
        action: 'invalid' as any
      };

      const result = await storageTools.manageStorage(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should require key for set action', async () => {
      const params = {
        storageType: 'localStorage' as const,
        action: 'set' as const,
        value: 'test-value'
        // Missing key
      };

      const result = await storageTools.manageStorage(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('clearBrowserData', () => {
    it('should clear specified data types', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        dataTypes: ['cookies', 'localStorage', 'sessionStorage']
      };

      const result = await storageTools.clearBrowserData(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.cleared).toContain('cookies');
      expect(result.data?.cleared).toContain('localStorage');
      expect(result.data?.cleared).toContain('sessionStorage');
      expect(result.data?.errors).toHaveLength(0);
    });

    it('should clear cache data', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        dataTypes: ['cache']
      };

      const result = await storageTools.clearBrowserData(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.cleared).toContain('cache');
    });

    it('should clear indexedDB', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        dataTypes: ['indexedDB']
      };

      const result = await storageTools.clearBrowserData(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.cleared).toContain('indexedDB');
    });

    it('should handle clearing errors gracefully', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      // Mock some clearing operations to fail
      mockDriver.executeScript.mockRejectedValueOnce(new Error('IndexedDB clearing failed'));

      const params = {
        dataTypes: ['indexedDB', 'localStorage']
      };

      const result = await storageTools.clearBrowserData(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.errors.length).toBeGreaterThan(0);
    });

    it('should validate dataTypes parameter', async () => {
      const params = {
        dataTypes: [] // Empty array
      };

      const result = await storageTools.clearBrowserData(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should validate dataTypes contains valid values', async () => {
      const params = {
        dataTypes: ['cookies', 'invalid-type']
      };

      const result = await storageTools.clearBrowserData(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should validate time range if provided', async () => {
      const params = {
        dataTypes: ['cookies'],
        timeRange: {
          start: 1000,
          end: 500 // End before start
        }
      };

      const result = await storageTools.clearBrowserData(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });
});