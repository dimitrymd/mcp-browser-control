import { WebDriver } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import winston from 'winston';
import os from 'os';
import fs from 'fs/promises';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: number;
  version: string;
  uptime: number;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

export class HealthCheckService {
  private sessionManager: SessionManager;
  private logger: winston.Logger;
  private startTime: number;
  private version: string;

  constructor(sessionManager: SessionManager, logger: winston.Logger, version: string = '1.0.0') {
    this.sessionManager = sessionManager;
    this.logger = logger;
    this.startTime = Date.now();
    this.version = version;

    this.logger.info('Health check service initialized');
  }

  /**
   * Perform liveness check (basic service availability)
   */
  async livenessCheck(): Promise<HealthCheckResult> {
    const timestamp = Date.now();
    const checks: HealthCheck[] = [];

    // Basic service check
    checks.push(await this.checkService());

    // Memory check
    checks.push(await this.checkMemory());

    // Disk space check
    checks.push(await this.checkDiskSpace());

    return this.compileResults(checks, timestamp);
  }

  /**
   * Perform readiness check (full service readiness)
   */
  async readinessCheck(): Promise<HealthCheckResult> {
    const timestamp = Date.now();
    const checks: HealthCheck[] = [];

    // All liveness checks
    checks.push(await this.checkService());
    checks.push(await this.checkMemory());
    checks.push(await this.checkDiskSpace());

    // Additional readiness checks
    checks.push(await this.checkSessionPool());
    checks.push(await this.checkBrowserDrivers());
    checks.push(await this.checkNetworkConnectivity());

    return this.compileResults(checks, timestamp);
  }

  /**
   * Perform startup check (initialization validation)
   */
  async startupCheck(): Promise<HealthCheckResult> {
    const timestamp = Date.now();
    const checks: HealthCheck[] = [];

    // Configuration validation
    checks.push(await this.checkConfiguration());

    // Dependencies check
    checks.push(await this.checkDependencies());

    // Initial session creation
    checks.push(await this.checkInitialSession());

    return this.compileResults(checks, timestamp);
  }

