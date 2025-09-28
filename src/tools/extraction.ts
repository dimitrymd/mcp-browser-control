import { SessionManager } from '../drivers/session.js';
import {
  GetPageContentParams,
  GetPageContentResult,
  GetElementTextParams,
  GetElementTextResult,
  GetElementAttributeParams,
  GetElementAttributeResult,
  TakeScreenshotParams,
  TakeScreenshotResult,
  GetElementPropertiesParams,
  GetElementPropertiesResult,
  MCPToolResult
} from '../types/index.js';
import { findElementWithRetry, findElementsWithRetry, getElementInfo } from '../utils/elements.js';
import { htmlToText, htmlToMarkdown, cleanText } from '../utils/converters.js';
import { ValidationError, createErrorResponse } from '../utils/errors.js';
import { normalizeSelector } from '../utils/selectors.js';
import winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

export class ExtractionTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async getPageContent(params: unknown, sessionId?: string): Promise<MCPToolResult<GetPageContentResult>> {
    this.logger.info('Executing get_page_content tool', { params, sessionId });

    try {
      const { format, selector, includeHidden = false } = this.validateGetPageContentParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      let rawContent: string;

      if (selector) {
        const element = await findElementWithRetry(session.driver, selector, 3, this.logger);
        rawContent = await element.getAttribute('outerHTML');
      } else {
        rawContent = await session.driver.getPageSource();
      }

      let content: string;
      switch (format) {
        case 'html':
          content = rawContent;
          break;
        case 'text':
          content = htmlToText(rawContent);
          break;
        case 'markdown':
          content = htmlToMarkdown(rawContent);
          break;
        default:
          throw new ValidationError('Invalid format', 'format', format);
      }

      const url = await session.driver.getCurrentUrl();
      const title = await session.driver.getTitle();

      // Generate filename and save to browser-control subdirectory
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const hostname = new URL(url).hostname.replace(/[^a-zA-Z0-9-]/g, '-');
      const filename = `page-${hostname}-${timestamp}.${format === 'html' ? 'html' : format === 'markdown' ? 'md' : 'txt'}`;
      const browserControlDir = path.join(process.cwd(), 'browser-control');
      const pagecacheDir = path.join(browserControlDir, 'pagecache');
      const filePath = path.join(pagecacheDir, filename);

      // Ensure pagecache directory exists
      if (!fs.existsSync(pagecacheDir)) {
        fs.mkdirSync(pagecacheDir, { recursive: true });
      }

      // Save page content to file
      fs.writeFileSync(filePath, cleanText(content), 'utf8');

      this.logger.info(`Page content saved to: ${filePath}`);

      return {
        status: 'success',
        data: {
          content: `Page content saved to ${filePath}`,
          path: filePath,
          metadata: { title, url, length: content.length }
        }
      };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Page content extraction failed'));
    }
  }

  async getElementText(params: unknown, sessionId?: string): Promise<MCPToolResult<GetElementTextResult>> {
    this.logger.info('Executing get_element_text tool', { params, sessionId });

    try {
      const { selector, all = false, trim = true } = this.validateGetElementTextParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      if (all) {
        const elements = await findElementsWithRetry(session.driver, selector, 3, this.logger);
        const texts = await Promise.all(elements.map(async el => {
          const text = await el.getText();
          return trim ? text.trim() : text;
        }));
        return {
          status: 'success',
          data: { text: texts, count: texts.length }
        };
      } else {
        const element = await findElementWithRetry(session.driver, selector, 3, this.logger);
        const text = await element.getText();
        return {
          status: 'success',
          data: { text: trim ? text.trim() : text, count: 1 }
        };
      }
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Element text extraction failed'));
    }
  }

  async getElementAttribute(params: unknown, sessionId?: string): Promise<MCPToolResult<GetElementAttributeResult>> {
    this.logger.info('Executing get_element_attribute tool', { params, sessionId });

    try {
      const { selector, attribute, all = false } = this.validateGetElementAttributeParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      if (all) {
        const elements = await findElementsWithRetry(session.driver, selector, 3, this.logger);
        const values = await Promise.all(elements.map(el => el.getAttribute(attribute)));
        return {
          status: 'success',
          data: { value: values, elements: values.length }
        };
      } else {
        const element = await findElementWithRetry(session.driver, selector, 3, this.logger);
        const value = await element.getAttribute(attribute);
        return {
          status: 'success',
          data: { value, elements: 1 }
        };
      }
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Element attribute extraction failed'));
    }
  }

  async takeScreenshot(params: unknown, sessionId?: string): Promise<MCPToolResult<TakeScreenshotResult>> {
    this.logger.info('Executing take_screenshot tool', { params, sessionId });

    try {
      const { fullPage = false, selector, format = 'png', quality, path: customPath } = this.validateTakeScreenshotParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      let screenshot: string;
      let dimensions = { width: 0, height: 0 };

      if (selector) {
        const element = await findElementWithRetry(session.driver, selector, 3, this.logger);
        screenshot = await element.takeScreenshot();
        const rect = await element.getRect();
        dimensions = { width: rect.width, height: rect.height };
      } else {
        screenshot = await session.driver.takeScreenshot();
        const size = await session.driver.manage().window().getSize();
        dimensions = size;
      }

      // Generate filename and save to browser-control subdirectory
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = customPath || `screenshot-${timestamp}.${format === 'base64' ? 'png' : format}`;
      const browserControlDir = path.join(process.cwd(), 'browser-control');
      const screenshotsDir = path.join(browserControlDir, 'screenshots');
      const filePath = path.join(screenshotsDir, filename);

      // Ensure screenshots directory exists
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }

      // Save screenshot to file
      if (format === 'base64') {
        // For base64 format, we still save as PNG but return base64 data
        fs.writeFileSync(filePath, screenshot, 'base64');
      } else {
        // For png/jpeg formats, save the base64 data as binary
        fs.writeFileSync(filePath, screenshot, 'base64');
      }

      this.logger.info(`Screenshot saved to: ${filePath}`);

      return {
        status: 'success',
        data: {
          data: format === 'base64' ? screenshot : `Screenshot saved to ${filePath}`,
          path: filePath,
          dimensions
        }
      };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Screenshot failed'));
    }
  }

  async getElementProperties(params: unknown, sessionId?: string): Promise<MCPToolResult<GetElementPropertiesResult>> {
    this.logger.info('Executing get_element_properties tool', { params, sessionId });

    try {
      const { selector, properties } = this.validateGetElementPropertiesParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      const element = await findElementWithRetry(session.driver, selector, 3, this.logger);

      const cssProperties: Record<string, string> = {};
      for (const prop of properties) {
        const value = await element.getCssValue(prop);
        cssProperties[prop] = value;
      }

      return {
        status: 'success',
        data: { properties: cssProperties, computed: true }
      };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Element properties extraction failed'));
    }
  }

  private async getDefaultSession(): Promise<string> {
    // Get first available session
    const sessions = this.sessionManager.listSessions();
    if (sessions.length > 0) {
      return sessions[0].id;
    }
    throw new Error('No session ID provided and no active sessions available. Create a session first.');
  }

  // Validation methods
  private validateGetPageContentParams(params: unknown): GetPageContentParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }
    const p = params as any;
    const validFormats = ['html', 'text', 'markdown'];
    if (!validFormats.includes(p.format)) {
      throw new ValidationError(`Format must be one of: ${validFormats.join(', ')}`, 'format', p.format);
    }
    return {
      format: p.format,
      selector: p.selector ? normalizeSelector(p.selector) : undefined,
      includeHidden: p.includeHidden
    };
  }

  private validateGetElementTextParams(params: unknown): GetElementTextParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }
    const p = params as any;
    if (!p.selector || typeof p.selector !== 'string') {
      throw new ValidationError('selector is required and must be a string', 'selector', p.selector);
    }
    return {
      selector: normalizeSelector(p.selector),
      all: p.all,
      trim: p.trim
    };
  }

  private validateGetElementAttributeParams(params: unknown): GetElementAttributeParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }
    const p = params as any;
    if (!p.selector || typeof p.selector !== 'string') {
      throw new ValidationError('selector is required and must be a string', 'selector', p.selector);
    }
    if (!p.attribute || typeof p.attribute !== 'string') {
      throw new ValidationError('attribute is required and must be a string', 'attribute', p.attribute);
    }
    return { selector: normalizeSelector(p.selector), attribute: p.attribute, all: p.all };
  }

  private validateTakeScreenshotParams(params: unknown): TakeScreenshotParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }
    const p = params as any;
    const validFormats = ['png', 'jpeg', 'base64'];
    if (p.format && !validFormats.includes(p.format)) {
      throw new ValidationError(`Format must be one of: ${validFormats.join(', ')}`, 'format', p.format);
    }
    return {
      fullPage: p.fullPage,
      selector: p.selector ? normalizeSelector(p.selector) : undefined,
      format: p.format,
      quality: p.quality,
      path: p.path
    };
  }

  private validateGetElementPropertiesParams(params: unknown): GetElementPropertiesParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }
    const p = params as any;
    if (!p.selector || typeof p.selector !== 'string') {
      throw new ValidationError('selector is required and must be a string', 'selector', p.selector);
    }
    if (!Array.isArray(p.properties)) {
      throw new ValidationError('properties must be an array of strings', 'properties', p.properties);
    }
    return { selector: normalizeSelector(p.selector), properties: p.properties };
  }
}