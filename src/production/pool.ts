import { WebDriver } from 'selenium-webdriver';
import { WebDriverManager } from '../drivers/manager.js';
import { BrowserSession, DriverOptions } from '../types/index.js';
import { SessionError, ConcurrencyError } from '../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

export interface PoolConfig {
  minSize: number;
  maxSize: number;
  idleTimeout: number;
  maxSessionAge: number;
  healthCheckInterval: number;
  prewarmCount: number;
  browserType: 'chrome' | 'firefox';
  driverOptions: DriverOptions;
}

export interface PoolSession extends BrowserSession {
  inUse: boolean;
  lastHealthCheck: number;
  useCount: number;
  errors: number;
}

export class SessionPool {
  private config: PoolConfig;
  private driverManager: WebDriverManager;
  private logger: winston.Logger;
  private sessions: Map<string, PoolSession> = new Map();
  private availableSessions: Set<string> = new Set();
  private healthCheckInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  // Pool statistics
  private stats = {
    totalCreated: 0,
    totalDestroyed: 0,
    totalBorrowed: 0,
    totalReturned: 0,
    healthChecksPassed: 0,
    healthChecksFailed: 0,
    currentSize: 0,
    peakSize: 0
  };

  constructor(
    config: PoolConfig,
    driverManager: WebDriverManager,
    logger: winston.Logger
  ) {
    this.config = config;
    this.driverManager = driverManager;
    this.logger = logger;

    this.logger.info('Session pool initializing', {
      minSize: config.minSize,
      maxSize: config.maxSize,
      prewarmCount: config.prewarmCount
    });

    this.initialize();
  }

  /**
   * Initialize the session pool
   */
  private async initialize(): Promise<void> {
    try {
      // Create minimum number of sessions
      const initialSessions = Math.max(this.config.minSize, this.config.prewarmCount);

      for (let i = 0; i < initialSessions; i++) {
        try {
          await this.createNewSession();
        } catch (error) {
          this.logger.warn('Failed to create initial session', { index: i, error });
        }
      }

      // Start health check process
      this.startHealthChecking();

      this.logger.info('Session pool initialized', {
        initialSessions: this.sessions.size,
        availableSessions: this.availableSessions.size
      });

    } catch (error) {
      this.logger.error('Session pool initialization failed', { error });
      throw error;
    }
  }

  /**
   * Borrow a session from the pool
   */
  async borrowSession(): Promise<PoolSession> {
    if (this.isShuttingDown) {
      throw new SessionError('Session pool is shutting down');
    }

    this.stats.totalBorrowed++;

    // Try to get an available session
    let sessionId = this.getAvailableSession();

    if (!sessionId) {
      // No available sessions, try to create a new one
      if (this.sessions.size < this.config.maxSize) {
        sessionId = await this.createNewSession();
      } else {
        // Pool is at capacity, wait for a session to become available
        sessionId = await this.waitForAvailableSession();
      }
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionError(`Session ${sessionId} not found in pool`);
    }

    // Mark as in use
    session.inUse = true;
    session.lastUsed = Date.now();
    session.useCount++;
    this.availableSessions.delete(sessionId);

    this.logger.debug('Session borrowed from pool', {
      sessionId,
      useCount: session.useCount,
      poolSize: this.sessions.size,
      availableSize: this.availableSessions.size
    });

    return session;
  }

