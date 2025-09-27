import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { WebDriver } from 'selenium-webdriver';
import winston from 'winston';

import { AdvancedExtractionTools } from '../src/tools/extraction-advanced.js';
import { WindowTools } from '../src/tools/windows.js';
import { FrameTools } from '../src/tools/frames.js';
import { NetworkTools } from '../src/tools/network.js';
import { PerformanceTools } from '../src/tools/performance.js';
import { SessionManager } from '../src/drivers/session.js';

// Mock utilities
vi.mock('../src/utils/elements.js', () => ({
  findElementWithRetry: vi.fn(),
  findElementsWithRetry: vi.fn()
}));

vi.mock('../src/utils/data-processing.js', () => ({
  extractTableFromHTML: vi.fn().mockReturnValue({
    data: [['col1', 'col2'], ['val1', 'val2']],
    headers: ['Column 1', 'Column 2']
  }),
  convertToFormat: vi.fn().mockReturnValue('formatted data'),
  detectDataTypes: vi.fn().mockReturnValue({ col1: 'string', col2: 'string' }),
  cleanData: vi.fn().mockImplementation(data => data),
  analyzeDataQuality: vi.fn().mockReturnValue({
    totalRows: 1,
    completeness: {},
    duplicates: 0,
    dataTypes: {},
    summary: 'Test data'
  })
}));

const mockLogger = winston.createLogger({
  level: 'error',
  silent: true,
  transports: [],
});

describe('Sprint 4 Tools - Core Functionality', () => {
  let tools: any;
  let sessionManager: SessionManager;

  beforeEach(() => {
    const mockElement = {
      getTagName: vi.fn().mockResolvedValue('table'),
      getAttribute: vi.fn().mockResolvedValue('<table><tr><td>test</td></tr></table>'),
      findElements: vi.fn().mockResolvedValue([])
    };

    const driverManager = {
      createDriver: vi.fn().mockResolvedValue({
        executeScript: vi.fn().mockImplementation((script: string) => {
          if (script.includes('querySelectorAll')) {
            return Promise.resolve({
              forms: 2,
              tables: 1,
              images: 5,
              links: 10
            });
          }
          if (script.includes('getAllWindowHandles')) {
            return Promise.resolve(['window1', 'window2']);
          }
          if (script.includes('performance')) {
            return Promise.resolve({
              navigation: { loadTime: 1500, domContentLoaded: 800 },
              resources: { count: 25, totalSize: 524288, averageDuration: 150 }
            });
          }
          return Promise.resolve({});
        }),
        getAllWindowHandles: vi.fn().mockResolvedValue(['window1', 'window2']),
        getWindowHandle: vi.fn().mockResolvedValue('window1'),
        switchTo: vi.fn().mockReturnValue({
          window: vi.fn().mockResolvedValue(undefined),
          frame: vi.fn().mockResolvedValue(undefined),
          parentFrame: vi.fn().mockResolvedValue(undefined),
          defaultContent: vi.fn().mockResolvedValue(undefined)
        }),
        manage: vi.fn().mockReturnValue({
          window: vi.fn().mockReturnValue({
            setRect: vi.fn().mockResolvedValue(undefined),
            getRect: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 1920, height: 1080 })
          })
        }),
        get: vi.fn().mockResolvedValue(undefined),
        getTitle: vi.fn().mockResolvedValue('Test Page'),
        getCurrentUrl: vi.fn().mockResolvedValue('https://example.com'),
        close: vi.fn().mockResolvedValue(undefined),
        findElement: vi.fn().mockResolvedValue(mockElement),
        findElements: vi.fn().mockResolvedValue([mockElement])
      }),
      validateDriver: vi.fn().mockResolvedValue(true),
      closeDriver: vi.fn().mockResolvedValue(undefined),
      checkDriverHealth: vi.fn().mockResolvedValue({ isHealthy: true, details: {} })
    };

    sessionManager = new SessionManager(driverManager as any, mockLogger, 5, 600000);

    tools = {
      advancedExtraction: new AdvancedExtractionTools(sessionManager, mockLogger),
      windows: new WindowTools(sessionManager, mockLogger),
      frames: new FrameTools(sessionManager, mockLogger),
      network: new NetworkTools(sessionManager, mockLogger),
      performance: new PerformanceTools(sessionManager, mockLogger)
    };

    // Mocks are already set up at module level
  });

  afterEach(async () => {
    await sessionManager.shutdown();
  });

  describe('Advanced Extraction Tools', () => {
    it('should validate extract_table_data parameters', async () => {
      const result = await tools.advancedExtraction.extractTableData({
        selector: '',
        format: 'json'
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate extract_structured_data schema', async () => {
      const result = await tools.advancedExtraction.extractStructuredData({
        schema: {
          selector: '',
          fields: []
        }
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate extract_form_data parameters', async () => {
      const result = await tools.advancedExtraction.extractFormData({
        selector: 'form'
      });

      expect(result.status).toBe('error'); // No session
    });

    it('should validate extract_media_info parameters', async () => {
      const result = await tools.advancedExtraction.extractMediaInfo({
        mediaType: 'invalid'
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate extract_links parameters', async () => {
      const result = await tools.advancedExtraction.extractLinks({
        pattern: '[invalid regex'
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });
  });

  describe('Window Management Tools', () => {
    it('should handle get_windows without session', async () => {
      const result = await tools.windows.getWindows({});

      expect(result.status).toBe('error'); // No session
    });

    it('should validate switch_window target', async () => {
      const result = await tools.windows.switchWindow({
        target: null
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate open_new_window parameters', async () => {
      const result = await tools.windows.openNewWindow({
        type: 'invalid'
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate arrange_windows layout', async () => {
      const result = await tools.windows.arrangeWindows({
        layout: 'invalid'
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });
  });

  describe('iframe Support Tools', () => {
    it('should handle get_frames without session', async () => {
      const result = await tools.frames.getFrames({});

      expect(result.status).toBe('error'); // No session
    });

    it('should validate switch_to_frame target', async () => {
      const result = await tools.frames.switchToFrame({
        target: null
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate execute_in_frame parameters', async () => {
      const result = await tools.frames.executeInFrame({
        frame: 0,
        script: ''
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });
  });

  describe('Network Monitoring Tools', () => {
    it('should validate start_network_capture parameters', async () => {
      const result = await tools.network.startNetworkCapture({
        captureTypes: []
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate capture types', async () => {
      const result = await tools.network.startNetworkCapture({
        captureTypes: ['invalid-type']
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate stop_network_capture captureId', async () => {
      const result = await tools.network.stopNetworkCapture({
        captureId: ''
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate block_requests patterns', async () => {
      const result = await tools.network.blockRequests({
        patterns: [],
        action: 'block'
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });
  });

  describe('Performance Profiling Tools', () => {
    it('should handle get_performance_metrics without session', async () => {
      const result = await tools.performance.getPerformanceMetrics({});

      expect(result.status).toBe('error'); // No session
    });

    it('should validate profile_page_load URL', async () => {
      const result = await tools.performance.profilePageLoad({
        url: 'invalid-url'
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate analyze_render_performance duration', async () => {
      const result = await tools.performance.analyzeRenderPerformance({
        duration: 500 // Too short
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });
  });
});