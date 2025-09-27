import { WebDriver, Alert } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import {
  HandleAlertParams,
  HandleAlertResult,
  SetDialogHandlerParams,
  SetDialogHandlerResult,
  MCPToolResult
} from '../types/index.js';
import { ValidationError, createErrorResponse, TimeoutError } from '../utils/errors.js';
import winston from 'winston';

export class DialogTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async handleAlert(params: unknown, sessionId?: string): Promise<MCPToolResult<HandleAlertResult>> {
    const startTime = Date.now();
    this.logger.info('Executing handle_alert tool', { params, sessionId });

    try {
      const validatedParams = this.validateHandleAlertParams(params);
      const { action, text, timeout = 10000 } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Handling alert dialog', {
        action,
        hasText: !!text,
        timeout,
        sessionId: actualSessionId
      });

      let alert: Alert;
      let alertText = '';
      let alertType: 'alert' | 'confirm' | 'prompt' = 'alert';

      // Wait for alert to appear
      try {
        const alertResult = await session.driver.wait(async () => {
          try {
            return await session.driver.switchTo().alert();
          } catch {
            return null;
          }
        }, timeout);

        if (!alertResult) {
          throw new TimeoutError(`No alert dialog appeared within ${timeout}ms`);
        }

        alert = alertResult;

        // Get alert text
        alertText = await alert.getText();

        // Determine alert type based on the text and browser behavior
        alertType = this.detectAlertType(alertText);

      } catch (error) {
        if (error instanceof TimeoutError) {
          throw error;
        }
        throw new Error(`Failed to find alert dialog: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Perform the requested action
      let handled = false;

      switch (action) {
        case 'accept':
          await alert.accept();
          handled = true;
          break;

        case 'dismiss':
          await alert.dismiss();
          handled = true;
          break;

        case 'getText':
          // Already retrieved text above
          handled = true;
          break;

        case 'sendKeys':
          if (!text) {
            throw new ValidationError('text is required for sendKeys action', 'text', text);
          }
          if (alertType !== 'prompt') {
            throw new ValidationError('sendKeys action is only valid for prompt dialogs', 'alertType', alertType);
          }
          await alert.sendKeys(text);
          await alert.accept(); // Accept after sending keys
          handled = true;
          break;

        default:
          throw new ValidationError(`Invalid action: ${action}`, 'action', action);
      }

      const result: HandleAlertResult = {
        handled,
        alertText,
        alertType
      };

      this.logger.info('Alert handling completed', {
        action,
        alertType,
        alertText: alertText.substring(0, 100),
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'handleAlert', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Alert handling failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'handleAlert', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Alert handling failed'));
    }
  }

  async setDialogHandler(params: unknown, sessionId?: string): Promise<MCPToolResult<SetDialogHandlerResult>> {
    const startTime = Date.now();
    this.logger.info('Executing set_dialog_handler tool', { params, sessionId });

    try {
      const validatedParams = this.validateSetDialogHandlerParams(params);
      const { enabled, autoAccept = false, promptText, callback } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Setting dialog handler', {
        enabled,
        autoAccept,
        hasPromptText: !!promptText,
        hasCallback: !!callback,
        sessionId: actualSessionId
      });

      // Get previous handler state
      const previousHandler = await session.driver.executeScript(`
        return {
          hasHandler: typeof window.MCPDialogHandler !== 'undefined',
          settings: window.MCPDialogHandlerSettings || null
        };
      `);

      if (enabled) {
        // Install dialog handler
        await session.driver.executeScript(`
          const autoAccept = arguments[0];
          const promptText = arguments[1];
          const callback = arguments[2];

          // Store settings
          window.MCPDialogHandlerSettings = {
            autoAccept: autoAccept,
            promptText: promptText,
            callback: callback
          };

          // Override alert, confirm, and prompt
          window.MCPDialogHandler = {
            originalAlert: window.alert,
            originalConfirm: window.confirm,
            originalPrompt: window.prompt
          };

          window.alert = function(message) {
            console.log('MCP: Alert intercepted:', message);

            if (callback) {
              try {
                eval(callback + '("alert", message)');
              } catch (e) {
                console.error('Dialog callback error:', e);
              }
            }

            if (autoAccept) {
              return;
            } else {
              return window.MCPDialogHandler.originalAlert(message);
            }
          };

          window.confirm = function(message) {
            console.log('MCP: Confirm intercepted:', message);

            if (callback) {
              try {
                const result = eval(callback + '("confirm", message)');
                if (typeof result === 'boolean') return result;
              } catch (e) {
                console.error('Dialog callback error:', e);
              }
            }

            if (autoAccept) {
              return true;
            } else {
              return window.MCPDialogHandler.originalConfirm(message);
            }
          };

          window.prompt = function(message, defaultText) {
            console.log('MCP: Prompt intercepted:', message);

            if (callback) {
              try {
                const result = eval(callback + '("prompt", message, defaultText)');
                if (typeof result === 'string') return result;
              } catch (e) {
                console.error('Dialog callback error:', e);
              }
            }

            if (autoAccept) {
              return promptText || defaultText || '';
            } else {
              return window.MCPDialogHandler.originalPrompt(message, defaultText);
            }
          };
        `, autoAccept, promptText, callback);
      } else {
        // Disable dialog handler and restore original functions
        await session.driver.executeScript(`
          if (window.MCPDialogHandler) {
            window.alert = window.MCPDialogHandler.originalAlert;
            window.confirm = window.MCPDialogHandler.originalConfirm;
            window.prompt = window.MCPDialogHandler.originalPrompt;

            delete window.MCPDialogHandler;
            delete window.MCPDialogHandlerSettings;
          }
        `);
      }

      const result: SetDialogHandlerResult = {
        success: true,
        previousHandler: previousHandler as any
      };

      this.logger.info('Dialog handler setup completed', {
        enabled,
        autoAccept,
        hadPreviousHandler: (previousHandler as any)?.hasHandler,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'setDialogHandler', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Dialog handler setup failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'setDialogHandler', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Dialog handler setup failed'));
    }
  }

  // Private helper methods

  private async getDefaultSession(): Promise<string> {
    const sessions = this.sessionManager.listSessions();
    if (sessions.length > 0) {
      return sessions[0].id;
    }
    throw new Error('No session ID provided and no active sessions available. Create a session first.');
  }

  private detectAlertType(alertText: string): 'alert' | 'confirm' | 'prompt' {
    // Simple heuristics to detect alert type
    // In reality, this is difficult to determine just from text
    // This is a best-effort approach

    if (alertText.toLowerCase().includes('confirm') ||
        alertText.includes('?') ||
        alertText.toLowerCase().includes('yes') ||
        alertText.toLowerCase().includes('no')) {
      return 'confirm';
    }

    if (alertText.toLowerCase().includes('enter') ||
        alertText.toLowerCase().includes('input') ||
        alertText.toLowerCase().includes('type')) {
      return 'prompt';
    }

    return 'alert';
  }

  // Validation methods

  private validateHandleAlertParams(params: unknown): HandleAlertParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    const validActions = ['accept', 'dismiss', 'getText', 'sendKeys'];
    if (!p.action || !validActions.includes(p.action)) {
      throw new ValidationError(
        `action is required and must be one of: ${validActions.join(', ')}`,
        'action',
        p.action
      );
    }

    if (p.text && typeof p.text !== 'string') {
      throw new ValidationError('text must be a string', 'text', p.text);
    }

    if (p.timeout && (typeof p.timeout !== 'number' || p.timeout < 1000 || p.timeout > 60000)) {
      throw new ValidationError('timeout must be a number between 1000 and 60000 ms', 'timeout', p.timeout);
    }

    return {
      action: p.action,
      text: p.text,
      timeout: p.timeout
    };
  }

  private validateSetDialogHandlerParams(params: unknown): SetDialogHandlerParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (typeof p.enabled !== 'boolean') {
      throw new ValidationError('enabled is required and must be a boolean', 'enabled', p.enabled);
    }

    if (p.promptText && typeof p.promptText !== 'string') {
      throw new ValidationError('promptText must be a string', 'promptText', p.promptText);
    }

    if (p.callback && typeof p.callback !== 'string') {
      throw new ValidationError('callback must be a string', 'callback', p.callback);
    }

    // Validate callback JavaScript if provided
    if (p.callback) {
      try {
        new Function('type', 'message', 'defaultText', p.callback);
      } catch (error) {
        throw new ValidationError(
          `Invalid callback JavaScript: ${error instanceof Error ? error.message : 'Syntax error'}`,
          'callback',
          p.callback
        );
      }
    }

    return {
      enabled: p.enabled,
      autoAccept: p.autoAccept,
      promptText: p.promptText,
      callback: p.callback
    };
  }
}