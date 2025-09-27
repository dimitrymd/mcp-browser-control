#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import winston from 'winston';

import { WebDriverManager } from './drivers/manager.js';
import { SessionManager } from './drivers/session.js';
import { createToolRegistry, toolDefinitions, executeTool } from './tools/index.js';
import { ServerConfig, DriverOptions } from './types/index.js';
import { validateEnvironmentConfig, validateServerConfig } from './utils/validation.js';
import { createErrorResponse } from './utils/errors.js';

// Load environment variables
dotenv.config();

class MCPBrowserControlServer {
  private server: Server;
  private logger!: winston.Logger;
  private driverManager!: WebDriverManager;
  private sessionManager!: SessionManager;
  private toolRegistry: any;
  private config!: ServerConfig;

  constructor() {
    this.initializeLogger();
    this.initializeConfig();
    this.server = new Server(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.driverManager = new WebDriverManager(this.logger);
    this.sessionManager = new SessionManager(
      this.driverManager,
      this.logger,
      this.config.session.maxConcurrent,
      this.config.session.timeout
    );
    this.toolRegistry = createToolRegistry(this.sessionManager, this.logger);

    this.setupHandlers();
  }

  private initializeLogger(): void {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const logToFile = process.env.LOG_FILE;

    const transports: winston.transport[] = [];

    // Console transport
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${level}] ${message} ${metaStr}`;
          })
        ),
      })
    );

    // File transport if specified
    if (logToFile) {
      transports.push(
        new winston.transports.File({
          filename: logToFile,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    this.logger = winston.createLogger({
      level: logLevel,
      transports,
      exitOnError: false,
    });

    this.logger.info('Logger initialized', { level: logLevel, fileLogging: !!logToFile });
  }

  private initializeConfig(): void {
    try {
      const envConfig = validateEnvironmentConfig();

      this.config = {
        name: 'mcp-browser-control',
        version: '1.0.0',
        selenium: {
          ...(process.env.SELENIUM_GRID_URL && { gridUrl: process.env.SELENIUM_GRID_URL }),
          browserType: envConfig.browserType,
          headless: envConfig.headless,
        },
        session: {
          maxConcurrent: envConfig.maxConcurrent,
          timeout: envConfig.sessionTimeout,
        },
        logging: {
          level: envConfig.logLevel,
          ...(process.env.LOG_FILE && { file: process.env.LOG_FILE }),
          console: true,
        },
      };

      // Validate the complete configuration
      validateServerConfig(this.config);

      this.logger?.info('Configuration initialized', this.config);
    } catch (error) {
      console.error('Failed to initialize configuration:', error);
      process.exit(1);
    }
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Listing available tools');

      const tools: Tool[] = toolDefinitions.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return { tools };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      this.logger.info('Executing tool', { name, args });

      try {
        // Execute tool using unified handler
        const result = await executeTool(name, args || {}, this.toolRegistry);

        this.logger.info('Tool executed successfully', { name, status: result.status });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        this.logger.error('Tool execution failed', { name, args, error });

        const errorResponse = createErrorResponse(error instanceof Error ? error : new Error('Unknown error'));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(errorResponse, null, 2),
            },
          ],
          isError: true,
        };
      }
    });

    // Setup cleanup handlers
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error });
      this.shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', { reason, promise });
    });
  }

  async start(): Promise<void> {
    try {
      this.logger.info('Starting MCP Browser Control Server', {
        version: this.config.version,
        browserType: this.config.selenium.browserType,
        headless: this.config.selenium.headless,
        maxSessions: this.config.session.maxConcurrent
      });

      // Create a default session for testing (optional)
      if (process.env.CREATE_DEFAULT_SESSION === 'true') {
        await this.createDefaultSession();
      }

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      this.logger.info('MCP Browser Control Server started successfully');
    } catch (error) {
      this.logger.error('Failed to start server', { error });
      throw error;
    }
  }

  private async createDefaultSession(): Promise<void> {
    try {
      const driverOptions: DriverOptions = {
        headless: this.config.selenium.headless,
        windowSize: { width: 1920, height: 1080 },
      };

      const sessionId = await this.sessionManager.createSession(
        this.config.selenium.browserType,
        driverOptions
      );

      this.logger.info('Default session created', { sessionId });
    } catch (error) {
      this.logger.warn('Failed to create default session', { error });
      // Don't fail startup if default session creation fails
    }
  }

  private async shutdown(signal: string): Promise<void> {
    this.logger.info('Shutting down server', { signal });

    try {
      // Close all browser sessions
      await this.sessionManager.shutdown();

      // Close MCP server
      await this.server.close();

      this.logger.info('Server shutdown complete');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }

  // Health check method
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      sessions: any;
      timestamp: number;
    };
  }> {
    try {
      const metrics = this.sessionManager.getSessionMetrics();

      return {
        status: 'healthy',
        details: {
          sessions: metrics,
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      this.logger.error('Health check failed', { error });

      return {
        status: 'unhealthy',
        details: {
          sessions: null,
          timestamp: Date.now(),
        },
      };
    }
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    const server = new MCPBrowserControlServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start MCP Browser Control Server:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default MCPBrowserControlServer;