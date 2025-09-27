import { WebDriver } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import {
  GetFramesResult,
  SwitchToFrameParams,
  SwitchToFrameResult,
  SwitchToParentFrameResult,
  ExecuteInFrameParams,
  ExecuteInFrameResult,
  FrameInfo,
  MCPToolResult
} from '../types/index.js';
import { ValidationError, createErrorResponse } from '../utils/errors.js';
import { normalizeSelector } from '../utils/selectors.js';
import winston from 'winston';

export class FrameTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async getFrames(params: unknown = {}, sessionId?: string): Promise<MCPToolResult<GetFramesResult>> {
    const startTime = Date.now();
    this.logger.info('Executing get_frames tool', { params, sessionId });

    try {
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Getting frame information', { sessionId: actualSessionId });

      // Extract frame information
      const frameData = await session.driver.executeScript(`
        const frames = [];
        let currentFrameContext = 'main';

        // Try to determine current frame context
        try {
          if (window.parent !== window) {
            currentFrameContext = 'frame';
          }
        } catch (e) {
          // Cross-origin frame, can't access parent
          currentFrameContext = 'frame-cross-origin';
        }

        // Find all iframe elements
        const iframeElements = document.querySelectorAll('iframe');

        iframeElements.forEach((iframe, index) => {
          let selector = '';
          if (iframe.id) {
            selector = '#' + iframe.id;
          } else if (iframe.name) {
            selector = 'iframe[name="' + iframe.name + '"]';
          } else {
            selector = 'iframe:nth-of-type(' + (index + 1) + ')';
          }

          let isAccessible = true;
          let origin = '';

          try {
            // Try to access the frame's document
            const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (frameDoc) {
              origin = iframe.contentWindow.location.origin;
            } else {
              isAccessible = false;
            }
          } catch (e) {
            // Cross-origin frame
            isAccessible = false;
            try {
              origin = new URL(iframe.src).origin;
            } catch {
              origin = 'unknown';
            }
          }

          frames.push({
            id: iframe.id || '',
            name: iframe.name || '',
            src: iframe.src || '',
            index: index,
            selector: selector,
            isAccessible: isAccessible,
            origin: origin
          });
        });

        return {
          frames: frames,
          count: frames.length,
          currentFrame: currentFrameContext
        };
      `);

      const result = frameData as GetFramesResult;

      this.logger.info('Frame information retrieval completed', {
        frameCount: result.count,
        currentFrame: result.currentFrame,
        accessibleFrames: result.frames.filter(f => f.isAccessible).length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'getFrames', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Get frames failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'getFrames', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Get frames failed'));
    }
  }

  async switchToFrame(params: unknown, sessionId?: string): Promise<MCPToolResult<SwitchToFrameResult>> {
    const startTime = Date.now();
    this.logger.info('Executing switch_to_frame tool', { params, sessionId });

    try {
      const validatedParams = this.validateSwitchToFrameParams(params);
      const { target, waitForLoad = true } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Switching to frame', {
        target,
        waitForLoad,
        sessionId: actualSessionId
      });

      // Get current frame context
      const previousContext = await this.getCurrentFrameContext(session.driver);

      // Switch to frame based on target type
      if (typeof target === 'number') {
        // Switch by index
        await session.driver.switchTo().frame(target);
      } else if (typeof target === 'string') {
        // Try different approaches for string target
        try {
          // First try as frame name
          await session.driver.switchTo().frame(target);
        } catch {
          try {
            // Try as frame ID
            const frameElement = await session.driver.findElement({ id: target });
            await session.driver.switchTo().frame(frameElement);
          } catch {
            // Try as CSS selector
            const frameElement = await session.driver.findElement({ css: target });
            await session.driver.switchTo().frame(frameElement);
          }
        }
      }

      // Wait for frame to load if requested
      if (waitForLoad) {
        await session.driver.wait(async () => {
          try {
            return await session.driver.executeScript('return document.readyState === "complete";');
          } catch {
            return false;
          }
        }, 10000);
      }

      // Get frame information after switch
      const frameInfo = await this.getCurrentFrameInfo(session.driver);

      const result: SwitchToFrameResult = {
        success: true,
        frameInfo,
        previousContext
      };

      this.logger.info('Frame switch completed', {
        target,
        previousContext,
        newFrameInfo: frameInfo,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'switchToFrame', String(target), true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Frame switch failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'switchToFrame', String((params as any)?.target), false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Frame switch failed'));
    }
  }

  async switchToParentFrame(params: unknown = {}, sessionId?: string): Promise<MCPToolResult<SwitchToParentFrameResult>> {
    const startTime = Date.now();
    this.logger.info('Executing switch_to_parent_frame tool', { params, sessionId });

    try {
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Switching to parent frame', { sessionId: actualSessionId });

      // Switch to parent frame
      await session.driver.switchTo().parentFrame();

      // Get current context after switch
      const currentContext = await this.getCurrentFrameContext(session.driver);

      const result: SwitchToParentFrameResult = {
        success: true,
        currentContext
      };

      this.logger.info('Parent frame switch completed', {
        currentContext,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'switchToParentFrame', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Parent frame switch failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'switchToParentFrame', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Parent frame switch failed'));
    }
  }

  async executeInFrame(params: unknown, sessionId?: string): Promise<MCPToolResult<ExecuteInFrameResult>> {
    const startTime = Date.now();
    this.logger.info('Executing execute_in_frame tool', { params, sessionId });

    try {
      const validatedParams = this.validateExecuteInFrameParams(params);
      const { frame, script, args = [] } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Executing script in frame', {
        frame,
        scriptLength: script.length,
        argsCount: args.length,
        sessionId: actualSessionId
      });

      // Store current frame context
      const originalContext = await this.getCurrentFrameContext(session.driver);

      // Switch to target frame
      if (typeof frame === 'number') {
        await session.driver.switchTo().frame(frame);
      } else {
        // Try different approaches for string frame identifier
        try {
          await session.driver.switchTo().frame(frame);
        } catch {
          try {
            const frameElement = await session.driver.findElement({ id: frame });
            await session.driver.switchTo().frame(frameElement);
          } catch {
            const frameElement = await session.driver.findElement({ css: frame });
            await session.driver.switchTo().frame(frameElement);
          }
        }
      }

      // Execute script in frame
      let result: any;
      if (args.length > 0) {
        result = await session.driver.executeScript(script, ...args);
      } else {
        result = await session.driver.executeScript(script);
      }

      // Get current frame context after execution
      const frameContext = await this.getCurrentFrameContext(session.driver);

      // Switch back to original context
      if (originalContext === 'main') {
        await session.driver.switchTo().defaultContent();
      }

      const executionResult: ExecuteInFrameResult = {
        result,
        frameContext
      };

      this.logger.info('Frame script execution completed', {
        frame,
        frameContext,
        hasResult: result !== null && result !== undefined,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'executeInFrame', String(frame), true, Date.now() - startTime);

      return {
        status: 'success',
        data: executionResult
      };

    } catch (error) {
      this.logger.error('Frame script execution failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'executeInFrame', String((params as any)?.frame), false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Frame script execution failed'));
    }
  }

  // Private helper methods

  private async getCurrentFrameContext(driver: WebDriver): Promise<string> {
    try {
      const context = await driver.executeScript(`
        try {
          if (window.parent === window) {
            return 'main';
          } else {
            return 'frame';
          }
        } catch (e) {
          return 'frame-cross-origin';
        }
      `);
      return context as string;
    } catch {
      return 'unknown';
    }
  }

  private async getCurrentFrameInfo(driver: WebDriver): Promise<FrameInfo> {
    try {
      const frameInfo = await driver.executeScript(`
        try {
          const frameElement = window.frameElement;
          if (frameElement) {
            return {
              id: frameElement.id || '',
              name: frameElement.name || '',
              src: frameElement.src || '',
              index: Array.from(frameElement.parentNode.querySelectorAll('iframe')).indexOf(frameElement),
              selector: frameElement.id ? '#' + frameElement.id :
                       frameElement.name ? 'iframe[name="' + frameElement.name + '"]' :
                       'iframe:nth-of-type(' + (Array.from(frameElement.parentNode.querySelectorAll('iframe')).indexOf(frameElement) + 1) + ')',
              isAccessible: true,
              origin: window.location.origin
            };
          } else {
            return {
              id: '',
              name: '',
              src: '',
              index: -1,
              selector: 'main',
              isAccessible: true,
              origin: window.location.origin
            };
          }
        } catch (e) {
          return {
            id: '',
            name: '',
            src: '',
            index: -1,
            selector: 'cross-origin-frame',
            isAccessible: false,
            origin: 'unknown'
          };
        }
      `);

      return frameInfo as FrameInfo;
    } catch (error) {
      this.logger.warn('Failed to get frame info', { error });
      return {
        id: '',
        name: '',
        src: '',
        index: -1,
        selector: 'unknown',
        isAccessible: false,
        origin: 'unknown'
      };
    }
  }

  private async getDefaultSession(): Promise<string> {
    const sessions = this.sessionManager.listSessions();
    if (sessions.length > 0) {
      return sessions[0].id;
    }
    throw new Error('No session ID provided and no active sessions available. Create a session first.');
  }

  // Validation methods

  private validateSwitchToFrameParams(params: unknown): SwitchToFrameParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (p.target === undefined) {
      throw new ValidationError('target is required', 'target', p.target);
    }

    if (typeof p.target !== 'string' && typeof p.target !== 'number') {
      throw new ValidationError('target must be a string (selector/name/id) or number (index)', 'target', p.target);
    }

    if (typeof p.target === 'string' && p.target.trim() === '') {
      throw new ValidationError('target string cannot be empty', 'target', p.target);
    }

    if (typeof p.target === 'number' && p.target < 0) {
      throw new ValidationError('target index must be non-negative', 'target', p.target);
    }

    return {
      target: typeof p.target === 'string' ? normalizeSelector(p.target) : p.target,
      waitForLoad: p.waitForLoad
    };
  }

  private validateExecuteInFrameParams(params: unknown): ExecuteInFrameParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (p.frame === undefined) {
      throw new ValidationError('frame is required', 'frame', p.frame);
    }

    if (typeof p.frame !== 'string' && typeof p.frame !== 'number') {
      throw new ValidationError('frame must be a string (selector/name/id) or number (index)', 'frame', p.frame);
    }

    if (!p.script || typeof p.script !== 'string') {
      throw new ValidationError('script is required and must be a string', 'script', p.script);
    }

    if (p.args && !Array.isArray(p.args)) {
      throw new ValidationError('args must be an array', 'args', p.args);
    }

    // Validate script safety (basic)
    if (p.script.includes('eval(') || p.script.includes('Function(')) {
      throw new ValidationError('Script contains potentially dangerous code', 'script', p.script);
    }

    return {
      frame: typeof p.frame === 'string' ? normalizeSelector(p.frame) : p.frame,
      script: p.script,
      args: p.args
    };
  }
}