import { z } from 'zod';
import { ValidationError } from './errors.js';

// URL validation schema
const urlSchema = z.string().url().refine(
  (url) => {
    const parsed = new URL(url);
    // Prevent file:// and other potentially dangerous protocols
    return ['http:', 'https:'].includes(parsed.protocol);
  },
  {
    message: 'Only HTTP and HTTPS URLs are allowed'
  }
);

// Wait condition schema
const waitConditionSchema = z.enum(['load', 'domcontentloaded']);

// Timeout schema (1 second to 5 minutes)
const timeoutSchema = z.number().int().min(1000).max(300000);

// Navigation tool schemas
export const navigateToSchema = z.object({
  url: urlSchema,
  waitUntil: waitConditionSchema.optional().default('load'),
  timeout: timeoutSchema.optional().default(30000)
});

export const refreshSchema = z.object({
  hard: z.boolean().optional().default(false)
});

// Sprint 2 validation schemas
export const clickSchema = z.object({
  selector: z.string().min(1),
  clickType: z.enum(['left', 'right', 'middle', 'double']).optional().default('left'),
  waitForElement: z.boolean().optional().default(true),
  timeout: timeoutSchema.optional().default(10000),
  scrollIntoView: z.boolean().optional().default(true)
});

export const typeTextSchema = z.object({
  selector: z.string().min(1),
  text: z.string(),
  clear: z.boolean().optional().default(false),
  delay: z.number().int().min(0).optional().default(0),
  pressEnter: z.boolean().optional().default(false)
});

export const selectDropdownSchema = z.object({
  selector: z.string().min(1),
  value: z.string().optional(),
  text: z.string().optional(),
  index: z.number().int().min(0).optional()
}).refine(
  (data) => data.value !== undefined || data.text !== undefined || data.index !== undefined,
  { message: 'Must provide one of: value, text, or index' }
);

export const hoverSchema = z.object({
  selector: z.string().min(1),
  duration: z.number().int().min(0).optional().default(1000),
  offset: z.object({
    x: z.number(),
    y: z.number()
  }).optional()
});

export const scrollToSchema = z.object({
  selector: z.string().min(1).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  behavior: z.enum(['auto', 'smooth']).optional().default('smooth')
}).refine(
  (data) => data.selector !== undefined || data.x !== undefined || data.y !== undefined,
  { message: 'Must provide either selector or coordinates (x, y)' }
);

export const getPageContentSchema = z.object({
  format: z.enum(['html', 'text', 'markdown']),
  selector: z.string().min(1).optional(),
  includeHidden: z.boolean().optional().default(false)
});

export const getElementTextSchema = z.object({
  selector: z.string().min(1),
  all: z.boolean().optional().default(false),
  trim: z.boolean().optional().default(true)
});

export const getElementAttributeSchema = z.object({
  selector: z.string().min(1),
  attribute: z.string().min(1),
  all: z.boolean().optional().default(false)
});

export const takeScreenshotSchema = z.object({
  fullPage: z.boolean().optional().default(false),
  selector: z.string().min(1).optional(),
  format: z.enum(['png', 'jpeg', 'base64']).optional().default('png'),
  quality: z.number().int().min(0).max(100).optional(),
  path: z.string().optional()
});

export const waitForElementSchema = z.object({
  selector: z.string().min(1),
  condition: z.enum(['present', 'visible', 'clickable', 'hidden', 'removed']),
  timeout: timeoutSchema.optional().default(10000)
});

export const waitForTextSchema = z.object({
  text: z.string().min(1),
  selector: z.string().min(1).optional(),
  exact: z.boolean().optional().default(false),
  timeout: timeoutSchema.optional().default(10000)
});

export const elementExistsSchema = z.object({
  selector: z.string().min(1),
  visible: z.boolean().optional().default(false)
});