  /**
   * Return a session to the pool
   */
  async returnSession(sessionId: string, hasErrors: boolean = false): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      this.logger.warn('Attempted to return unknown session', { sessionId });
      return;
    }

    this.stats.totalReturned++;

    if (hasErrors) {
      session.errors++;
    }

    // Check if session should be retired
    const shouldRetire = this.shouldRetireSession(session);

    if (shouldRetire) {
      await this.destroySession(sessionId);
      this.logger.debug('Session retired due to age/errors', {
        sessionId,
        age: Date.now() - session.createdAt,
        useCount: session.useCount,
        errors: session.errors
      });

      // Create replacement session if below minimum
      if (this.sessions.size < this.config.minSize) {
        try {
          await this.createNewSession();
        } catch (error) {
          this.logger.warn('Failed to create replacement session', { error });
        }
      }
    } else {
      // Return to available pool
      session.inUse = false;
      session.lastUsed = Date.now();
      this.availableSessions.add(sessionId);

      this.logger.debug('Session returned to pool', {
        sessionId,
        poolSize: this.sessions.size,
        availableSize: this.availableSessions.size
      });
    }
  }

  /**
   * Get an available session ID
   */
  private getAvailableSession(): string | null {
    // Prefer recently used sessions
    const sortedAvailable = Array.from(this.availableSessions)
      .map(id => this.sessions.get(id)!)
      .filter(session => session !== undefined)
      .sort((a, b) => b.lastUsed - a.lastUsed);

    return sortedAvailable.length > 0 ? sortedAvailable[0].id : null;
  }

  /**
   * Wait for a session to become available
   */
  private async waitForAvailableSession(timeout: number = 30000): Promise<string> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkAvailable = () => {
        const sessionId = this.getAvailableSession();

        if (sessionId) {
          resolve(sessionId);
          return;
        }

        if (Date.now() - startTime >= timeout) {
          reject(new ConcurrencyError('Timeout waiting for available session'));
          return;
        }

        setTimeout(checkAvailable, 100);
      };

      checkAvailable();
    });
  }

  /**
   * Create a new session
   */
  private async createNewSession(): Promise<string> {
    if (this.sessions.size >= this.config.maxSize) {
      throw new ConcurrencyError(`Cannot create session: pool at maximum size (${this.config.maxSize})`);
    }

    const sessionId = uuidv4();

    try {
      const driver = await this.driverManager.createDriver(
        this.config.browserType,
        this.config.driverOptions
      );

      const session: PoolSession = {
        id: sessionId,
        driver,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        url: 'about:blank',
        title: '',
        isReady: true,
        browserType: this.config.browserType,
        scrollPosition: { x: 0, y: 0 },
        actionHistory: [],
        performanceMetrics: {
          totalActions: 0,
          successfulActions: 0,
          averageActionTime: 0
        },
        // Pool-specific properties
        inUse: false,
        lastHealthCheck: Date.now(),
        useCount: 0,
        errors: 0
      };

      this.sessions.set(sessionId, session);
      this.availableSessions.add(sessionId);

      this.stats.totalCreated++;
      this.stats.currentSize = this.sessions.size;
      this.stats.peakSize = Math.max(this.stats.peakSize, this.stats.currentSize);

      this.logger.debug('New session created in pool', {
        sessionId,
        poolSize: this.sessions.size,
        availableSize: this.availableSessions.size
      });

      return sessionId;

    } catch (error) {
      this.logger.error('Failed to create new session', { sessionId, error });
      throw new SessionError(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Destroy a session
   */
  private async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return;
    }

    try {
      await this.driverManager.closeDriver(session.driver);
    } catch (error) {
      this.logger.warn('Error closing driver during session destruction', { sessionId, error });
    }

    this.sessions.delete(sessionId);
    this.availableSessions.delete(sessionId);

    this.stats.totalDestroyed++;
    this.stats.currentSize = this.sessions.size;

    this.logger.debug('Session destroyed', {
      sessionId,
      poolSize: this.sessions.size,
      availableSize: this.availableSessions.size
    });
  }

  /**
   * Check if session should be retired
   */
  private shouldRetireSession(session: PoolSession): boolean {
    const now = Date.now();

    // Check age
    if (now - session.createdAt > this.config.maxSessionAge) {
      return true;
    }

    // Check error count
    if (session.errors > 5) {
      return true;
    }

    // Check use count (prevent memory leaks)
    if (session.useCount > 1000) {
      return true;
    }

    return false;
  }

  /**
   * Start health checking process
   */
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);

    this.logger.info('Health checking started', {
      interval: this.config.healthCheckInterval
    });
  }

  /**
   * Perform health checks on all sessions
   */
  private async performHealthChecks(): Promise<void> {
    const now = Date.now();
    const sessionsToCheck = Array.from(this.sessions.values())
      .filter(session => !session.inUse && now - session.lastHealthCheck > this.config.healthCheckInterval);

    for (const session of sessionsToCheck) {
      try {
        const isHealthy = await this.driverManager.checkDriverHealth(session.driver);

        session.lastHealthCheck = now;

        if (isHealthy.isHealthy) {
          this.stats.healthChecksPassed++;
        } else {
          this.stats.healthChecksFailed++;
          session.errors++;

          this.logger.warn('Session failed health check', {
            sessionId: session.id,
            details: isHealthy.details
          });

          // Retire unhealthy sessions
          if (session.errors > 3) {
            await this.destroySession(session.id);
          }
        }

      } catch (error) {
        this.logger.error('Health check error', {
          sessionId: session.id,
          error
        });

        session.errors++;
        this.stats.healthChecksFailed++;
      }
    }

    // Maintain minimum pool size
    while (this.sessions.size < this.config.minSize && !this.isShuttingDown) {
      try {
        await this.createNewSession();
      } catch (error) {
        this.logger.warn('Failed to maintain minimum pool size', { error });
        break;
      }
    }

    // Clean up idle sessions if above minimum
    const idleSessions = Array.from(this.sessions.values())
      .filter(session =>
        !session.inUse &&
        now - session.lastUsed > this.config.idleTimeout &&
        this.sessions.size > this.config.minSize
      );

    for (const session of idleSessions) {
      await this.destroySession(session.id);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): typeof this.stats & {
    currentSessions: number;
    availableSessions: number;
    busySessions: number;
  } {
    return {
      ...this.stats,
      currentSessions: this.sessions.size,
      availableSessions: this.availableSessions.size,
      busySessions: this.sessions.size - this.availableSessions.size
    };
  }

  /**
   * Get session by ID (for debugging)
   */
  getSession(sessionId: string): PoolSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    this.logger.info('Shutting down session pool', {
      sessionsToClose: this.sessions.size
    });

    // Stop health checking
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close all sessions
    const shutdownPromises = Array.from(this.sessions.keys()).map(sessionId =>
      this.destroySession(sessionId)
    );

    await Promise.allSettled(shutdownPromises);

    this.logger.info('Session pool shutdown complete', {
      finalStats: this.getStats()
    });
  }

  /**
   * Force cleanup of unhealthy sessions
   */
  async forceCleanup(): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();

    for (const session of this.sessions.values()) {
      if (!session.inUse) {
        try {
          const isHealthy = await this.driverManager.checkDriverHealth(session.driver);

          if (!isHealthy.isHealthy) {
            await this.destroySession(session.id);
            cleanedCount++;
          }
        } catch (error) {
          this.logger.warn('Force cleanup error', { sessionId: session.id, error });
        }
      }
    }

    this.logger.info('Force cleanup completed', { cleanedCount });
    return cleanedCount;
  }

  /**
   * Prewarm the pool with sessions
   */
  async prewarm(): Promise<void> {
    const targetSize = Math.min(this.config.prewarmCount, this.config.maxSize);
    const currentSize = this.sessions.size;

    if (currentSize >= targetSize) {
      return;
    }

    const sessionsToCreate = targetSize - currentSize;

    this.logger.info('Prewarming session pool', {
      currentSize,
      targetSize,
      sessionsToCreate
    });

    const createPromises = Array.from({ length: sessionsToCreate }, () =>
      this.createNewSession().catch(error => {
        this.logger.warn('Prewarm session creation failed', { error });
        return null;
      })
    );

    const results = await Promise.allSettled(createPromises);
    const successful = results.filter(result => result.status === 'fulfilled').length;

    this.logger.info('Pool prewarming completed', {
      attempted: sessionsToCreate,
      successful,
      finalSize: this.sessions.size
    });
  }

  /**
   * Resize the pool
   */
  async resize(newMinSize: number, newMaxSize: number): Promise<void> {
    this.logger.info('Resizing session pool', {
      oldMin: this.config.minSize,
      oldMax: this.config.maxSize,
      newMin: newMinSize,
      newMax: newMaxSize
    });

    this.config.minSize = newMinSize;
    this.config.maxSize = newMaxSize;

    // If new max is smaller, destroy excess sessions
    if (this.sessions.size > newMaxSize) {
      const excessSessions = Array.from(this.sessions.values())
        .filter(session => !session.inUse)
        .slice(0, this.sessions.size - newMaxSize);

      for (const session of excessSessions) {
        await this.destroySession(session.id);
      }
    }

    // If new min is larger, create additional sessions
    if (this.sessions.size < newMinSize) {
      const additionalSessions = newMinSize - this.sessions.size;

      for (let i = 0; i < additionalSessions; i++) {
        try {
          await this.createNewSession();
        } catch (error) {
          this.logger.warn('Failed to create additional session during resize', { error });
        }
      }
    }

    this.logger.info('Pool resize completed', {
      finalSize: this.sessions.size,
      availableSize: this.availableSessions.size
    });
  }
}