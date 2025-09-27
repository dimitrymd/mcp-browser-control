import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { RateLimiterMemory } from 'rate-limiter-flexible';

export interface AuthConfig {
  enabled: boolean;
  providers: Array<'apiKey' | 'jwt' | 'oauth'>;
  apiKeys?: Array<{
    key: string;
    name: string;
    permissions: string[];
    rateLimit?: number;
  }>;
  jwt?: {
    secret: string;
    issuer: string;
    audience: string;
    expiresIn: string;
  };
  ipWhitelist?: string[];
  ipBlacklist?: string[];
  maxRequestsPerMinute?: number;
  requireHttps?: boolean;
}

export interface AuthContext {
  userId?: string;
  apiKeyName?: string;
  permissions: string[];
  rateLimit?: number;
  ipAddress: string;
  userAgent: string;
  authenticated: boolean;
}

export class AuthenticationMiddleware {
  private config: AuthConfig;
  private logger: winston.Logger;
  private rateLimiters: Map<string, RateLimiterMemory> = new Map();
  private globalRateLimiter?: RateLimiterMemory;

  constructor(config: AuthConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;

    // Set up global rate limiter
    if (config.maxRequestsPerMinute) {
      this.globalRateLimiter = new RateLimiterMemory({
        points: config.maxRequestsPerMinute,
        duration: 60, // 1 minute
        blockDuration: 60 // Block for 1 minute
      });
    }

    // Set up per-API key rate limiters
    if (config.apiKeys) {
      config.apiKeys.forEach(apiKey => {
        if (apiKey.rateLimit) {
          this.rateLimiters.set(apiKey.key, new RateLimiterMemory({
            points: apiKey.rateLimit,
            duration: 60,
            blockDuration: 60
          }));
        }
      });
    }

    this.logger.info('Authentication middleware initialized', {
      enabled: config.enabled,
      providers: config.providers,
      apiKeysCount: config.apiKeys?.length || 0,
      hasJWT: !!config.jwt,
      ipWhitelist: config.ipWhitelist?.length || 0,
      ipBlacklist: config.ipBlacklist?.length || 0
    });
  }

  /**
   * Main authentication middleware
   */
  async authenticate(req: any, res: any, next: NextFunction): Promise<void> {
    const startTime = Date.now();

    try {
      // Skip authentication if disabled
      if (!this.config.enabled) {
        req.authContext = this.createUnauthenticatedContext(req);
        return next();
      }

      // HTTPS enforcement
      if (this.config.requireHttps && req.protocol !== 'https') {
        this.logger.warn('HTTPS required but request is HTTP', {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return this.sendError(res, 400, 'HTTPS required');
      }

      // IP filtering
      const ipCheckResult = this.checkIPAccess(req.ip);
      if (!ipCheckResult.allowed) {
        this.logger.warn('IP access denied', {
          ip: req.ip,
          reason: ipCheckResult.reason
        });
        return this.sendError(res, 403, 'IP access denied');
      }

      // Global rate limiting
      if (this.globalRateLimiter) {
        try {
          await this.globalRateLimiter.consume(req.ip);
        } catch (rateLimitError) {
          this.logger.warn('Global rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          return this.sendError(res, 429, 'Rate limit exceeded');
        }
      }

      // Try authentication providers in order
      let authContext: AuthContext | null = null;

      for (const provider of this.config.providers) {
        switch (provider) {
          case 'apiKey':
            authContext = await this.authenticateApiKey(req);
            break;
          case 'jwt':
            authContext = await this.authenticateJWT(req);
            break;
          case 'oauth':
            authContext = await this.authenticateOAuth(req);
            break;
        }

        if (authContext && authContext.authenticated) {
          break;
        }
      }

      if (!authContext || !authContext.authenticated) {
        this.logger.warn('Authentication failed', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          providers: this.config.providers
        });
        return this.sendError(res, 401, 'Authentication required');
      }

      // Check per-user rate limiting
      if (authContext.rateLimit && authContext.userId) {
        const userRateLimiter = this.rateLimiters.get(authContext.userId);
        if (userRateLimiter) {
          try {
            await userRateLimiter.consume(authContext.userId);
          } catch (rateLimitError) {
            this.logger.warn('User rate limit exceeded', {
              userId: authContext.userId,
              ip: req.ip
            });
            return this.sendError(res, 429, 'User rate limit exceeded');
          }
        }
      }

      // Add auth context to request
      req.authContext = authContext;

      this.logger.debug('Authentication successful', {
        userId: authContext.userId,
        permissions: authContext.permissions.length,
        duration: Date.now() - startTime
      });

      next();

    } catch (error) {
      this.logger.error('Authentication middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        duration: Date.now() - startTime
      });

      return this.sendError(res, 500, 'Authentication system error');
    }
  }

  /**
   * API Key authentication
   */
  private async authenticateApiKey(req: any): Promise<AuthContext | null> {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return null;
    }

    const keyConfig = this.config.apiKeys?.find(config => config.key === apiKey);

    if (!keyConfig) {
      this.logger.warn('Invalid API key provided', {
        ip: req.ip,
        keyPrefix: apiKey.substring(0, 8) + '...'
      });
      return null;
    }

    return {
      userId: keyConfig.name,
      apiKeyName: keyConfig.name,
      permissions: keyConfig.permissions,
      rateLimit: keyConfig.rateLimit,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || '',
      authenticated: true
    };
  }