// Server configuration schema
export const serverConfigSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  selenium: z.object({
    gridUrl: z.string().url().optional(),
    browserType: z.enum(['chrome', 'firefox']),
    headless: z.boolean()
  }),
  session: z.object({
    maxConcurrent: z.number().int().min(1).max(100),
    timeout: z.number().int().min(60000).max(3600000) // 1 minute to 1 hour
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']),
    file: z.string().optional(),
    console: z.boolean()
  })
});

// Session ID schema
export const sessionIdSchema = z.string().uuid();

// Generic validation function
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fieldName: string = 'input'
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      const fieldPath = firstError?.path.join('.') || fieldName;
      const message = `Validation failed for ${fieldPath}: ${firstError?.message || 'Invalid format'}`;

      throw new ValidationError(
        message,
        fieldPath,
        data,
        error
      );
    }
    throw error;
  }
}

// Specific validation functions
export function validateNavigateToParams(params: unknown) {
  return validateInput(navigateToSchema, params, 'navigateToParams');
}

export function validateRefreshParams(params: unknown) {
  return validateInput(refreshSchema, params, 'refreshParams');
}

export function validateServerConfig(config: unknown) {
  return validateInput(serverConfigSchema, config, 'serverConfig');
}

export function validateSessionId(sessionId: unknown): string {
  return validateInput(sessionIdSchema, sessionId, 'sessionId');
}

// URL safety validation
export function validateUrlSafety(url: string): void {
  try {
    const parsed = new URL(url);

    // Check protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new ValidationError(
        `Unsafe protocol: ${parsed.protocol}. Only HTTP and HTTPS are allowed.`,
        'url.protocol',
        parsed.protocol
      );
    }

    // Check for localhost/internal IPs if needed (can be made configurable)
    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    const isPrivateNetwork = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/.test(hostname);

    // For now, we allow localhost and private networks for development
    // In production, you might want to make this configurable

  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'url',
      url,
      error instanceof Error ? error : undefined
    );
  }
}

// Sanitization functions
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .slice(0, maxLength)
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
    .trim();
}

export function sanitizeTimeout(timeout: number | undefined, defaultValue: number, max: number = 300000): number {
  if (typeof timeout !== 'number' || isNaN(timeout)) {
    return defaultValue;
  }

  return Math.max(1000, Math.min(timeout, max));
}

// Environment variable validation
export function validateEnvironmentConfig(): {
  browserType: 'chrome' | 'firefox';
  headless: boolean;
  maxConcurrent: number;
  sessionTimeout: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
} {
  const browserType = process.env.BROWSER_TYPE as 'chrome' | 'firefox' || 'chrome';
  if (!['chrome', 'firefox'].includes(browserType)) {
    throw new ValidationError(
      'Invalid BROWSER_TYPE environment variable. Must be "chrome" or "firefox".',
      'BROWSER_TYPE',
      browserType
    );
  }

  const headless = process.env.HEADLESS !== 'false'; // Default to true
  const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10);
  const sessionTimeout = parseInt(process.env.SESSION_TIMEOUT || '600000', 10); // 10 minutes default
  const logLevel = (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info';

  if (isNaN(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 100) {
    throw new ValidationError(
      'Invalid MAX_CONCURRENT_SESSIONS. Must be a number between 1 and 100.',
      'MAX_CONCURRENT_SESSIONS',
      process.env.MAX_CONCURRENT_SESSIONS
    );
  }

  if (isNaN(sessionTimeout) || sessionTimeout < 60000 || sessionTimeout > 3600000) {
    throw new ValidationError(
      'Invalid SESSION_TIMEOUT. Must be a number between 60000 (1 minute) and 3600000 (1 hour).',
      'SESSION_TIMEOUT',
      process.env.SESSION_TIMEOUT
    );
  }

  if (!['error', 'warn', 'info', 'debug'].includes(logLevel)) {
    throw new ValidationError(
      'Invalid LOG_LEVEL. Must be one of: error, warn, info, debug.',
      'LOG_LEVEL',
      logLevel
    );
  }

  return {
    browserType,
    headless,
    maxConcurrent,
    sessionTimeout,
    logLevel
  };
}