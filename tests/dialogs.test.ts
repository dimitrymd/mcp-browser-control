import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { WebDriver } from 'selenium-webdriver';
import winston from 'winston';

import { DialogTools } from '../src/tools/dialogs.js';
import { SessionManager } from '../src/drivers/session.js';
import { WebDriverManager } from '../src/drivers/manager.js';

// Mock logger
const mockLogger = winston.createLogger({
  level: 'error',
  silent: true,
  transports: [],
});

describe('DialogTools', () => {
  let dialogTools: DialogTools;
  let sessionManager: SessionManager;
  let driverManager: WebDriverManager;
  let mockDriver: any;
  let mockAlert: any;

  beforeAll(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock alert object
    mockAlert = {
      getText: vi.fn().mockResolvedValue('Test alert message'),
      accept: vi.fn().mockResolvedValue(undefined),
      dismiss: vi.fn().mockResolvedValue(undefined),
      sendKeys: vi.fn().mockResolvedValue(undefined)
    };

    // Mock driver
    mockDriver = {
      switchTo: vi.fn().mockReturnValue({
        alert: vi.fn().mockResolvedValue(mockAlert)
      }),
      wait: vi.fn().mockResolvedValue(mockAlert),
      executeScript: vi.fn().mockImplementation((script: string) => {
        if (script.includes('MCPDialogHandler')) {
          return Promise.resolve({
            hasHandler: false,
            settings: null
          });
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

    // Create dialog tools
    dialogTools = new DialogTools(sessionManager, mockLogger);
  });

  afterEach(async () => {
    await sessionManager.shutdown();
    vi.clearAllMocks();
  });

  describe('handleAlert', () => {
    it('should accept alert dialog', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        action: 'accept' as const,
        timeout: 5000
      };

      const result = await dialogTools.handleAlert(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.handled).toBe(true);
      expect(result.data?.alertText).toBe('Test alert message');
      expect(result.data?.alertType).toBe('alert');
      expect(mockAlert.accept).toHaveBeenCalled();
    });

    it('should dismiss alert dialog', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        action: 'dismiss' as const
      };

      const result = await dialogTools.handleAlert(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.handled).toBe(true);
      expect(mockAlert.dismiss).toHaveBeenCalled();
    });

    it('should get alert text', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        action: 'getText' as const
      };

      const result = await dialogTools.handleAlert(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.handled).toBe(true);
      expect(result.data?.alertText).toBe('Test alert message');
      expect(mockAlert.getText).toHaveBeenCalled();
    });

    it('should send keys to prompt dialog', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      mockAlert.getText.mockResolvedValue('Please enter your name:');

      const params = {
        action: 'sendKeys' as const,
        text: 'John Doe'
      };

      const result = await dialogTools.handleAlert(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.handled).toBe(true);
      expect(result.data?.alertType).toBe('prompt');
      expect(mockAlert.sendKeys).toHaveBeenCalledWith('John Doe');
      expect(mockAlert.accept).toHaveBeenCalled();
    });

    it('should handle alert timeout', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      // Mock no alert appearing
      mockDriver.wait.mockResolvedValue(null);

      const params = {
        action: 'accept' as const,
        timeout: 1000
      };

      const result = await dialogTools.handleAlert(params, sessionId);

      expect(result.status).toBe('error');
    });

    it('should validate action parameter', async () => {
      const params = {
        action: 'invalid' as any
      };

      const result = await dialogTools.handleAlert(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should require text for sendKeys action', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        action: 'sendKeys' as const
        // No text provided
      };

      const result = await dialogTools.handleAlert(params, sessionId);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('setDialogHandler', () => {
    it('should enable automatic dialog handler', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        enabled: true,
        autoAccept: true,
        promptText: 'Default prompt response'
      };

      const result = await dialogTools.setDialogHandler(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.previousHandler).toBeDefined();
      expect(mockDriver.executeScript).toHaveBeenCalled();
    });

    it('should disable dialog handler', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      // Mock existing handler
      mockDriver.executeScript.mockResolvedValueOnce({
        hasHandler: true,
        settings: { autoAccept: true }
      });

      const params = {
        enabled: false
      };

      const result = await dialogTools.setDialogHandler(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
    });

    it('should set dialog handler with custom callback', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        enabled: true,
        callback: 'return type === "confirm" ? true : "test"'
      };

      const result = await dialogTools.setDialogHandler(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
    });

    it('should validate enabled parameter', async () => {
      const params = {
        enabled: 'true' as any // Should be boolean
      };

      const result = await dialogTools.setDialogHandler(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should validate callback JavaScript syntax', async () => {
      const params = {
        enabled: true,
        callback: 'invalid javascript syntax {'
      };

      const result = await dialogTools.setDialogHandler(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should handle dialog handler setup errors', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      mockDriver.executeScript.mockRejectedValue(new Error('Script execution failed'));

      const params = {
        enabled: true,
        autoAccept: true
      };

      const result = await dialogTools.setDialogHandler(params, sessionId);

      expect(result.status).toBe('error');
    });
  });
});