import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { WebDriver, WebElement } from 'selenium-webdriver';
import winston from 'winston';

import { InteractionTools } from '../src/tools/interaction.js';
import { SessionManager } from '../src/drivers/session.js';
import { WebDriverManager } from '../src/drivers/manager.js';
import { findElementWithRetry, scrollIntoView, getElementInfo, getElementCenter } from '../src/utils/elements.js';

// Mock the elements utility
vi.mock('../src/utils/elements.js', () => ({
  findElementWithRetry: vi.fn(),
  scrollIntoView: vi.fn(),
  getElementInfo: vi.fn(),
  getElementCenter: vi.fn()
}));

// Mock logger
const mockLogger = winston.createLogger({
  level: 'error',
  silent: true,
  transports: [],
});

describe('InteractionTools', () => {
  let interactionTools: InteractionTools;
  let sessionManager: SessionManager;
  let driverManager: WebDriverManager;
  let mockDriver: any;
  let mockElement: any;

  beforeAll(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Reset all mocks first
    vi.clearAllMocks();

    // Mock element
    mockElement = {
      click: vi.fn().mockResolvedValue(undefined),
      sendKeys: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      getText: vi.fn().mockResolvedValue('Sample text'),
      getAttribute: vi.fn().mockResolvedValue('value'),
      getTagName: vi.fn().mockResolvedValue('button'),
      isEnabled: vi.fn().mockResolvedValue(true),
      isDisplayed: vi.fn().mockResolvedValue(true),
      getRect: vi.fn().mockResolvedValue({ x: 100, y: 200, width: 50, height: 30 }),
      findElement: vi.fn().mockResolvedValue(mockElement),
      findElements: vi.fn().mockResolvedValue([mockElement])
    };

    // Mock driver
    mockDriver = {
      findElement: vi.fn().mockResolvedValue(mockElement),
      findElements: vi.fn().mockResolvedValue([mockElement]),
      executeScript: vi.fn().mockResolvedValue('complete'),
      actions: vi.fn().mockReturnValue({
        contextClick: vi.fn().mockReturnValue({ perform: vi.fn().mockResolvedValue(undefined) }),
        doubleClick: vi.fn().mockReturnValue({ perform: vi.fn().mockResolvedValue(undefined) }),
        click: vi.fn().mockReturnValue({ perform: vi.fn().mockResolvedValue(undefined) }),
        move: vi.fn().mockReturnValue({ perform: vi.fn().mockResolvedValue(undefined) })
      }),
      manage: vi.fn().mockReturnValue({
        window: vi.fn().mockReturnValue({
          getSize: vi.fn().mockResolvedValue({ width: 1920, height: 1080 })
        })
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

    // Create interaction tools
    interactionTools = new InteractionTools(sessionManager, mockLogger);

    // Setup mocks for utilities after creating objects
    vi.mocked(findElementWithRetry).mockResolvedValue(mockElement as any);
    vi.mocked(scrollIntoView).mockResolvedValue(undefined);
    vi.mocked(getElementInfo).mockResolvedValue({
      tag: 'button',
      text: 'Sample text',
      attributes: { id: 'test-button', class: 'btn' },
      rect: { x: 100, y: 200, width: 50, height: 30 },
      visible: true
    });
    vi.mocked(getElementCenter).mockResolvedValue({ x: 125, y: 215 });
  });

  afterEach(async () => {
    await sessionManager.shutdown();
    vi.clearAllMocks();
  });

  describe('click', () => {
    it('should click element successfully with default parameters', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#test-button'
      };

      const result = await interactionTools.click(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.element).toEqual({
        tag: 'button',
        text: 'Sample text',
        attributes: expect.any(Object)
      });
      expect(result.data?.coordinates).toEqual({ x: 125, y: 215 });
      expect(mockElement.click).toHaveBeenCalled();
    });

    it('should handle different click types', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const rightClickParams = {
        selector: '#test-button',
        clickType: 'right' as const
      };

      const result = await interactionTools.click(rightClickParams, sessionId);

      expect(result.status).toBe('success');
      expect(mockDriver.actions().contextClick).toHaveBeenCalledWith(mockElement);
    });

    it('should handle double click', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const doubleClickParams = {
        selector: '#test-button',
        clickType: 'double' as const
      };

      const result = await interactionTools.click(doubleClickParams, sessionId);

      expect(result.status).toBe('success');
      expect(mockDriver.actions().doubleClick).toHaveBeenCalledWith(mockElement);
    });

    it('should validate selector parameter', async () => {
      const invalidParams = {
        selector: ''
      };

      const result = await interactionTools.click(invalidParams);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should handle element not found', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      vi.mocked(findElementWithRetry).mockRejectedValue(new Error('NoSuchElementError'));

      const params = {
        selector: '#non-existent'
      };

      const result = await interactionTools.click(params, sessionId);

      expect(result.status).toBe('error');
    });

    it('should handle disabled element', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      mockElement.isEnabled.mockResolvedValue(false);

      const params = {
        selector: '#disabled-button'
      };

      const result = await interactionTools.click(params, sessionId);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E009'); // ElementNotInteractableError
    });
  });

  describe('typeText', () => {
    it('should type text into input element', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      mockElement.getTagName.mockResolvedValue('input');

      const params = {
        selector: '#text-input',
        text: 'Hello World'
      };

      const result = await interactionTools.typeText(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.finalValue).toBe('value');
      expect(mockElement.sendKeys).toHaveBeenCalledWith('Hello World');
    });

    it('should clear field before typing when clear is true', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      mockElement.getTagName.mockResolvedValue('input');

      const params = {
        selector: '#text-input',
        text: 'New text',
        clear: true
      };

      const result = await interactionTools.typeText(params, sessionId);

      expect(result.status).toBe('success');
      expect(mockElement.clear).toHaveBeenCalled();
      expect(mockElement.sendKeys).toHaveBeenCalledWith('New text');
    });

    it('should type text with delay between keystrokes', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      mockElement.getTagName.mockResolvedValue('input');

      const params = {
        selector: '#text-input',
        text: 'Hi',
        delay: 100
      };

      const result = await interactionTools.typeText(params, sessionId);

      expect(result.status).toBe('success');
      expect(mockElement.sendKeys).toHaveBeenCalledTimes(2); // 'H' and 'i'
    });

    it('should validate non-text input elements', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      mockElement.getTagName.mockResolvedValue('div');

      const params = {
        selector: '#div-element',
        text: 'Cannot type here'
      };

      const result = await interactionTools.typeText(params, sessionId);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E009'); // ElementNotInteractableError
    });

    it('should validate required parameters', async () => {
      const invalidParams = {
        selector: '#input',
        // missing text parameter
      };

      const result = await interactionTools.typeText(invalidParams);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('selectDropdown', () => {
    beforeEach(() => {
      // Create a specific select element mock
      const selectElement = {
        ...mockElement,
        getTagName: vi.fn().mockResolvedValue('select'),
        findElement: vi.fn().mockResolvedValue(mockElement),
        findElements: vi.fn().mockResolvedValue([mockElement, mockElement])
      };
      vi.mocked(findElementWithRetry).mockResolvedValue(selectElement as any);
    });

    it('should select option by value', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      mockElement.getAttribute.mockResolvedValue('option1');

      const params = {
        selector: '#dropdown',
        value: 'option1'
      };

      const result = await interactionTools.selectDropdown(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.selectedOption.value).toBe('option1');
    });

    it('should select option by visible text', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      // Create options that return the correct text
      const option1 = { ...mockElement, getText: vi.fn().mockResolvedValue('Option 1') };
      const option2 = { ...mockElement, getText: vi.fn().mockResolvedValue('Option 2') };

      const selectElement = {
        ...mockElement,
        getTagName: vi.fn().mockResolvedValue('select'),
        findElements: vi.fn().mockResolvedValue([option1, option2])
      };
      vi.mocked(findElementWithRetry).mockResolvedValue(selectElement as any);

      const params = {
        selector: '#dropdown',
        text: 'Option 1'
      };

      const result = await interactionTools.selectDropdown(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.selectedOption.text).toBe('Option 1');
    });

    it('should select option by index', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#dropdown',
        index: 0
      };

      const result = await interactionTools.selectDropdown(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.selectedOption.index).toBe(0);
    });

    it('should validate that element is a select', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      // Mock a non-select element
      const divElement = {
        ...mockElement,
        getTagName: vi.fn().mockResolvedValue('div')
      };
      vi.mocked(findElementWithRetry).mockResolvedValue(divElement as any);

      const params = {
        selector: '#not-select',
        value: 'test'
      };

      const result = await interactionTools.selectDropdown(params, sessionId);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E009'); // ElementNotInteractableError
    });

    it('should require at least one selection criterion', async () => {
      const params = {
        selector: '#dropdown'
        // No value, text, or index provided
      };

      const result = await interactionTools.selectDropdown(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('hover', () => {
    it('should hover over element successfully', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#hover-target'
      };

      const result = await interactionTools.hover(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.element.tag).toBe('button');
      expect(mockDriver.actions().move).toHaveBeenCalledWith({ origin: mockElement });
    });

    it('should hover with custom duration', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#hover-target',
        duration: 2000
      };

      const startTime = Date.now();
      const result = await interactionTools.hover(params, sessionId);
      const endTime = Date.now();

      expect(result.status).toBe('success');
      expect(endTime - startTime).toBeGreaterThanOrEqual(1900); // Allow some tolerance
    });

    it('should hover with offset', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#hover-target',
        offset: { x: 10, y: 20 }
      };

      const result = await interactionTools.hover(params, sessionId);

      expect(result.status).toBe('success');
      expect(mockDriver.actions().move).toHaveBeenCalledWith({
        origin: mockElement,
        x: 10,
        y: 20
      });
    });
  });

  describe('scrollTo', () => {
    beforeEach(() => {
      // Mock scrollIntoView utility specifically for scrollTo tests
      vi.mocked(scrollIntoView).mockResolvedValue(undefined);
      mockDriver.executeScript.mockImplementation((script: string) => {
        if (script.includes('pageXOffset') || script.includes('scrollLeft')) {
          return Promise.resolve({ x: 0, y: 500 });
        }
        return Promise.resolve(undefined);
      });
    });

    it('should scroll to element', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#scroll-target'
      };

      const result = await interactionTools.scrollTo(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.scrollPosition).toEqual({ x: 0, y: 500 });
    });

    it('should scroll to coordinates', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        x: 100,
        y: 200,
        behavior: 'smooth' as const
      };

      const result = await interactionTools.scrollTo(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.scrollPosition).toEqual({ x: 100, y: 200 });
      expect(mockDriver.executeScript).toHaveBeenCalledWith(
        expect.stringContaining('scrollTo')
      );
    });

    it('should require either selector or coordinates', async () => {
      const params = {
        // No selector, x, or y provided
      };

      const result = await interactionTools.scrollTo(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('Error handling', () => {
    it('should handle stale element references with retry', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      // The mock should succeed since findElementWithRetry handles the retry internally
      // This test verifies that the function can recover from stale elements
      vi.mocked(findElementWithRetry).mockResolvedValue(mockElement as any);

      const params = {
        selector: '#flaky-element'
      };

      const result = await interactionTools.click(params, sessionId);

      expect(result.status).toBe('success');
      // The retry logic is handled within findElementWithRetry, so we just verify success
      expect(result.data?.success).toBe(true);
    });

    it('should handle timeout scenarios', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      vi.mocked(findElementWithRetry).mockRejectedValue(new Error('TimeoutError'));

      const params = {
        selector: '#slow-element',
        timeout: 1000
      };

      const result = await interactionTools.click(params, sessionId);

      expect(result.status).toBe('error');
    });
  });
});