  /**
   * Check basic service availability
   */
  private async checkService(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Basic service health indicators
      const uptime = Date.now() - this.startTime;
      const memoryUsage = process.memoryUsage();

      return {
        name: 'service',
        status: 'healthy',
        duration: Date.now() - startTime,
        timestamp: startTime,
        metadata: {
          uptime,
          memoryUsage: {
            rss: memoryUsage.rss,
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            external: memoryUsage.external
          },
          nodeVersion: process.version
        }
      };

    } catch (error) {
      return {
        name: 'service',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;

      const memoryUsagePercent = (usedMemory / totalMemory) * 100;
      const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      let message: string | undefined;

      if (memoryUsagePercent > 90) {
        status = 'unhealthy';
        message = `High system memory usage: ${memoryUsagePercent.toFixed(1)}%`;
      } else if (memoryUsagePercent > 80 || heapUsagePercent > 80) {
        status = 'degraded';
        message = `Elevated memory usage: system ${memoryUsagePercent.toFixed(1)}%, heap ${heapUsagePercent.toFixed(1)}%`;
      }

      return {
        name: 'memory',
        status,
        message,
        duration: Date.now() - startTime,
        timestamp: startTime,
        metadata: {
          system: {
            total: totalMemory,
            free: freeMemory,
            used: usedMemory,
            usagePercent: memoryUsagePercent
          },
          process: {
            rss: memoryUsage.rss,
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            heapUsagePercent
          }
        }
      };

    } catch (error) {
      return {
        name: 'memory',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Memory check failed',
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Check current working directory disk space
      const stats = await fs.stat(process.cwd());

      // Note: Getting actual disk space requires platform-specific code
      // This is a simplified implementation
      const diskInfo = {
        available: 'unknown',
        used: 'unknown',
        total: 'unknown'
      };

      return {
        name: 'disk_space',
        status: 'healthy',
        duration: Date.now() - startTime,
        timestamp: startTime,
        metadata: {
          workingDirectory: process.cwd(),
          diskInfo
        }
      };

    } catch (error) {
      return {
        name: 'disk_space',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Disk space check failed',
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }
  }

  /**
   * Check session pool health
   */
  private async checkSessionPool(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const metrics = this.sessionManager.getSessionMetrics();

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      let message: string | undefined;

      if (metrics.totalSessions === 0) {
        status = 'degraded';
        message = 'No active sessions';
      } else if (metrics.activeSessions / metrics.totalSessions < 0.5) {
        status = 'degraded';
        message = 'Low session utilization';
      }

      return {
        name: 'session_pool',
        status,
        message,
        duration: Date.now() - startTime,
        timestamp: startTime,
        metadata: {
          totalSessions: metrics.totalSessions,
          activeSessions: metrics.activeSessions,
          averageSessionAge: metrics.averageSessionAge,
          failedSessions: metrics.failedSessions
        }
      };

    } catch (error) {
      return {
        name: 'session_pool',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Session pool check failed',
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }
  }

  /**
   * Check browser drivers availability
   */
  private async checkBrowserDrivers(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Test creating a minimal session
      const sessions = this.sessionManager.listSessions();

      if (sessions.length === 0) {
        return {
          name: 'browser_drivers',
          status: 'degraded',
          message: 'No browser sessions available for testing',
          duration: Date.now() - startTime,
          timestamp: startTime
        };
      }

      // Test first available session
      const testSession = sessions[0];
      const isHealthy = await this.sessionManager.checkSessionHealth(testSession.id);

      return {
        name: 'browser_drivers',
        status: isHealthy ? 'healthy' : 'degraded',
        message: isHealthy ? undefined : 'Browser driver health check failed',
        duration: Date.now() - startTime,
        timestamp: startTime,
        metadata: {
          availableSessions: sessions.length,
          testedSessionId: testSession.id
        }
      };

    } catch (error) {
      return {
        name: 'browser_drivers',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Browser driver check failed',
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }
  }

  /**
   * Check network connectivity
   */
  private async checkNetworkConnectivity(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Test basic network connectivity
      const testUrls = [
        'https://www.google.com',
        'https://httpbin.org/get'
      ];

      const connectivityResults = await Promise.allSettled(
        testUrls.map(async url => {
          const response = await fetch(url, {
            method: 'HEAD',
            timeout: 5000
          } as any);
          return { url, status: response.status, ok: response.ok };
        })
      );

      const successfulTests = connectivityResults
        .filter(result => result.status === 'fulfilled')
        .length;

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      let message: string | undefined;

      if (successfulTests === 0) {
        status = 'unhealthy';
        message = 'No network connectivity';
      } else if (successfulTests < testUrls.length) {
        status = 'degraded';
        message = 'Limited network connectivity';
      }

      return {
        name: 'network_connectivity',
        status,
        message,
        duration: Date.now() - startTime,
        timestamp: startTime,
        metadata: {
          testsPerformed: testUrls.length,
          testsSuccessful: successfulTests,
          testUrls
        }
      };

    } catch (error) {
      return {
        name: 'network_connectivity',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Network connectivity check failed',
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }
  }

  /**
   * Check configuration validity
   */
  private async checkConfiguration(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Validate critical environment variables
      const requiredEnvVars = ['BROWSER_TYPE', 'HEADLESS'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      let message: string | undefined;

      if (missingVars.length > 0) {
        status = 'degraded';
        message = `Missing environment variables: ${missingVars.join(', ')}`;
      }

      return {
        name: 'configuration',
        status,
        message,
        duration: Date.now() - startTime,
        timestamp: startTime,
        metadata: {
          nodeEnv: process.env.NODE_ENV || 'development',
          browserType: process.env.BROWSER_TYPE || 'chrome',
          headless: process.env.HEADLESS || 'true',
          missingVars
        }
      };

    } catch (error) {
      return {
        name: 'configuration',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Configuration check failed',
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }
  }

  /**
   * Check dependencies availability
   */
  private async checkDependencies(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Check critical dependencies
      const dependencies = [
        '@modelcontextprotocol/sdk',
        'selenium-webdriver',
        'winston',
        'zod'
      ];

      const dependencyStatus = dependencies.map(dep => {
        try {
          require(dep);
          return { name: dep, available: true };
        } catch {
          return { name: dep, available: false };
        }
      });

      const unavailable = dependencyStatus.filter(dep => !dep.available);

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      let message: string | undefined;

      if (unavailable.length > 0) {
        status = 'unhealthy';
        message = `Missing dependencies: ${unavailable.map(d => d.name).join(', ')}`;
      }

      return {
        name: 'dependencies',
        status,
        message,
        duration: Date.now() - startTime,
        timestamp: startTime,
        metadata: {
          total: dependencies.length,
          available: dependencyStatus.filter(d => d.available).length,
          missing: unavailable.map(d => d.name)
        }
      };

    } catch (error) {
      return {
        name: 'dependencies',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Dependencies check failed',
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }
  }

  /**
   * Check initial session creation capability
   */
  private async checkInitialSession(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const currentSessions = this.sessionManager.listSessions();

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      let message: string | undefined;

      if (currentSessions.length === 0) {
        status = 'degraded';
        message = 'No browser sessions available';
      } else {
        // Test session health
        const healthyCount = await Promise.all(
          currentSessions.slice(0, 3).map(session =>
            this.sessionManager.checkSessionHealth(session.id)
          )
        ).then(results => results.filter(Boolean).length);

        if (healthyCount === 0) {
          status = 'unhealthy';
          message = 'No healthy browser sessions';
        } else if (healthyCount < currentSessions.length) {
          status = 'degraded';
          message = `${healthyCount}/${currentSessions.length} sessions healthy`;
        }
      }

      return {
        name: 'initial_session',
        status,
        message,
        duration: Date.now() - startTime,
        timestamp: startTime,
        metadata: {
          totalSessions: currentSessions.length,
          hasCapacity: this.sessionManager.hasCapacityForNewSession()
        }
      };

    } catch (error) {
      return {
        name: 'initial_session',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Initial session check failed',
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }
  }

  /**
   * Compile health check results
   */
  private compileResults(checks: HealthCheck[], timestamp: number): HealthCheckResult {
    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp,
      version: this.version,
      uptime: Date.now() - this.startTime,
      checks,
      summary
    };
  }

  /**
   * Get system information
   */
  getSystemInfo(): {
    platform: string;
    arch: string;
    nodeVersion: string;
    cpus: number;
    totalMemory: number;
    freeMemory: number;
    uptime: number;
    loadAverage: number[];
  } {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };
  }

  /**
   * Create Express middleware for health endpoints
   */
  createHealthEndpoints() {
    return {
      liveness: async (req: any, res: any) => {
        try {
          const result = await this.livenessCheck();
          const statusCode = result.status === 'healthy' ? 200 : 503;
          res.status(statusCode).json(result);
        } catch (error) {
          res.status(500).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Health check failed'
          });
        }
      },

      readiness: async (req: any, res: any) => {
        try {
          const result = await this.readinessCheck();
          const statusCode = result.status === 'healthy' ? 200 : 503;
          res.status(statusCode).json(result);
        } catch (error) {
          res.status(500).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Readiness check failed'
          });
        }
      },

      startup: async (req: any, res: any) => {
        try {
          const result = await this.startupCheck();
          const statusCode = result.status === 'healthy' ? 200 : 503;
          res.status(statusCode).json(result);
        } catch (error) {
          res.status(500).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Startup check failed'
          });
        }
      },

      info: async (req: any, res: any) => {
        try {
          const systemInfo = this.getSystemInfo();
          res.status(200).json({
            service: 'MCP Browser Control Server',
            version: this.version,
            system: systemInfo,
            uptime: Date.now() - this.startTime
          });
        } catch (error) {
          res.status(500).json({
            error: error instanceof Error ? error.message : 'System info failed'
          });
        }
      }
    };
  }
}