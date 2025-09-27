import { WebDriver } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import { MCPToolResult } from '../types/index.js';
import { findElementWithRetry, scrollIntoView, getElementInfo, getElementCenter } from '../utils/elements.js';
import { ValidationError, ElementNotInteractableError, createErrorResponse } from '../utils/errors.js';
import { normalizeSelector } from '../utils/selectors.js';
import winston from 'winston';

export class InteractionTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async click(params: any, sessionId?: string): Promise<MCPToolResult> {
    const startTime = Date.now();
    try {
      const { selector, clickType = 'left' } = params;
      if (!selector) throw new ValidationError('selector is required', 'selector', selector);

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);
      const element = await findElementWithRetry(session.driver, selector, 3, this.logger);

      await scrollIntoView(session.driver, element, 'smooth', 'center', this.logger);

      // Check if element is clickable
      const isEnabled = await element.isEnabled();
      const isDisplayed = await element.isDisplayed();

      if (!isEnabled) {
        throw new ElementNotInteractableError(
          `Element with selector '${selector}' is disabled and cannot be clicked`
        );
      }

      if (!isDisplayed) {
        throw new ElementNotInteractableError(
          `Element with selector '${selector}' is not visible and cannot be clicked`
        );
      }

      switch (clickType) {
        case 'right':
          await session.driver.actions().contextClick(element).perform();
          break;
        case 'double':
          await session.driver.actions().doubleClick(element).perform();
          break;
        case 'middle':
          await session.driver.actions().click(element).perform();
          break;
        case 'left':
        default:
          await element.click();
          break;
      }

      const elementInfo = await getElementInfo(element);
      const coordinates = await getElementCenter(element);

      // Track successful action
      this.sessionManager.trackAction(actualSessionId, 'click', selector, true, Date.now() - startTime);
      this.sessionManager.setActiveElement(actualSessionId, selector);

