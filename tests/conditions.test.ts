import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { WebDriver, WebElement } from 'selenium-webdriver';
import winston from 'winston';

import { ConditionTools } from '../src/tools/conditions.js';
import { SessionManager } from '../src/drivers/session.js';
import { WebDriverManager } from '../src/drivers/manager.js';
import { findElementsWithRetry, waitForElement, isElementVisible } from '../src/utils/elements.js';

// Mock the elements utility
vi.mock('../src/utils/elements.js', () => ({
  findElementsWithRetry: vi.fn(),
  waitForElement: vi.fn(),
  isElementVisible: vi.fn().mockResolvedValue(true)
}));

// Mock logger
const mockLogger = winston.createLogger({
  level: 'error',
  silent: true,
  transports: [],
});

describe('ConditionTools', () => {
  let conditionTools: ConditionTools;
  let sessionManager: SessionManager;
  let driverManager: WebDriverManager;
  let mockDriver: any;
  let mockElement: any;

  beforeAll(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Setup mocks for utilities
    vi.mocked(findElementsWithRetry).mockResolvedValue([mockElement]);
    vi.mocked(waitForElement).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate wait time
      return mockElement;
    });
    vi.mocked(isElementVisible).mockResolvedValue(true);

    // Mock element
    mockElement = {
      getText: vi.fn().mockResolvedValue('Sample text'),
      isDisplayed: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      getTagName: vi.fn().mockResolvedValue('div')
    };

    // Mock driver
    mockDriver = {
      findElement: vi.fn().mockResolvedValue(mockElement),
      findElements: vi.fn().mockResolvedValue([mockElement, mockElement]),
      wait: vi.fn().mockImplementation(async (callback: Function) => {
        if (typeof callback === 'function') {
          return await callback();
        }
        return mockElement;
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

    // Create condition tools
    conditionTools = new ConditionTools(sessionManager, mockLogger);
  });

  afterEach(async () => {
    await sessionManager.shutdown();
    vi.clearAllMocks();
  });

  describe('waitForElement', () => {
    it('should wait for element to be present', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#test-element',
        condition: 'present' as const,
        timeout: 5000
      };

      const result = await conditionTools.waitForElement(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.waitTime).toBeGreaterThan(0);
    });

    it('should wait for element to be visible', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#test-element',
        condition: 'visible' as const
      };

      const result = await conditionTools.waitForElement(params, sessionId);

      expect(result.status).toBe('success');
    });

    it('should wait for element to be clickable', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#test-element',
        condition: 'clickable' as const
      };

      const result = await conditionTools.waitForElement(params, sessionId);

      expect(result.status).toBe('success');
    });

    it('should validate condition parameter', async () => {
      const params = {
        selector: '#test-element',
        condition: 'invalid' as any
      };

      const result = await conditionTools.waitForElement(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('waitForText', () => {
    it('should wait for text to appear', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        text: 'Sample text',
        timeout: 5000
      };

      const result = await conditionTools.waitForText(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.element.tag).toBe('div');
    });

    it('should search within specific element', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        text: 'Sample text',
        selector: '#container'
      };

      const result = await conditionTools.waitForText(params, sessionId);

      expect(result.status).toBe('success');
    });

    it('should support exact text matching', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        text: 'Sample text',
        exact: true
      };

      const result = await conditionTools.waitForText(params, sessionId);

      expect(result.status).toBe('success');
    });

    it('should validate text parameter', async () => {
      const params = {
        text: ''
      };

      const result = await conditionTools.waitForText(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('elementExists', () => {
    it('should check if element exists', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      vi.mocked(findElementsWithRetry).mockResolvedValue([mockElement]);

      const params = {
        selector: '#test-element'
      };

      const result = await conditionTools.elementExists(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.exists).toBe(true);
      expect(result.data?.count).toBe(1);
      expect(result.data?.visible).toBe(0); // visible not checked by default
    });

    it('should check element visibility', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      vi.mocked(findElementsWithRetry).mockResolvedValue([mockElement, mockElement]);
      vi.mocked(isElementVisible).mockResolvedValue(true);

      const params = {
        selector: '#test-element',
        visible: true
      };

      const result = await conditionTools.elementExists(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.exists).toBe(true);
      expect(result.data?.visible).toBeGreaterThan(0);
    });

    it('should handle non-existent elements', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      vi.mocked(findElementsWithRetry).mockResolvedValue([]);

      const params = {
        selector: '#non-existent'
      };

      const result = await conditionTools.elementExists(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.exists).toBe(false);
      expect(result.data?.count).toBe(0);
    });
  });
});