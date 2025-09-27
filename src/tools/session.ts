import { SessionManager } from '../drivers/session.js';
import { MCPToolResult, DriverOptions } from '../types/index.js';
import { createErrorResponse, ValidationError } from '../utils/errors.js';
import winston from 'winston';

export class SessionTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async createSession(params: unknown): Promise<MCPToolResult<{ sessionId: string }>> {
    this.logger.info('Executing create_session tool', { params });

    try {
      const validatedParams = this.validateCreateSessionParams(params);
      const { browserType, headless, windowSize, userAgent } = validatedParams;

      const driverOptions: DriverOptions = {
        headless,
        ...(windowSize && { windowSize }),
        ...(userAgent && { userAgent })
      };

      const sessionId = await this.sessionManager.createSession(browserType, driverOptions);

      this.logger.info('Session created successfully', { sessionId, browserType });

      return {
        status: 'success',
        data: { sessionId }
      };
    } catch (error) {
      this.logger.error('Session creation failed', { params, error });
      return createErrorResponse(error instanceof Error ? error : new Error('Session creation failed'));
    }
  }

  async closeSession(params: unknown): Promise<MCPToolResult<{ success: boolean }>> {
    this.logger.info('Executing close_session tool', { params });

    try {
      const { sessionId } = this.validateCloseSessionParams(params);

      await this.sessionManager.destroySession(sessionId);

      this.logger.info('Session closed successfully', { sessionId });

      return {
        status: 'success',
        data: { success: true }
      };
    } catch (error) {
      this.logger.error('Session closure failed', { params, error });
      return createErrorResponse(error instanceof Error ? error : new Error('Session closure failed'));
    }
  }

  async listSessions(): Promise<MCPToolResult<{ sessions: any[]; metrics: any }>> {
    this.logger.info('Executing list_sessions tool');

    try {
      const sessions = this.sessionManager.listSessions();
      const metrics = this.sessionManager.getSessionMetrics();

      const sessionData = sessions.map(session => ({
        id: session.id,
        browserType: session.browserType,
        url: session.url,
        title: session.title,
        createdAt: session.createdAt,
        lastUsed: session.lastUsed,
        isReady: session.isReady,
        totalActions: session.performanceMetrics.totalActions,
        successfulActions: session.performanceMetrics.successfulActions,
        activeElement: session.activeElement,
        scrollPosition: session.scrollPosition
      }));

      return {
        status: 'success',
        data: { sessions: sessionData, metrics }
      };
    } catch (error) {
      this.logger.error('List sessions failed', { error });
      return createErrorResponse(error instanceof Error ? error : new Error('List sessions failed'));
    }
  }

  async getSessionInfo(params: unknown): Promise<MCPToolResult<any>> {
    this.logger.info('Executing get_session_info tool', { params });

    try {
      const { sessionId } = this.validateSessionInfoParams(params);

      const session = this.sessionManager.getSession(sessionId);
      const state = await this.sessionManager.getSessionState(sessionId);
      const performanceMetrics = this.sessionManager.getSessionPerformanceMetrics(sessionId);

      return {
        status: 'success',
        data: {
          id: session.id,
          browserType: session.browserType,
          createdAt: session.createdAt,
          lastUsed: session.lastUsed,
          state,
          performanceMetrics,
          actionHistory: session.actionHistory,
          activeElement: session.activeElement,
          scrollPosition: session.scrollPosition
        }
      };
    } catch (error) {
      this.logger.error('Get session info failed', { params, error });
      return createErrorResponse(error instanceof Error ? error : new Error('Get session info failed'));
    }
  }

  // Validation methods
  private validateCreateSessionParams(params: unknown): {
    browserType: 'chrome' | 'firefox';
    headless: boolean;
    windowSize?: { width: number; height: number };
    userAgent?: string;
  } {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;
    const browserType = p.browserType || 'chrome';

    if (!['chrome', 'firefox'].includes(browserType)) {
      throw new ValidationError('browserType must be chrome or firefox', 'browserType', browserType);
    }

    return {
      browserType,
      headless: p.headless !== false, // Default to true
      windowSize: p.windowSize,
      userAgent: p.userAgent
    };
  }

  private validateCloseSessionParams(params: unknown): { sessionId: string } {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;
    if (!p.sessionId || typeof p.sessionId !== 'string') {
      throw new ValidationError('sessionId is required and must be a string', 'sessionId', p.sessionId);
    }

    return { sessionId: p.sessionId };
  }

  private validateSessionInfoParams(params: unknown): { sessionId: string } {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;
    if (!p.sessionId || typeof p.sessionId !== 'string') {
      throw new ValidationError('sessionId is required and must be a string', 'sessionId', p.sessionId);
    }

    return { sessionId: p.sessionId };
  }
}