  /**
   * JWT authentication
   */
  private async authenticateJWT(req: any): Promise<AuthContext | null> {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    if (!this.config.jwt) {
      return null;
    }

    try {
      const decoded = jwt.verify(token, this.config.jwt.secret, {
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience
      }) as any;

      return {
        userId: decoded.sub || decoded.userId,
        permissions: decoded.permissions || [],
        rateLimit: decoded.rateLimit,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        authenticated: true
      };

    } catch (error) {
      this.logger.warn('JWT verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });
      return null;
    }
  }

  /**
   * OAuth authentication (placeholder)
   */
  private async authenticateOAuth(req: any): Promise<AuthContext | null> {
    // OAuth implementation would go here
    // For now, return null (not implemented)
    return null;
  }

  /**
   * Check IP access permissions
   */
  private checkIPAccess(ip: string): { allowed: boolean; reason?: string } {
    // Check blacklist first
    if (this.config.ipBlacklist && this.config.ipBlacklist.length > 0) {
      for (const blacklistedIP of this.config.ipBlacklist) {
        if (this.matchIPPattern(ip, blacklistedIP)) {
          return { allowed: false, reason: 'IP blacklisted' };
        }
      }
    }

    // Check whitelist if configured
    if (this.config.ipWhitelist && this.config.ipWhitelist.length > 0) {
      let whitelisted = false;
      for (const whitelistedIP of this.config.ipWhitelist) {
        if (this.matchIPPattern(ip, whitelistedIP)) {
          whitelisted = true;
          break;
        }
      }

      if (!whitelisted) {
        return { allowed: false, reason: 'IP not whitelisted' };
      }
    }

    return { allowed: true };
  }

  /**
   * Match IP against pattern (supports CIDR and wildcards)
   */
  private matchIPPattern(ip: string, pattern: string): boolean {
    // Exact match
    if (ip === pattern) {
      return true;
    }

    // Wildcard match (simple implementation)
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*');
      return new RegExp(`^${regexPattern}$`).test(ip);
    }

    // CIDR match (simplified - would use proper CIDR library in production)
    if (pattern.includes('/')) {
      // For now, return false for CIDR (would implement proper CIDR matching)
      return false;
    }

    return false;
  }

  /**
   * Create unauthenticated context
   */
  private createUnauthenticatedContext(req: any): AuthContext {
    return {
      permissions: ['*'], // Full access when auth is disabled
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || '',
      authenticated: false
    };
  }

  /**
   * Send error response
   */
  private sendError(res: any, status: number, message: string): void {
    res.status(status).json({
      error: {
        code: `AUTH_${status}`,
        message,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Generate JWT token
   */
  generateJWT(payload: any): string {
    if (!this.config.jwt) {
      throw new Error('JWT configuration not available');
    }

    return jwt.sign(payload, this.config.jwt.secret, {
      issuer: this.config.jwt.issuer,
      audience: this.config.jwt.audience,
      expiresIn: this.config.jwt.expiresIn
    });
  }

  /**
   * Generate API key
   */
  generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate API key format
   */
  validateApiKey(key: string): boolean {
    return typeof key === 'string' && key.length >= 32 && /^[a-f0-9]+$/.test(key);
  }

  /**
   * Get authentication statistics
   */
  getStats(): {
    totalRequests: number;
    authenticatedRequests: number;
    failedAuthentications: number;
    rateLimitHits: number;
    ipBlocks: number;
  } {
    // In a real implementation, these would be tracked
    return {
      totalRequests: 0,
      authenticatedRequests: 0,
      failedAuthentications: 0,
      rateLimitHits: 0,
      ipBlocks: 0
    };
  }
}