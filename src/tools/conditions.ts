import { SessionManager } from '../drivers/session.js';
import {
  WaitForElementParams,
  WaitForElementResult,
  WaitForTextParams,
  WaitForTextResult,
  ElementExistsParams,
  ElementExistsResult,
  MCPToolResult
} from '../types/index.js';
import { waitForElement, findElementsWithRetry, isElementVisible } from '../utils/elements.js';
import { ValidationError, createErrorResponse } from '../utils/errors.js';
import { normalizeSelector } from '../utils/selectors.js';
import winston from 'winston';

export class ConditionTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async waitForElement(params: unknown, sessionId?: string): Promise<MCPToolResult<WaitForElementResult>> {
    const startTime = Date.now();
    this.logger.info('Executing wait_for_element tool', { params, sessionId });

    try {
      const { selector, condition, timeout = 10000 } = this.validateWaitForElementParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      await waitForElement(session.driver, selector, condition, timeout, this.logger);
      const waitTime = Date.now() - startTime;

      return {
        status: 'success',
        data: { success: true, waitTime }
      };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Wait for element failed'));
    }
  }

  async waitForText(params: unknown, sessionId?: string): Promise<MCPToolResult<WaitForTextResult>> {
    const startTime = Date.now();
    this.logger.info('Executing wait_for_text tool', { params, sessionId });

    try {
      const { text, selector, exact = false, timeout = 10000 } = this.validateWaitForTextParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      const foundElement = await session.driver.wait(async () => {
        try {
          const searchSelector = selector || 'body';
          const elements = await findElementsWithRetry(session.driver, searchSelector, 1, this.logger);

          for (const element of elements) {
            const elementText = await element.getText();
            const matches = exact ? elementText === text : elementText.includes(text);

            if (matches) {
              const tag = await element.getTagName();
              return { selector: searchSelector, tag };
            }
          }
          return null;
        } catch {
          return null;
        }
      }, timeout);

      if (!foundElement) {
        throw new Error(`Text "${text}" not found within timeout`);
      }

      return {
        status: 'success',
        data: { success: true, element: foundElement }
      };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Wait for text failed'));
    }
  }

  async elementExists(params: unknown, sessionId?: string): Promise<MCPToolResult<ElementExistsResult>> {
    this.logger.info('Executing element_exists tool', { params, sessionId });

    try {
      const { selector, visible = false } = this.validateElementExistsParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      const elements = await findElementsWithRetry(session.driver, selector, 1, this.logger);
      const count = elements.length;

      let visibleCount = 0;
      if (visible && count > 0) {
        for (const element of elements) {
          if (await isElementVisible(element)) {
            visibleCount++;
          }
        }
      }

      const exists = visible ? visibleCount > 0 : count > 0;

      return {
        status: 'success',
        data: { exists, count, visible: visibleCount }
      };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Element exists check failed'));
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
  private validateWaitForElementParams(params: unknown): WaitForElementParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }
    const p = params as any;
    if (!p.selector || typeof p.selector !== 'string') {
      throw new ValidationError('selector is required and must be a string', 'selector', p.selector);
    }
    const validConditions = ['present', 'visible', 'clickable', 'hidden', 'removed'];
    if (!validConditions.includes(p.condition)) {
      throw new ValidationError(`condition must be one of: ${validConditions.join(', ')}`, 'condition', p.condition);
    }
    return {
      selector: normalizeSelector(p.selector),
      condition: p.condition,
      timeout: p.timeout
    };
  }

  private validateWaitForTextParams(params: unknown): WaitForTextParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }
    const p = params as any;
    if (!p.text || typeof p.text !== 'string') {
      throw new ValidationError('text is required and must be a string', 'text', p.text);
    }
    return {
      text: p.text,
      selector: p.selector ? normalizeSelector(p.selector) : undefined,
      exact: p.exact,
      timeout: p.timeout
    };
  }

  private validateElementExistsParams(params: unknown): ElementExistsParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }
    const p = params as any;
    if (!p.selector || typeof p.selector !== 'string') {
      throw new ValidationError('selector is required and must be a string', 'selector', p.selector);
    }
    return {
      selector: normalizeSelector(p.selector),
      visible: p.visible
    };
  }
}