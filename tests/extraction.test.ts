import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { WebDriver, WebElement } from 'selenium-webdriver';
import winston from 'winston';

import { ExtractionTools } from '../src/tools/extraction.js';
import { SessionManager } from '../src/drivers/session.js';
import { WebDriverManager } from '../src/drivers/manager.js';
import { findElementWithRetry, findElementsWithRetry } from '../src/utils/elements.js';

// Mock the elements utility
vi.mock('../src/utils/elements.js', () => ({
  findElementWithRetry: vi.fn(),
  findElementsWithRetry: vi.fn()
}));

// Mock logger
const mockLogger = winston.createLogger({
  level: 'error',
  silent: true,
  transports: [],
});

describe('ExtractionTools', () => {
  let extractionTools: ExtractionTools;
  let sessionManager: SessionManager;
  let driverManager: WebDriverManager;
  let mockDriver: any;
  let mockElement: any;

  beforeAll(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Setup mocks for utilities
    vi.mocked(findElementWithRetry).mockResolvedValue(mockElement);
    vi.mocked(findElementsWithRetry).mockResolvedValue([mockElement, mockElement]);

    // Mock element
    mockElement = {
      getText: vi.fn().mockResolvedValue('Sample element text'),
      getAttribute: vi.fn().mockImplementation((attr: string) => {
        const attributes: Record<string, string> = {
          'id': 'test-element',
          'class': 'test-class',
          'outerHTML': '<div id="test-element" class="test-class">Sample element text</div>',
          'value': 'input-value'
        };
        return Promise.resolve(attributes[attr] || null);
      }),
      getCssValue: vi.fn().mockResolvedValue('16px'),
      takeScreenshot: vi.fn().mockResolvedValue('base64ScreenshotData'),
      getRect: vi.fn().mockResolvedValue({ x: 10, y: 20, width: 100, height: 50 })
    };

    // Mock driver
    mockDriver = {
      findElement: vi.fn().mockResolvedValue(mockElement),
      findElements: vi.fn().mockResolvedValue([mockElement, mockElement]),
      getPageSource: vi.fn().mockResolvedValue(`
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Main Title</h1>
            <p>Sample paragraph text</p>
            <div class="content">Content area</div>
          </body>
        </html>
      `),
      getCurrentUrl: vi.fn().mockResolvedValue('https://example.com/test'),
      getTitle: vi.fn().mockResolvedValue('Test Page'),
      takeScreenshot: vi.fn().mockResolvedValue('base64ScreenshotData'),
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

    // Create extraction tools
    extractionTools = new ExtractionTools(sessionManager, mockLogger);
  });

  afterEach(async () => {
    await sessionManager.shutdown();
    vi.clearAllMocks();
  });

  describe('getPageContent', () => {
    it('should extract page content as HTML', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        format: 'html' as const
      };

      const result = await extractionTools.getPageContent(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.content).toMatch(/Page content saved to.*browser-control\/pagecache.*\.html/);
      expect(result.data?.path).toMatch(/browser-control\/pagecache.*\.html$/);
      expect(result.data?.metadata).toEqual({
        title: 'Test Page',
        url: 'https://example.com/test',
        length: expect.any(Number)
      });
    });

    it('should extract page content as text', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        format: 'text' as const
      };

      const result = await extractionTools.getPageContent(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.content).toMatch(/Page content saved to.*browser-control\/pagecache.*\.txt/);
      expect(result.data?.path).toMatch(/browser-control\/pagecache.*\.txt$/);
      expect(result.data?.metadata).toEqual({
        title: 'Test Page',
        url: 'https://example.com/test',
        length: expect.any(Number)
      });
    });

    it('should extract page content as markdown', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        format: 'markdown' as const
      };

      const result = await extractionTools.getPageContent(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.content).toMatch(/Page content saved to.*browser-control\/pagecache.*\.md/);
      expect(result.data?.path).toMatch(/browser-control\/pagecache.*\.md$/);
      expect(result.data?.metadata).toEqual({
        title: 'Test Page',
        url: 'https://example.com/test',
        length: expect.any(Number)
      });
    });

    it('should extract specific element content', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        format: 'html' as const,
        selector: '#test-element'
      };

      const result = await extractionTools.getPageContent(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.content).toMatch(/Page content saved to.*browser-control\/pagecache.*\.html/);
      expect(result.data?.path).toMatch(/browser-control\/pagecache.*\.html$/);
      expect(result.data?.metadata).toEqual({
        title: 'Test Page',
        url: 'https://example.com/test',
        length: expect.any(Number)
      });
    });

    it('should validate format parameter', async () => {
      const params = {
        format: 'invalid' as any
      };

      const result = await extractionTools.getPageContent(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('getElementText', () => {
    it('should get text from single element', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#test-element'
      };

      const result = await extractionTools.getElementText(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.text).toBe('Sample element text');
      expect(result.data?.count).toBe(1);
    });

    it('should get text from multiple elements', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '.test-class',
        all: true
      };

      const result = await extractionTools.getElementText(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.text).toEqual(['Sample element text', 'Sample element text']);
      expect(result.data?.count).toBe(2);
    });

    it('should trim text by default', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      const paddedElement = {
        ...mockElement,
        getText: vi.fn().mockResolvedValue('  Padded text  ')
      };
      vi.mocked(findElementWithRetry).mockResolvedValue(paddedElement as any);

      const params = {
        selector: '#test-element',
        trim: true
      };

      const result = await extractionTools.getElementText(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.text).toBe('Padded text');
    });

    it('should preserve whitespace when trim is false', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      const paddedElement = {
        ...mockElement,
        getText: vi.fn().mockResolvedValue('  Padded text  ')
      };
      vi.mocked(findElementWithRetry).mockResolvedValue(paddedElement as any);

      const params = {
        selector: '#test-element',
        trim: false
      };

      const result = await extractionTools.getElementText(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.text).toBe('  Padded text  ');
    });

    it('should validate selector parameter', async () => {
      const params = {
        selector: ''
      };

      const result = await extractionTools.getElementText(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('getElementAttribute', () => {
    it('should get attribute from single element', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#test-element',
        attribute: 'id'
      };

      const result = await extractionTools.getElementAttribute(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.value).toBe('test-element');
      expect(result.data?.elements).toBe(1);
    });

    it('should get attribute from multiple elements', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '.test-class',
        attribute: 'class',
        all: true
      };

      const result = await extractionTools.getElementAttribute(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.value).toEqual(['test-class', 'test-class']);
      expect(result.data?.elements).toBe(2);
    });

    it('should handle non-existent attributes', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#test-element',
        attribute: 'non-existent'
      };

      const result = await extractionTools.getElementAttribute(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.value).toBe(null);
    });

    it('should validate required parameters', async () => {
      const params = {
        selector: '#test-element'
        // Missing attribute parameter
      };

      const result = await extractionTools.getElementAttribute(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('takeScreenshot', () => {
    it('should take full page screenshot', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        fullPage: true
      };

      const result = await extractionTools.takeScreenshot(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.data).toMatch(/Screenshot saved to.*browser-control\/screenshots.*\.png/);
      expect(result.data?.path).toMatch(/browser-control\/screenshots.*\.png$/);
      expect(result.data?.dimensions).toEqual({ width: 1920, height: 1080 });
      expect(mockDriver.takeScreenshot).toHaveBeenCalled();
    });

    it('should take element screenshot', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#test-element'
      };

      const result = await extractionTools.takeScreenshot(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.data).toMatch(/Screenshot saved to.*browser-control\/screenshots.*\.png/);
      expect(result.data?.path).toMatch(/browser-control\/screenshots.*\.png$/);
      expect(result.data?.dimensions).toEqual({ width: 100, height: 50 });
    });

    it('should handle different formats', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const pngParams = {
        format: 'png' as const
      };

      const result = await extractionTools.takeScreenshot(pngParams, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.data).toMatch(/Screenshot saved to.*browser-control\/screenshots.*\.png/);
      expect(result.data?.path).toMatch(/browser-control\/screenshots.*\.png$/);
    });

    it('should validate format parameter', async () => {
      const params = {
        format: 'invalid' as any
      };

      const result = await extractionTools.takeScreenshot(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('getElementProperties', () => {
    it('should get CSS properties from element', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });

      const params = {
        selector: '#test-element',
        properties: ['font-size', 'color', 'margin']
      };

      const result = await extractionTools.getElementProperties(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.properties).toEqual({
        'font-size': '16px',
        'color': '16px',
        'margin': '16px'
      });
      expect(result.data?.computed).toBe(true);
    });

    it('should validate properties parameter', async () => {
      const params = {
        selector: '#test-element',
        properties: 'not-an-array' as any
      };

      const result = await extractionTools.getElementProperties(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });

    it('should validate selector parameter', async () => {
      const params = {
        selector: '',
        properties: ['font-size']
      };

      const result = await extractionTools.getElementProperties(params);

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('E004'); // ValidationError
    });
  });

  describe('Error handling', () => {
    it('should handle element not found errors', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      vi.mocked(findElementWithRetry).mockRejectedValue(new Error('NoSuchElementError'));

      const params = {
        selector: '#non-existent',
        attribute: 'id'
      };

      const result = await extractionTools.getElementAttribute(params, sessionId);

      expect(result.status).toBe('error');
    });

    it('should handle driver errors gracefully', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      mockDriver.getPageSource.mockRejectedValue(new Error('Driver error'));

      const params = {
        format: 'html' as const
      };

      const result = await extractionTools.getPageContent(params, sessionId);

      expect(result.status).toBe('error');
    });

    it('should handle screenshot failures', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      mockDriver.takeScreenshot.mockRejectedValue(new Error('Screenshot failed'));

      const params = {};

      const result = await extractionTools.takeScreenshot(params, sessionId);

      expect(result.status).toBe('error');
    });
  });

  describe('Content format conversion', () => {
    it('should properly convert HTML to text', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      mockDriver.getPageSource.mockResolvedValue(`
        <html>
          <body>
            <h1>Title</h1>
            <p>Paragraph with <strong>bold</strong> text</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </body>
        </html>
      `);

      const params = {
        format: 'text' as const
      };

      const result = await extractionTools.getPageContent(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.content).toMatch(/Page content saved to.*browser-control\/pagecache.*\.txt/);
      expect(result.data?.path).toMatch(/browser-control\/pagecache.*\.txt$/);
      expect(result.data?.metadata).toEqual({
        title: 'Test Page',
        url: 'https://example.com/test',
        length: expect.any(Number)
      });
    });

    it('should properly convert HTML to markdown', async () => {
      const sessionId = await sessionManager.createSession('chrome', { headless: true });
      mockDriver.getPageSource.mockResolvedValue(`
        <html>
          <body>
            <h1>Main Title</h1>
            <h2>Subtitle</h2>
            <p>Paragraph with <strong>bold</strong> and <em>italic</em> text</p>
            <a href="https://example.com">Link text</a>
          </body>
        </html>
      `);

      const params = {
        format: 'markdown' as const
      };

      const result = await extractionTools.getPageContent(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.content).toMatch(/Page content saved to.*browser-control\/pagecache.*\.md/);
      expect(result.data?.path).toMatch(/browser-control\/pagecache.*\.md$/);
      expect(result.data?.metadata).toEqual({
        title: 'Test Page',
        url: 'https://example.com/test',
        length: expect.any(Number)
      });
    });
  });
});