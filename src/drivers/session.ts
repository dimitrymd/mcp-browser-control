import { WebDriver } from 'selenium-webdriver';
import { v4 as uuidv4 } from 'uuid';
import { BrowserSession, SessionState, SessionMetrics, DriverOptions } from '../types/index.js';
import { WebDriverManager } from './manager.js';
import { SessionError, ConcurrencyError } from '../utils/errors.js';
import winston from 'winston';

export class SessionManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private driverManager: WebDriverManager;
  private logger: winston.Logger;
  private maxConcurrent: number;
  private sessionTimeout: number;
  private cleanupInterval: NodeJS.Timeout | undefined = undefined;

  constructor(
    driverManager: WebDriverManager,
    logger: winston.Logger,
    maxConcurrent: number = 5,
    sessionTimeout: number = 600000 // 10 minutes
  ) {
    this.driverManager = driverManager;
    this.logger = logger;
    this.maxConcurrent = maxConcurrent;
    this.sessionTimeout = sessionTimeout;

    this.startCleanupProcess();
  }

  async createSession(
    browserType: 'chrome' | 'firefox',
    options: DriverOptions
  ): Promise<string> {
    this.logger.info('Creating new browser session', { browserType, activeSessions: this.sessions.size });

    // Check concurrency limits
    if (this.sessions.size >= this.maxConcurrent) {
      throw new ConcurrencyError(
        `Maximum concurrent sessions limit reached (${this.maxConcurrent}). Close existing sessions before creating new ones.`
      );
    }

    try {
      // Create the WebDriver instance
      const driver = await this.driverManager.createDriver(browserType, options);

      // Validate the driver is working
      const isValid = await this.driverManager.validateDriver(driver);
      if (!isValid) {
        await this.driverManager.closeDriver(driver);
        throw new SessionError('Created driver failed validation checks');
      }

      // Create session object
      const sessionId = uuidv4();
      const session: BrowserSession = {
        id: sessionId,
        driver,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        url: 'about:blank',
        title: '',
        isReady: true,
        browserType,
        // Enhanced tracking features
        scrollPosition: { x: 0, y: 0 },
        actionHistory: [],
        performanceMetrics: {
          totalActions: 0,
          successfulActions: 0,
          averageActionTime: 0
        }
      };

      // Store session
      this.sessions.set(sessionId, session);

      this.logger.info('Browser session created successfully', {
        sessionId,
        browserType,
        totalSessions: this.sessions.size
      });

      return sessionId;
    } catch (error) {
      this.logger.error('Failed to create browser session', { browserType, error });

      if (error instanceof SessionError || error instanceof ConcurrencyError) {
        throw error;
      }

      throw new SessionError(
        `Failed to create ${browserType} session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  getSession(sessionId: string): BrowserSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    // Update last used timestamp
    session.lastUsed = Date.now();
    return session;
  }

  async destroySession(sessionId: string): Promise<void> {
    this.logger.info('Destroying browser session', { sessionId });

    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn('Attempted to destroy non-existent session', { sessionId });
      return;
    }

    try {
      await this.driverManager.closeDriver(session.driver);
    } catch (error) {
      this.logger.error('Error closing driver during session destruction', { sessionId, error });
    }

    this.sessions.delete(sessionId);
    this.logger.info('Browser session destroyed', { sessionId, remainingSessions: this.sessions.size });
  }

  async destroyAllSessions(): Promise<void> {
    this.logger.info('Destroying all browser sessions', { count: this.sessions.size });

    const sessionIds = Array.from(this.sessions.keys());
    const destroyPromises = sessionIds.map(id => this.destroySession(id));

    await Promise.allSettled(destroyPromises);
    this.sessions.clear();

    this.logger.info('All browser sessions destroyed');
  }

  listSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }

  getSessionMetrics(): SessionMetrics {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => (now - s.lastUsed) < 300000).length; // Active in last 5 minutes
    const averageSessionAge = totalSessions > 0
      ? sessions.reduce((sum, s) => sum + (now - s.createdAt), 0) / totalSessions
      : 0;

    return {
      totalSessions,
      activeSessions,
      averageSessionAge,
      failedSessions: 0 // TODO: Track failed sessions if needed
    };
  }

  async getSessionState(sessionId: string): Promise<SessionState> {
    const session = this.getSession(sessionId);

    try {
      const url = await session.driver.getCurrentUrl();
      const title = await session.driver.getTitle();

      // Update session info
      session.url = url;
      session.title = title;
      session.lastUsed = Date.now();

      return {
        url,
        title,
        readyState: session.isReady ? 'complete' : 'loading'
      };
    } catch (error) {
      this.logger.error('Failed to get session state', { sessionId, error });
      throw new SessionError(
        `Failed to get state for session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async checkSessionHealth(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      const health = await this.driverManager.checkDriverHealth(session.driver);
      return health.isHealthy;
    } catch (error) {
      this.logger.warn('Session health check failed', { sessionId, error });
      return false;
    }
  }

  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupIdleSessions();
    }, 60000); // Run cleanup every minute

    this.logger.info('Session cleanup process started', {
      interval: '60s',
      timeout: this.sessionTimeout
    });
  }

  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    const idleSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastUsed > this.sessionTimeout) {
        idleSessions.push(sessionId);
      }
    }

    if (idleSessions.length > 0) {
      this.logger.info('Cleaning up idle sessions', {
        count: idleSessions.length,
        sessionIds: idleSessions
      });

      for (const sessionId of idleSessions) {
        try {
          await this.destroySession(sessionId);
        } catch (error) {
          this.logger.error('Error during idle session cleanup', { sessionId, error });
        }
      }
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down session manager');

    // Stop cleanup process
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Destroy all sessions
    await this.destroyAllSessions();

    this.logger.info('Session manager shutdown complete');
  }

  // Utility methods for session management
  isSessionActive(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session !== undefined && session.isReady;
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  hasCapacityForNewSession(): boolean {
    return this.sessions.size < this.maxConcurrent;
  }

  async refreshSession(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);

    try {
      // Check if session is still healthy
      const isHealthy = await this.checkSessionHealth(sessionId);
      if (!isHealthy) {
        throw new SessionError(`Session ${sessionId} is not healthy and needs to be recreated`);
      }

      session.lastUsed = Date.now();
      this.logger.debug('Session refreshed', { sessionId });
    } catch (error) {
      this.logger.error('Failed to refresh session', { sessionId, error });
      throw error;
    }
  }

  // Enhanced tracking methods

  trackAction(
    sessionId: string,
    action: string,
    selector: string | undefined,
    success: boolean,
    duration?: number
  ): void {
    try {
      const session = this.getSession(sessionId);

      // Add to action history (keep last 10)
      session.actionHistory.push({
        action,
        timestamp: Date.now(),
        selector,
        success,
        duration
      });

      // Keep only last 10 actions
      if (session.actionHistory.length > 10) {
        session.actionHistory = session.actionHistory.slice(-10);
      }

      // Update performance metrics
      session.performanceMetrics.totalActions++;
      if (success) {
        session.performanceMetrics.successfulActions++;
      }

      if (duration) {
        const totalTime = session.performanceMetrics.averageActionTime * (session.performanceMetrics.totalActions - 1) + duration;
        session.performanceMetrics.averageActionTime = totalTime / session.performanceMetrics.totalActions;
        session.performanceMetrics.lastActionTime = duration;
      }

      session.lastUsed = Date.now();
    } catch (error) {
      this.logger.warn('Failed to track action', { sessionId, action, error });
    }
  }

  updateScrollPosition(sessionId: string, x: number, y: number): void {
    try {
      const session = this.getSession(sessionId);
      session.scrollPosition = { x, y };
      session.lastUsed = Date.now();
    } catch (error) {
      this.logger.warn('Failed to update scroll position', { sessionId, error });
    }
  }

  setActiveElement(sessionId: string, selector: string | undefined): void {
    try {
      const session = this.getSession(sessionId);
      session.activeElement = selector;
      session.lastUsed = Date.now();
    } catch (error) {
      this.logger.warn('Failed to set active element', { sessionId, error });
    }
  }

  getSessionPerformanceMetrics(sessionId: string): {
    totalActions: number;
    successfulActions: number;
    successRate: number;
    averageActionTime: number;
    lastActionTime?: number | undefined;
    sessionAge: number;
  } {
    const session = this.getSession(sessionId);
    const sessionAge = Date.now() - session.createdAt;
    const successRate = session.performanceMetrics.totalActions > 0
      ? session.performanceMetrics.successfulActions / session.performanceMetrics.totalActions
      : 0;

    return {
      totalActions: session.performanceMetrics.totalActions,
      successfulActions: session.performanceMetrics.successfulActions,
      successRate,
      averageActionTime: session.performanceMetrics.averageActionTime,
      lastActionTime: session.performanceMetrics.lastActionTime,
      sessionAge
    };
  }
}