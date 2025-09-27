import { WebDriver } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import {
  GetWindowsResult,
  SwitchWindowParams,
  SwitchWindowResult,
  OpenNewWindowParams,
  OpenNewWindowResult,
  CloseWindowParams,
  CloseWindowResult,
  ArrangeWindowsParams,
  ArrangeWindowsResult,
  WindowInfo,
  MCPToolResult
} from '../types/index.js';
import { ValidationError, createErrorResponse } from '../utils/errors.js';
import winston from 'winston';

export class WindowTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async getWindows(params: unknown = {}, sessionId?: string): Promise<MCPToolResult<GetWindowsResult>> {
    const startTime = Date.now();
    this.logger.info('Executing get_windows tool', { params, sessionId });

    try {
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Getting window information', { sessionId: actualSessionId });

      // Get all window handles
      const allHandles = await session.driver.getAllWindowHandles();
      const currentHandle = await session.driver.getWindowHandle();

      const windows: WindowInfo[] = [];

      // Get information for each window
      for (const handle of allHandles) {
        try {
          // Switch to window to get info
          await session.driver.switchTo().window(handle);

          const title = await session.driver.getTitle();
          const url = await session.driver.getCurrentUrl();
          const isActive = handle === currentHandle;

          // Get window position and size
          let position: { x: number; y: number } | undefined;
          let size: { width: number; height: number } | undefined;

          try {
            const rect = await session.driver.manage().window().getRect();
            position = { x: rect.x, y: rect.y };
            size = { width: rect.width, height: rect.height };
          } catch (error) {
            this.logger.warn('Failed to get window position/size', { handle, error });
          }

          windows.push({
            handle,
            title,
            url,
            isActive,
            position,
            size
          });

        } catch (error) {
          this.logger.warn('Failed to get info for window', { handle, error });
        }
      }

      // Switch back to original window
      await session.driver.switchTo().window(currentHandle);

      const result: GetWindowsResult = {
        windows,
        current: currentHandle,
        count: allHandles.length
      };

      this.logger.info('Window information retrieval completed', {
        windowCount: result.count,
        currentHandle: result.current,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'getWindows', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Get windows failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'getWindows', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Get windows failed'));
    }
  }

  async switchWindow(params: unknown, sessionId?: string): Promise<MCPToolResult<SwitchWindowResult>> {
    const startTime = Date.now();
    this.logger.info('Executing switch_window tool', { params, sessionId });

    try {
      const validatedParams = this.validateSwitchWindowParams(params);
      const { target, closeOthers = false } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Switching window', {
        target,
        closeOthers,
        sessionId: actualSessionId
      });

      const previousWindow = await session.driver.getWindowHandle();
      const allHandles = await session.driver.getAllWindowHandles();

      let targetHandle: string;

      if (typeof target === 'number') {
        // Switch by index
        if (target < 0 || target >= allHandles.length) {
          throw new ValidationError(
            `Window index ${target} is out of range (0-${allHandles.length - 1})`,
            'target',
            target
          );
        }
        targetHandle = allHandles[target];
      } else {
        // Switch by handle
        if (!allHandles.includes(target)) {
          throw new ValidationError(
            `Window handle '${target}' not found`,
            'target',
            target
          );
        }
        targetHandle = target;
      }

      // Switch to target window
      await session.driver.switchTo().window(targetHandle);

      // Close other windows if requested
      if (closeOthers) {
        const otherHandles = allHandles.filter(handle => handle !== targetHandle);

        for (const handle of otherHandles) {
          try {
            await session.driver.switchTo().window(handle);
            await session.driver.close();
          } catch (error) {
            this.logger.warn('Failed to close window', { handle, error });
          }
        }

        // Switch back to target window
        await session.driver.switchTo().window(targetHandle);
      }

      const result: SwitchWindowResult = {
        success: true,
        previousWindow,
        currentWindow: targetHandle
      };

      this.logger.info('Window switch completed', {
        previousWindow,
        currentWindow: targetHandle,
        closedOthers: closeOthers,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'switchWindow', String(target), true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Window switch failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'switchWindow', String((params as any)?.target), false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Window switch failed'));
    }
  }

  async openNewWindow(params: unknown, sessionId?: string): Promise<MCPToolResult<OpenNewWindowResult>> {
    const startTime = Date.now();
    this.logger.info('Executing open_new_window tool', { params, sessionId });

    try {
      const validatedParams = this.validateOpenNewWindowParams(params);
      const { url, type = 'tab', focus = true, position, size } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Opening new window', {
        url,
        type,
        focus,
        position,
        size,
        sessionId: actualSessionId
      });

      // Open new window/tab
      if (type === 'window') {
        // Open new window with specified properties
        await session.driver.executeScript(`
          const url = arguments[0];
          const features = [];

          if (arguments[1]) {
            features.push('left=' + arguments[1].x);
            features.push('top=' + arguments[1].y);
          }

          if (arguments[2]) {
            features.push('width=' + arguments[2].width);
            features.push('height=' + arguments[2].height);
          }

          window.open(url || 'about:blank', '_blank', features.join(','));
        `, url, position, size);
      } else {
        // Open new tab
        await session.driver.executeScript(`
          window.open(arguments[0] || 'about:blank', '_blank');
        `, url);
      }

      // Wait for new window to appear
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the new window handle
      const allHandles = await session.driver.getAllWindowHandles();
      const newHandle = allHandles[allHandles.length - 1]; // Assume last handle is new window

      // Switch to new window if focus is requested
      if (focus) {
        await session.driver.switchTo().window(newHandle);

        // Navigate to URL if provided and not already navigated
        if (url && type === 'window') {
          const currentUrl = await session.driver.getCurrentUrl();
          if (currentUrl === 'about:blank') {
            await session.driver.get(url);
          }
        }

        // Set window size if specified
        if (size) {
          try {
            await session.driver.manage().window().setRect({
              width: size.width,
              height: size.height,
              x: position?.x || 0,
              y: position?.y || 0
            });
          } catch (error) {
            this.logger.warn('Failed to set window size', { size, error });
          }
        }
      }

      const result: OpenNewWindowResult = {
        handle: newHandle,
        success: true
      };

      this.logger.info('New window opened successfully', {
        handle: newHandle,
        type,
        url,
        focus,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'openNewWindow', url, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Open new window failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'openNewWindow', (params as any)?.url, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Open new window failed'));
    }
  }

  async closeWindow(params: unknown, sessionId?: string): Promise<MCPToolResult<CloseWindowResult>> {
    const startTime = Date.now();
    this.logger.info('Executing close_window tool', { params, sessionId });

    try {
      const validatedParams = this.validateCloseWindowParams(params);
      const { handle, force = false } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Closing window', {
        handle,
        force,
        sessionId: actualSessionId
      });

      const allHandles = await session.driver.getAllWindowHandles();
      const currentHandle = await session.driver.getWindowHandle();

      // Determine target handle
      const targetHandle = handle || currentHandle;

      // Check if this is the last window
      if (allHandles.length === 1 && !force) {
        throw new ValidationError(
          'Cannot close the last window without force=true',
          'lastWindow',
          { remainingWindows: 1, force }
        );
      }

      // Switch to target window if not current
      if (targetHandle !== currentHandle) {
        await session.driver.switchTo().window(targetHandle);
      }

      // Close the window
      await session.driver.close();

      const remainingHandles = allHandles.filter(h => h !== targetHandle);
      const remainingWindows = remainingHandles.length;

      // Switch to another window if we closed the current one
      if (targetHandle === currentHandle && remainingWindows > 0) {
        await session.driver.switchTo().window(remainingHandles[0]);
      }

      const result: CloseWindowResult = {
        success: true,
        remainingWindows
      };

      this.logger.info('Window closed successfully', {
        closedHandle: targetHandle,
        remainingWindows,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'closeWindow', targetHandle, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Close window failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'closeWindow', (params as any)?.handle, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Close window failed'));
    }
  }

  async arrangeWindows(params: unknown, sessionId?: string): Promise<MCPToolResult<ArrangeWindowsResult>> {
    const startTime = Date.now();
    this.logger.info('Executing arrange_windows tool', { params, sessionId });

    try {
      const validatedParams = this.validateArrangeWindowsParams(params);
      const { layout, windows: specificWindows, customLayout } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Arranging windows', {
        layout,
        specificWindows: specificWindows?.length,
        hasCustomLayout: !!customLayout,
        sessionId: actualSessionId
      });

      const allHandles = await session.driver.getAllWindowHandles();
      const currentHandle = await session.driver.getWindowHandle();

      // Determine which windows to arrange
      const handlesToArrange = specificWindows || allHandles;

      const arrangement: WindowInfo[] = [];

      if (layout === 'custom' && customLayout) {
        // Apply custom layout
        for (const layoutItem of customLayout) {
          if (handlesToArrange.includes(layoutItem.handle)) {
            try {
              await session.driver.switchTo().window(layoutItem.handle);

              await session.driver.manage().window().setRect({
                x: layoutItem.position.x,
                y: layoutItem.position.y,
                width: layoutItem.size.width,
                height: layoutItem.size.height
              });

              const title = await session.driver.getTitle();
              const url = await session.driver.getCurrentUrl();

              arrangement.push({
                handle: layoutItem.handle,
                title,
                url,
                isActive: layoutItem.handle === currentHandle,
                position: layoutItem.position,
                size: layoutItem.size
              });

            } catch (error) {
              this.logger.warn('Failed to arrange window', { handle: layoutItem.handle, error });
            }
          }
        }
      } else {
        // Apply preset layout
        const screenWidth = 1920; // Assume standard screen width
        const screenHeight = 1080; // Assume standard screen height

        for (let i = 0; i < handlesToArrange.length; i++) {
          const handle = handlesToArrange[i];

          try {
            await session.driver.switchTo().window(handle);

            let position: { x: number; y: number };
            let size: { width: number; height: number };

            switch (layout) {
              case 'cascade':
                position = { x: i * 30, y: i * 30 };
                size = { width: 800, height: 600 };
                break;

              case 'tile':
                const cols = Math.ceil(Math.sqrt(handlesToArrange.length));
                const rows = Math.ceil(handlesToArrange.length / cols);
                const windowWidth = Math.floor(screenWidth / cols);
                const windowHeight = Math.floor(screenHeight / rows);

                const col = i % cols;
                const row = Math.floor(i / cols);

                position = { x: col * windowWidth, y: row * windowHeight };
                size = { width: windowWidth, height: windowHeight };
                break;

              case 'stack':
                position = { x: 0, y: 0 };
                size = { width: screenWidth, height: screenHeight };
                break;

              default:
                // Keep current position and size
                const rect = await session.driver.manage().window().getRect();
                position = { x: rect.x, y: rect.y };
                size = { width: rect.width, height: rect.height };
            }

            if (layout !== 'stack') {
              await session.driver.manage().window().setRect({
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height
              });
            }

            const title = await session.driver.getTitle();
            const url = await session.driver.getCurrentUrl();

            arrangement.push({
              handle,
              title,
              url,
              isActive: handle === currentHandle,
              position,
              size
            });

          } catch (error) {
            this.logger.warn('Failed to arrange window', { handle, layout, error });
          }
        }
      }

      // Switch back to original window
      await session.driver.switchTo().window(currentHandle);

      const result: ArrangeWindowsResult = {
        success: true,
        arrangement
      };

      this.logger.info('Window arrangement completed', {
        layout,
        windowsArranged: arrangement.length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'arrangeWindows', layout, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Window arrangement failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'arrangeWindows', (params as any)?.layout, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Window arrangement failed'));
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

  private validateSwitchWindowParams(params: unknown): SwitchWindowParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (p.target === undefined) {
      throw new ValidationError('target is required', 'target', p.target);
    }

    if (typeof p.target !== 'string' && typeof p.target !== 'number') {
      throw new ValidationError('target must be a string (handle) or number (index)', 'target', p.target);
    }

    return {
      target: p.target,
      closeOthers: p.closeOthers
    };
  }

  private validateOpenNewWindowParams(params: unknown): OpenNewWindowParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (p.url && typeof p.url !== 'string') {
      throw new ValidationError('url must be a string', 'url', p.url);
    }

    const validTypes = ['tab', 'window'];
    if (p.type && !validTypes.includes(p.type)) {
      throw new ValidationError(
        `type must be one of: ${validTypes.join(', ')}`,
        'type',
        p.type
      );
    }

    if (p.position && (typeof p.position !== 'object' || typeof p.position.x !== 'number' || typeof p.position.y !== 'number')) {
      throw new ValidationError('position must be an object with x and y number properties', 'position', p.position);
    }

    if (p.size && (typeof p.size !== 'object' || typeof p.size.width !== 'number' || typeof p.size.height !== 'number')) {
      throw new ValidationError('size must be an object with width and height number properties', 'size', p.size);
    }

    return {
      url: p.url,
      type: p.type,
      focus: p.focus,
      position: p.position,
      size: p.size
    };
  }

  private validateCloseWindowParams(params: unknown): CloseWindowParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (p.handle && typeof p.handle !== 'string') {
      throw new ValidationError('handle must be a string', 'handle', p.handle);
    }

    return {
      handle: p.handle,
      force: p.force
    };
  }

  private validateArrangeWindowsParams(params: unknown): ArrangeWindowsParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    const validLayouts = ['cascade', 'tile', 'stack', 'custom'];
    if (!p.layout || !validLayouts.includes(p.layout)) {
      throw new ValidationError(
        `layout is required and must be one of: ${validLayouts.join(', ')}`,
        'layout',
        p.layout
      );
    }

    if (p.windows && !Array.isArray(p.windows)) {
      throw new ValidationError('windows must be an array of window handles', 'windows', p.windows);
    }

    if (p.layout === 'custom' && !p.customLayout) {
      throw new ValidationError('customLayout is required when layout is "custom"', 'customLayout', p.customLayout);
    }

    if (p.customLayout && !Array.isArray(p.customLayout)) {
      throw new ValidationError('customLayout must be an array', 'customLayout', p.customLayout);
    }

    return {
      layout: p.layout,
      windows: p.windows,
      customLayout: p.customLayout
    };
  }
}