      return {
        status: 'success',
        data: {
          success: true,
          element: { tag: elementInfo.tag, text: elementInfo.text, attributes: elementInfo.attributes },
          coordinates
        }
      };
    } catch (error) {
      // Track failed action
      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'click', (params as any)?.selector, false, Date.now() - startTime);
      }
      return createErrorResponse(error instanceof Error ? error : new Error('Click failed'));
    }
  }

  async typeText(params: any, sessionId?: string): Promise<MCPToolResult> {
    const startTime = Date.now();
    try {
      const { selector, text, clear = false, delay = 0 } = params;
      if (!selector || typeof text !== 'string') {
        throw new ValidationError('selector and text are required', 'params', params);
      }

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);
      const element = await findElementWithRetry(session.driver, selector, 3, this.logger);

      // Check if element can receive text input
      const tagName = await element.getTagName();
      const lowerTagName = tagName.toLowerCase();

      if (!['input', 'textarea', 'select'].includes(lowerTagName)) {
        throw new ElementNotInteractableError(
          `Element with selector '${selector}' (${tagName}) cannot receive text input`
        );
      }

      if (clear) await element.clear();

      // Type with optional delay
      if (delay > 0) {
        for (const char of text) {
          await element.sendKeys(char);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        await element.sendKeys(text);
      }

      const finalValue = await element.getAttribute('value') || await element.getText();

      // Track successful action
      this.sessionManager.trackAction(actualSessionId, 'typeText', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: { success: true, finalValue }
      };
    } catch (error) {
      // Track failed action
      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'typeText', (params as any)?.selector, false, Date.now() - startTime);
      }
      return createErrorResponse(error instanceof Error ? error : new Error('Type text failed'));
    }
  }

  async hover(params: any, sessionId?: string): Promise<MCPToolResult> {
    const startTime = Date.now();
    try {
      const { selector, duration = 1000, offset } = params;
      if (!selector) throw new ValidationError('selector is required', 'selector', selector);

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);
      const element = await findElementWithRetry(session.driver, selector, 3, this.logger);

      // Perform hover with optional offset
      if (offset) {
        await session.driver.actions().move({ origin: element, x: offset.x, y: offset.y }).perform();
      } else {
        await session.driver.actions().move({ origin: element }).perform();
      }

      await new Promise(resolve => setTimeout(resolve, duration));

      const elementInfo = await getElementInfo(element);

      // Track successful action
      this.sessionManager.trackAction(actualSessionId, 'hover', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: {
          success: true,
          element: { tag: elementInfo.tag, text: elementInfo.text }
        }
      };
    } catch (error) {
      // Track failed action
      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'hover', (params as any)?.selector, false, Date.now() - startTime);
      }
      return createErrorResponse(error instanceof Error ? error : new Error('Hover failed'));
    }
  }

  async selectDropdown(params: any, sessionId?: string): Promise<MCPToolResult> {
    const startTime = Date.now();
    try {
      const { selector, value, text, index } = params;
      if (!selector) throw new ValidationError('selector is required', 'selector', selector);

      // Validate that at least one selection criterion is provided
      if (value === undefined && text === undefined && index === undefined) {
        throw new ValidationError('Must provide one of: value, text, or index for dropdown selection', 'selection_criteria', params);
      }

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);
      const element = await findElementWithRetry(session.driver, selector, 3, this.logger);

      const tagName = await element.getTagName();
      if (tagName.toLowerCase() !== 'select') {
        throw new ElementNotInteractableError(`Element is not a select (found: ${tagName})`);
      }

      let selectedOption: { value: string; text: string; index: number } = { value: '', text: '', index: -1 };

      if (typeof index === 'number') {
        const options = await element.findElements({ tagName: 'option' });
        if (options[index]) {
          await options[index].click();
          const optionValue = await options[index].getAttribute('value') || '';
          const optionText = await options[index].getText();
          selectedOption = { value: optionValue, text: optionText, index };
        } else {
          throw new ElementNotInteractableError(`Option at index ${index} not found`);
        }
      } else if (value) {
        const option = await element.findElement({ css: `option[value="${value}"]` });
        await option.click();
        const optionText = await option.getText();
        const options = await element.findElements({ tagName: 'option' });
        let optionIndex = -1;
        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          if (option) {
            const optValue = await option.getAttribute('value');
            if (optValue === value) {
              optionIndex = i;
              break;
            }
          }
        }
        selectedOption = { value, text: optionText, index: optionIndex };
      } else if (text) {
        const options = await element.findElements({ tagName: 'option' });
        let found = false;
        let optionIndex = -1;
        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          if (option) {
            const optionText = await option.getText();
            if (optionText === text) {
              await option.click();
              const optionValue = await option.getAttribute('value') || '';
              selectedOption = { value: optionValue, text, index: i };
              found = true;
              break;
            }
          }
        }
        if (!found) {
          throw new ElementNotInteractableError(`Option with text "${text}" not found`);
        }
      } else {
        throw new ValidationError('Must provide one of: value, text, or index', 'selection', params);
      }

      // Track successful action
      this.sessionManager.trackAction(actualSessionId, 'selectDropdown', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: {
          success: true,
          selectedOption
        }
      };
    } catch (error) {
      // Track failed action
      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'selectDropdown', (params as any)?.selector, false, Date.now() - startTime);
      }
      return createErrorResponse(error instanceof Error ? error : new Error('Select dropdown failed'));
    }
  }

  async scrollTo(params: any, sessionId?: string): Promise<MCPToolResult> {
    const startTime = Date.now();
    try {
      const { selector, x, y, behavior = 'smooth' } = params;

      // Validate that either selector or coordinates are provided
      if (!selector && x === undefined && y === undefined) {
        throw new ValidationError('Must provide either selector or coordinates (x, y) for scrolling', 'scroll_target', params);
      }

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      let scrollPosition: { x: number; y: number };

      if (selector) {
        const element = await findElementWithRetry(session.driver, selector, 3, this.logger);
        await scrollIntoView(session.driver, element, behavior, 'center', this.logger);

        // Get final scroll position
        scrollPosition = await session.driver.executeScript(`
          return { x: window.pageXOffset || document.documentElement.scrollLeft, y: window.pageYOffset || document.documentElement.scrollTop };
        `) as { x: number; y: number };
      } else {
        const finalX = x || 0;
        const finalY = y || 0;

        await session.driver.executeScript(`
          window.scrollTo({ left: ${finalX}, top: ${finalY}, behavior: '${behavior}' });
        `);

        // Wait for scrolling to complete
        await new Promise(resolve => setTimeout(resolve, behavior === 'smooth' ? 500 : 100));

        scrollPosition = { x: finalX, y: finalY };
      }

      // Update session scroll position
      this.sessionManager.updateScrollPosition(actualSessionId, scrollPosition.x, scrollPosition.y);

      // Track successful action
      this.sessionManager.trackAction(actualSessionId, 'scrollTo', selector || `${x},${y}`, true, Date.now() - startTime);

      return {
        status: 'success',
        data: { success: true, scrollPosition }
      };
    } catch (error) {
      // Track failed action
      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'scrollTo', 'unknown', false, Date.now() - startTime);
      }
      return createErrorResponse(error instanceof Error ? error : new Error('Scroll failed'));
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
}