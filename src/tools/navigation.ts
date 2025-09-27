import { until } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import { NavigationResult, MCPToolResult, NavigateToParams, RefreshParams, WaitCondition } from '../types/index.js';
import { NavigationError, TimeoutError, SessionError } from '../utils/errors.js';
import { validateNavigateToParams, validateRefreshParams, validateUrlSafety } from '../utils/validation.js';
import { createErrorResponse } from '../utils/errors.js';
import winston from 'winston';

export class NavigationTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async navigateTo(params: unknown, sessionId?: string): Promise<MCPToolResult<NavigationResult>> {
    const startTime = Date.now();
    this.logger.info('Executing navigate_to tool', { params, sessionId });

    try {
      // Validate parameters
      const validatedParams = validateNavigateToParams(params);
      const { url, waitUntil, timeout } = validatedParams;

      // Additional URL safety validation
      validateUrlSafety(url);

      // Get or create session
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      // Perform navigation
      this.logger.debug('Starting navigation', { url, waitUntil, timeout, sessionId: actualSessionId });

      await session.driver.get(url);

      // Wait for specified condition
      await this.waitForCondition(session.driver, waitUntil || 'load', timeout || 30000);

      // Get final state
      const finalUrl = await session.driver.getCurrentUrl();
      const title = await session.driver.getTitle();
      const loadTime = Date.now() - startTime;

      // Update session info
      session.url = finalUrl;
      session.title = title;
      session.lastUsed = Date.now();

      const result: NavigationResult = {
        success: true,
        url: finalUrl,
        title,
        loadTime
      };

      this.logger.info('Navigation completed successfully', {
        ...result,
        sessionId: actualSessionId
      });

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Navigation failed', { params, sessionId, error, duration: Date.now() - startTime });
      return createErrorResponse(error instanceof Error ? error : new Error('Unknown navigation error'));
    }
  }

  async goBack(sessionId?: string): Promise<MCPToolResult<NavigationResult>> {
    const startTime = Date.now();
    this.logger.info('Executing go_back tool', { sessionId });

    try {
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      // Execute back navigation
      await session.driver.navigate().back();

      // Wait for navigation to complete
      await this.waitForNavigationComplete(session.driver);

      // Get new state
      const url = await session.driver.getCurrentUrl();
      const title = await session.driver.getTitle();

      // Update session info
      session.url = url;
      session.title = title;
      session.lastUsed = Date.now();

      const result: NavigationResult = {
        success: true,
        url,
        title,
        loadTime: Date.now() - startTime
      };

      this.logger.info('Back navigation completed', { ...result, sessionId: actualSessionId });

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Back navigation failed', { sessionId, error });
      return createErrorResponse(error instanceof Error ? error : new Error('Back navigation failed'));
    }
  }

  async goForward(sessionId?: string): Promise<MCPToolResult<NavigationResult>> {
    const startTime = Date.now();
    this.logger.info('Executing go_forward tool', { sessionId });

    try {
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      // Execute forward navigation
      await session.driver.navigate().forward();

      // Wait for navigation to complete
      await this.waitForNavigationComplete(session.driver);

      // Get new state
      const url = await session.driver.getCurrentUrl();
      const title = await session.driver.getTitle();

      // Update session info
      session.url = url;
      session.title = title;
      session.lastUsed = Date.now();

      const result: NavigationResult = {
        success: true,
        url,
        title,
        loadTime: Date.now() - startTime
      };

      this.logger.info('Forward navigation completed', { ...result, sessionId: actualSessionId });

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Forward navigation failed', { sessionId, error });
      return createErrorResponse(error instanceof Error ? error : new Error('Forward navigation failed'));
    }
  }

  async refresh(params: unknown = {}, sessionId?: string): Promise<MCPToolResult<NavigationResult>> {
    const startTime = Date.now();
    this.logger.info('Executing refresh tool', { params, sessionId });

    try {
      // Validate parameters
      const validatedParams = validateRefreshParams(params);
      const { hard } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      // Perform refresh
      if (hard) {
        // Hard refresh - bypass cache
        await session.driver.executeScript('location.reload(true);');
      } else {
        // Normal refresh
        await session.driver.navigate().refresh();
      }

      // Wait for page to load
      await this.waitForNavigationComplete(session.driver);

      // Get new state
      const url = await session.driver.getCurrentUrl();
      const title = await session.driver.getTitle();

      // Update session info
      session.url = url;
      session.title = title;
      session.lastUsed = Date.now();

      const result: NavigationResult = {
        success: true,
        url,
        title,
        loadTime: Date.now() - startTime
      };

      this.logger.info('Page refresh completed', { ...result, hard, sessionId: actualSessionId });

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Page refresh failed', { params, sessionId, error });
      return createErrorResponse(error instanceof Error ? error : new Error('Page refresh failed'));
    }
  }

  async getCurrentUrl(sessionId?: string): Promise<MCPToolResult<{ url: string; title: string }>> {
    this.logger.info('Executing get_current_url tool', { sessionId });

    try {
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      const url = await session.driver.getCurrentUrl();
      const title = await session.driver.getTitle();

      // Update session info
      session.url = url;
      session.title = title;
      session.lastUsed = Date.now();

      const result = { url, title };

      this.logger.info('Retrieved current URL', { ...result, sessionId: actualSessionId });

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Failed to get current URL', { sessionId, error });
      return createErrorResponse(error instanceof Error ? error : new Error('Failed to get current URL'));
    }
  }

  // Helper methods

  private async waitForCondition(driver: any, condition: WaitCondition, timeout: number): Promise<void> {
    try {
      switch (condition) {
        case 'load':
          await driver.wait(until.titleContains(''), timeout);
          await driver.executeScript('return document.readyState').then((readyState: string) => {
            if (readyState !== 'complete') {
              return driver.wait(() => {
                return driver.executeScript('return document.readyState').then((state: string) => state === 'complete');
              }, timeout);
            }
          });
          break;
        case 'domcontentloaded':
          await driver.wait(() => {
            return driver.executeScript(`
              return document.readyState === 'interactive' || document.readyState === 'complete';
            `);
          }, timeout);
          break;
        default:
          throw new NavigationError(`Unsupported wait condition: ${condition}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new TimeoutError(
          `Navigation timeout after ${timeout}ms waiting for '${condition}' condition`,
          error
        );
      }
      throw error;
    }
  }

  private async waitForNavigationComplete(driver: any, timeout: number = 30000): Promise<void> {
    try {
      await driver.wait(() => {
        return driver.executeScript('return document.readyState').then((state: string) => state === 'complete');
      }, timeout);
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new TimeoutError(
          `Navigation timeout after ${timeout}ms waiting for page to complete loading`,
          error
        );
      }
      throw error;
    }
  }

  private async getDefaultSession(): Promise<string> {
    // For now, we'll require explicit session management
    // In a real implementation, you might want to create a default session
    throw new SessionError(
      'No session ID provided and no default session available. Create a session first using the session management tools.'
    );
  }

  // Utility method to check if a URL is safe to navigate to
  private async validateNavigationTarget(url: string): Promise<void> {
    try {
      const parsedUrl = new URL(url);

      // Check for dangerous protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new NavigationError(`Unsafe protocol: ${parsedUrl.protocol}. Only HTTP and HTTPS are allowed.`);
      }

      // Additional checks can be added here
      // - Domain whitelist/blacklist
      // - Content-type validation
      // - Rate limiting per domain

    } catch (error) {
      if (error instanceof NavigationError) {
        throw error;
      }
      throw new NavigationError(
        `Invalid navigation target: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Method to handle retries for transient navigation failures
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Only retry on certain types of errors
        if (this.isRetryableError(lastError) && attempt < maxRetries) {
          this.logger.warn(`Operation failed, retrying (${attempt}/${maxRetries})`, {
            error: lastError.message,
            nextAttemptIn: delayMs
          });
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff
          continue;
        }

        throw lastError;
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      'stale element reference',
      'element not interactable',
      'target window already closed',
      'no such window',
      'timeout'
    ];

    return retryablePatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern)
    );
  }
}