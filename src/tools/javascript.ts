import { WebDriver } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import {
  ExecuteJavaScriptParams,
  ExecuteJavaScriptResult,
  InjectScriptParams,
  InjectScriptResult,
  EvaluateExpressionParams,
  EvaluateExpressionResult,
  MCPToolResult
} from '../types/index.js';
import {
  sanitizeScript,
  wrapInIIFE,
  createAsyncWrapper,
  createScriptElement,
  executeWithConsoleCapture,
  validateJavaScriptCode
} from '../utils/injection.js';
import { ValidationError, createErrorResponse } from '../utils/errors.js';
import winston from 'winston';

export class JavaScriptTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async executeJavaScript(params: unknown, sessionId?: string): Promise<MCPToolResult<ExecuteJavaScriptResult>> {
    const startTime = Date.now();
    this.logger.info('Executing execute_javascript tool', { params, sessionId });

    try {
      const validatedParams = this.validateExecuteJavaScriptParams(params);
      const {
        script,
        args = [],
        async: isAsync = false,
        timeout = 30000,
        context = 'page'
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Executing JavaScript', {
        scriptLength: script.length,
        argsCount: args.length,
        isAsync,
        timeout,
        context,
        sessionId: actualSessionId
      });

      // Validate script safety
      const validation = validateJavaScriptCode(script);
      if (!validation.isValid) {
        throw new ValidationError(
          `JavaScript validation failed: ${validation.issues.join(', ')}`,
          'script',
          script
        );
      }

      let executionResult: any;

      if (context === 'isolated') {
        // Execute in isolated context (IIFE wrapper)
        const wrappedScript = isAsync ? createAsyncWrapper(script) : wrapInIIFE(script);
        executionResult = await executeWithConsoleCapture(session.driver, wrappedScript, this.logger);
      } else {
        // Execute in page context
        if (isAsync) {
          executionResult = await session.driver.executeAsyncScript(`
            const script = arguments[0];
            const scriptArgs = arguments[1];
            const callback = arguments[arguments.length - 1];

            // Set up console capture
            const consoleLogs = [];
            const errors = [];
            const originalConsole = {
              log: console.log,
              error: console.error,
              warn: console.warn,
              info: console.info
            };

            console.log = function(...args) {
              consoleLogs.push({type: 'log', message: args.join(' ')});
              originalConsole.log.apply(console, args);
            };
            console.error = function(...args) {
              consoleLogs.push({type: 'error', message: args.join(' ')});
              originalConsole.error.apply(console, args);
            };
            console.warn = function(...args) {
              consoleLogs.push({type: 'warn', message: args.join(' ')});
              originalConsole.warn.apply(console, args);
            };
            console.info = function(...args) {
              consoleLogs.push({type: 'info', message: args.join(' ')});
              originalConsole.info.apply(console, args);
            };

            (async function() {
              try {
                const result = await eval('(async function(...args) { ' + script + ' })(...scriptArgs)');

                // Restore console
                console.log = originalConsole.log;
                console.error = originalConsole.error;
                console.warn = originalConsole.warn;
                console.info = originalConsole.info;

                callback({
                  result: result,
                  console: consoleLogs,
                  errors: errors
                });
              } catch (error) {
                errors.push({
                  message: error.message,
                  stack: error.stack || ''
                });

                // Restore console
                console.log = originalConsole.log;
                console.error = originalConsole.error;
                console.warn = originalConsole.warn;
                console.info = originalConsole.info;

                callback({
                  result: null,
                  console: consoleLogs,
                  errors: errors
                });
              }
            })();
          `, script, args);
        } else {
          executionResult = await executeWithConsoleCapture(session.driver,
            `(function(...args) { ${script} })(${args.map(arg => JSON.stringify(arg)).join(', ')})`,
            this.logger
          );
        }
      }

      const result: ExecuteJavaScriptResult = {
        result: executionResult.result,
        console: executionResult.console || [],
        errors: executionResult.errors || [],
        executionTime: Date.now() - startTime
      };

      this.logger.info('JavaScript execution completed', {
        executionTime: result.executionTime,
        hasResult: result.result !== null && result.result !== undefined,
        consoleEntriesCount: result.console.length,
        errorsCount: result.errors.length,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'executeJavaScript', undefined, result.errors.length === 0, result.executionTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('JavaScript execution failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'executeJavaScript', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('JavaScript execution failed'));
    }
  }

  async injectScript(params: unknown, sessionId?: string): Promise<MCPToolResult<InjectScriptResult>> {
    const startTime = Date.now();
    this.logger.info('Executing inject_script tool', { params, sessionId });

    try {
      const validatedParams = this.validateInjectScriptParams(params);
      const { url, code, type = 'text/javascript', defer = false, async = false, id } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Injecting script', {
        hasUrl: !!url,
        hasCode: !!code,
        type,
        defer,
        async,
        id,
        sessionId: actualSessionId
      });

      // Validate that either URL or code is provided
      if (!url && !code) {
        throw new ValidationError('Must provide either url or code for script injection', 'script_source', { url, code });
      }

      // If code is provided, validate it
      if (code) {
        const validation = validateJavaScriptCode(code);
        if (!validation.isValid) {
          throw new ValidationError(
            `Script validation failed: ${validation.issues.join(', ')}`,
            'code',
            code
          );
        }
      }

      // Create script options object
      const scriptOptions: any = { type, defer, async };
      if (url) scriptOptions.url = url;
      if (code) scriptOptions.code = code;
      if (id) scriptOptions.id = id;

      // Create and inject the script
      const { scriptId, loadTime } = await createScriptElement(
        session.driver,
        scriptOptions,
        this.logger
      );

      const result: InjectScriptResult = {
        success: true,
        scriptId,
        loadTime
      };

      this.logger.info('Script injection completed', {
        scriptId,
        loadTime,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'injectScript', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Script injection failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'injectScript', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Script injection failed'));
    }
  }

  async evaluateExpression(params: unknown, sessionId?: string): Promise<MCPToolResult<EvaluateExpressionResult>> {
    const startTime = Date.now();
    this.logger.info('Executing evaluate_expression tool', { params, sessionId });

    try {
      const validatedParams = this.validateEvaluateExpressionParams(params);
      const { expression, returnType = 'primitive' } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Evaluating expression', {
        expression: expression.substring(0, 100) + (expression.length > 100 ? '...' : ''),
        returnType,
        sessionId: actualSessionId
      });

      // Validate expression safety
      const validation = validateJavaScriptCode(expression);
      if (!validation.isValid) {
        throw new ValidationError(
          `Expression validation failed: ${validation.issues.join(', ')}`,
          'expression',
          expression
        );
      }

      // Execute the expression
      const evaluationResult = await session.driver.executeScript(`
        const expression = arguments[0];
        const returnType = arguments[1];

        try {
          const result = eval(expression);

          return {
            value: result,
            type: typeof result,
            isNull: result === null,
            isUndefined: result === undefined,
            success: true
          };
        } catch (error) {
          return {
            value: null,
            type: 'error',
            isNull: false,
            isUndefined: false,
            success: false,
            error: error.message
          };
        }
      `, expression, returnType);

      const evalResult = evaluationResult as any;

      if (!evalResult.success) {
        throw new Error(evalResult.error || 'Expression evaluation failed');
      }

      // Format result based on return type
      let formattedValue = evalResult.value;
      if (returnType === 'json' && typeof evalResult.value === 'object') {
        try {
          formattedValue = JSON.stringify(evalResult.value, null, 2);
        } catch {
          formattedValue = '[Object object]';
        }
      } else if (returnType === 'element' && evalResult.value && evalResult.value.tagName) {
        formattedValue = {
          tagName: evalResult.value.tagName,
          id: evalResult.value.id,
          className: evalResult.value.className,
          textContent: evalResult.value.textContent?.substring(0, 100)
        };
      }

      const result: EvaluateExpressionResult = {
        value: formattedValue,
        type: evalResult.type,
        isNull: evalResult.isNull,
        isUndefined: evalResult.isUndefined
      };

      this.logger.info('Expression evaluation completed', {
        resultType: result.type,
        isNull: result.isNull,
        isUndefined: result.isUndefined,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'evaluateExpression', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Expression evaluation failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'evaluateExpression', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Expression evaluation failed'));
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

  // Validation methods

  private validateExecuteJavaScriptParams(params: unknown): ExecuteJavaScriptParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!p.script || typeof p.script !== 'string') {
      throw new ValidationError('script is required and must be a string', 'script', p.script);
    }

    if (p.args && !Array.isArray(p.args)) {
      throw new ValidationError('args must be an array', 'args', p.args);
    }

    if (p.timeout && (typeof p.timeout !== 'number' || p.timeout < 1000 || p.timeout > 300000)) {
      throw new ValidationError('timeout must be a number between 1000 and 300000 ms', 'timeout', p.timeout);
    }

    const validContexts = ['page', 'isolated'];
    if (p.context && !validContexts.includes(p.context)) {
      throw new ValidationError(
        `context must be one of: ${validContexts.join(', ')}`,
        'context',
        p.context
      );
    }

    return {
      script: p.script,
      args: p.args,
      async: p.async,
      timeout: p.timeout,
      context: p.context
    };
  }

  private validateInjectScriptParams(params: unknown): InjectScriptParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (p.url && typeof p.url !== 'string') {
      throw new ValidationError('url must be a string', 'url', p.url);
    }

    if (p.code && typeof p.code !== 'string') {
      throw new ValidationError('code must be a string', 'code', p.code);
    }

    if (!p.url && !p.code) {
      throw new ValidationError('Must provide either url or code', 'script_source', params);
    }

    const validTypes = ['module', 'text/javascript'];
    if (p.type && !validTypes.includes(p.type)) {
      throw new ValidationError(
        `type must be one of: ${validTypes.join(', ')}`,
        'type',
        p.type
      );
    }

    // Validate URL format if provided
    if (p.url) {
      try {
        new URL(p.url);
      } catch {
        throw new ValidationError('Invalid URL format', 'url', p.url);
      }
    }

    return {
      url: p.url,
      code: p.code,
      type: p.type,
      defer: p.defer,
      async: p.async,
      id: p.id
    };
  }

  private validateEvaluateExpressionParams(params: unknown): EvaluateExpressionParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!p.expression || typeof p.expression !== 'string') {
      throw new ValidationError('expression is required and must be a string', 'expression', p.expression);
    }

    const validReturnTypes = ['primitive', 'json', 'element'];
    if (p.returnType && !validReturnTypes.includes(p.returnType)) {
      throw new ValidationError(
        `returnType must be one of: ${validReturnTypes.join(', ')}`,
        'returnType',
        p.returnType
      );
    }

    return {
      expression: p.expression,
      returnType: p.returnType
    };
  }
}