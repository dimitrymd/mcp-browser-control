import { URL } from 'url';
import path from 'path';
import crypto from 'crypto';
import { ValidationError } from '../utils/errors.js';

/**
 * Enhanced input sanitization for production security
 */

export interface SanitizationOptions {
  allowedProtocols?: string[];
  allowedDomains?: string[];
  maxLength?: number;
  allowHTML?: boolean;
  allowScripts?: boolean;
}

/**
 * Comprehensive URL validation and sanitization
 */
export function sanitizeAndValidateURL(
  url: string,
  options: SanitizationOptions = {}
): string {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('URL must be a non-empty string', 'url', url);
  }

  const {
    allowedProtocols = ['http:', 'https:'],
    allowedDomains = [],
    maxLength = 2048
  } = options;

  // Length check
  if (url.length > maxLength) {
    throw new ValidationError(
      `URL exceeds maximum length of ${maxLength} characters`,
      'url',
      url.length
    );
  }

  let parsedURL: URL;
  try {
    parsedURL = new URL(url);
  } catch (error) {
    throw new ValidationError(
      'Invalid URL format',
      'url',
      url
    );
  }

  // Protocol validation
  if (!allowedProtocols.includes(parsedURL.protocol)) {
    throw new ValidationError(
      `Protocol ${parsedURL.protocol} not allowed. Allowed: ${allowedProtocols.join(', ')}`,
      'url.protocol',
      parsedURL.protocol
    );
  }

  // Domain validation
  if (allowedDomains.length > 0) {
    const hostname = parsedURL.hostname.toLowerCase();
    const domainAllowed = allowedDomains.some(domain => {
      if (domain.startsWith('*.')) {
        // Wildcard subdomain
        const baseDomain = domain.substring(2);
        return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
      }
      return hostname === domain.toLowerCase();
    });

    if (!domainAllowed) {
      throw new ValidationError(
        `Domain ${hostname} not allowed`,
        'url.domain',
        hostname
      );
    }
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'ftp:'
  ];

  const lowerURL = url.toLowerCase();
  for (const pattern of dangerousPatterns) {
    if (lowerURL.includes(pattern)) {
      throw new ValidationError(
        `URL contains dangerous pattern: ${pattern}`,
        'url',
        url
      );
    }
  }

  return parsedURL.toString();
}

/**
 * Enhanced JavaScript code sanitization
 */
export function sanitizeJavaScriptCode(
  code: string,
  options: SanitizationOptions = {}
): string {
  if (!code || typeof code !== 'string') {
    return '';
  }

  const {
    maxLength = 10000,
    allowScripts = false
  } = options;

  // Length check
  if (code.length > maxLength) {
    throw new ValidationError(
      `Script exceeds maximum length of ${maxLength} characters`,
      'script',
      code.length
    );
  }

  let sanitized = code;

  if (!allowScripts) {
    // Remove dangerous JavaScript patterns
    const dangerousPatterns = [
      // eval and Function constructor
      { pattern: /\beval\s*\(/gi, replacement: '// eval(' },
      { pattern: /new\s+Function\s*\(/gi, replacement: '// new Function(' },

      // Window manipulation
      { pattern: /window\.(location|document)\s*=/gi, replacement: '// window.$1 =' },
      { pattern: /document\.write\s*\(/gi, replacement: '// document.write(' },
      { pattern: /document\.writeln\s*\(/gi, replacement: '// document.writeln(' },

      // DOM manipulation that could be dangerous
      { pattern: /innerHTML\s*=/gi, replacement: '// innerHTML =' },
      { pattern: /outerHTML\s*=/gi, replacement: '// outerHTML =' },

      // Event handlers
      { pattern: /on\w+\s*=/gi, replacement: '// $&' },

      // Script tags
      { pattern: /<script[^>]*>[\s\S]*?<\/script>/gi, replacement: '<!-- script removed -->' },

      // Network requests that could be dangerous
      { pattern: /fetch\s*\(/gi, replacement: '// fetch(' },
      { pattern: /XMLHttpRequest\s*\(/gi, replacement: '// XMLHttpRequest(' },

      // File system access
      { pattern: /require\s*\(/gi, replacement: '// require(' },
      { pattern: /import\s+/gi, replacement: '// import ' },

      // Process manipulation
      { pattern: /process\./gi, replacement: '// process.' },
      { pattern: /global\./gi, replacement: '// global.' }
    ];

    dangerousPatterns.forEach(({ pattern, replacement }) => {
      sanitized = sanitized.replace(pattern, replacement);
    });
  }

  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized.trim();
}

/**
 * Enhanced CSS selector validation and sanitization
 */
export function sanitizeSelector(selector: string): string {
  if (!selector || typeof selector !== 'string') {
    throw new ValidationError('Selector must be a non-empty string', 'selector', selector);
  }

  // Length check
  if (selector.length > 1000) {
    throw new ValidationError(
      'Selector exceeds maximum length of 1000 characters',
      'selector',
      selector.length
    );
  }

  // Remove potentially dangerous characters
  const sanitized = selector
    // Remove script tags
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove null bytes
    .replace(/\x00/g, '')
    // Trim whitespace
    .trim();

  // Validate basic selector syntax
  if (!this.isValidSelector(sanitized)) {
    throw new ValidationError(
      'Invalid selector syntax',
      'selector',
      sanitized
    );
  }

  return sanitized;
}

/**
 * File path validation and sanitization
 */
export function sanitizeFilePath(
  filePath: string,
  options: { allowedExtensions?: string[]; basePath?: string } = {}
): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new ValidationError('File path must be a non-empty string', 'filePath', filePath);
  }

  const { allowedExtensions = [], basePath } = options;

  // Normalize path
  const normalized = path.normalize(filePath);

  // Check for path traversal
  if (normalized.includes('..') || normalized.includes('~')) {
    throw new ValidationError(
      'Path traversal not allowed',
      'filePath',
      normalized
    );
  }

  // Check for absolute paths (if base path is specified)
  if (basePath && path.isAbsolute(normalized)) {
    throw new ValidationError(
      'Absolute paths not allowed',
      'filePath',
      normalized
    );
  }

  // Validate extension
  if (allowedExtensions.length > 0) {
    const ext = path.extname(normalized).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new ValidationError(
        `File extension ${ext} not allowed. Allowed: ${allowedExtensions.join(', ')}`,
        'filePath.extension',
        ext
      );
    }
  }

  // Check for dangerous file names
  const dangerousNames = [
    '.htaccess',
    '.htpasswd',
    'web.config',
    'wp-config.php',
    '.env',
    '.git',
    'package.json',
    'node_modules'
  ];

  const fileName = path.basename(normalized).toLowerCase();
  if (dangerousNames.includes(fileName)) {
    throw new ValidationError(
      `File name ${fileName} not allowed`,
      'filePath',
      fileName
    );
  }

  return normalized;
}

/**
 * HTML content sanitization for XSS prevention
 */
export function sanitizeHTML(
  html: string,
  options: SanitizationOptions = {}
): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const {
    maxLength = 100000,
    allowHTML = false
  } = options;

  // Length check
  if (html.length > maxLength) {
    throw new ValidationError(
      `HTML content exceeds maximum length of ${maxLength} characters`,
      'html',
      html.length
    );
  }

  if (!allowHTML) {
    // Strip all HTML tags
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  // If HTML is allowed, sanitize dangerous elements and attributes
  let sanitized = html;

  // Remove script tags
  sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove dangerous elements
  const dangerousElements = [
    'script', 'object', 'embed', 'applet', 'meta', 'link', 'style',
    'iframe', 'frame', 'frameset', 'base', 'form'
  ];

  dangerousElements.forEach(element => {
    const regex = new RegExp(`<${element}[^>]*>([\\s\\S]*?)</${element}>`, 'gi');
    sanitized = sanitized.replace(regex, '');

    // Self-closing tags
    const selfClosingRegex = new RegExp(`<${element}[^>]*/>`, 'gi');
    sanitized = sanitized.replace(selfClosingRegex, '');
  });

  // Remove dangerous attributes
  const dangerousAttributes = [
    'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout',
    'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset',
    'javascript:', 'vbscript:', 'data:'
  ];

  dangerousAttributes.forEach(attr => {
    const regex = new RegExp(`\\s${attr}\\s*=\\s*[^\\s>]*`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });

  return sanitized.trim();
}

/**
 * Generic input sanitization
 */
export function sanitizeInput(
  input: any,
  type: 'string' | 'number' | 'boolean' | 'array' | 'object',
  options: SanitizationOptions = {}
): any {
  const { maxLength = 1000 } = options;

  switch (type) {
    case 'string':
      if (typeof input !== 'string') {
        throw new ValidationError(`Expected string, got ${typeof input}`, 'input.type', typeof input);
      }

      if (input.length > maxLength) {
        throw new ValidationError(
          `String exceeds maximum length of ${maxLength}`,
          'input.length',
          input.length
        );
      }

      return input
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .trim();

    case 'number':
      const num = Number(input);
      if (isNaN(num) || !isFinite(num)) {
        throw new ValidationError('Invalid number', 'input', input);
      }
      return num;

    case 'boolean':
      if (typeof input === 'boolean') {
        return input;
      }
      if (typeof input === 'string') {
        const lowerInput = input.toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(lowerInput)) return true;
        if (['false', '0', 'no', 'off'].includes(lowerInput)) return false;
      }
      throw new ValidationError('Invalid boolean value', 'input', input);

    case 'array':
      if (!Array.isArray(input)) {
        throw new ValidationError('Expected array', 'input.type', typeof input);
      }
      if (input.length > 1000) {
        throw new ValidationError('Array too large', 'input.length', input.length);
      }
      return input;

    case 'object':
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        throw new ValidationError('Expected object', 'input.type', typeof input);
      }
      if (Object.keys(input).length > 100) {
        throw new ValidationError('Object has too many properties', 'input.properties', Object.keys(input).length);
      }
      return input;

    default:
      throw new ValidationError(`Unknown sanitization type: ${type}`, 'type', type);
  }
}

/**
 * Validate CSS selector syntax (basic)
 */
function isValidSelector(selector: string): boolean {
  try {
    // Test if selector is valid by creating a temporary element
    // and trying to use querySelector (this is a simplified check)

    // Basic syntax validation
    if (!selector.trim()) return false;

    // Check for balanced brackets
    const openBrackets = (selector.match(/\[/g) || []).length;
    const closeBrackets = (selector.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) return false;

    // Check for balanced parentheses
    const openParens = (selector.match(/\(/g) || []).length;
    const closeParens = (selector.match(/\)/g) || []).length;
    if (openParens !== closeParens) return false;

    // Check for dangerous characters
    const dangerousChars = /[<>&{}]/;
    if (dangerousChars.test(selector)) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize user agent string
 */
export function sanitizeUserAgent(userAgent: string): string {
  if (!userAgent || typeof userAgent !== 'string') {
    return '';
  }

  return userAgent
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
    .replace(/[<>&"']/g, '') // Remove HTML special characters
    .slice(0, 500) // Limit length
    .trim();
}

/**
 * Sanitize HTTP headers
 */
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  Object.entries(headers).forEach(([name, value]) => {
    // Validate header name
    if (!/^[a-zA-Z0-9\-_]+$/.test(name)) {
      return; // Skip invalid header names
    }

    // Sanitize header value
    const sanitizedValue = String(value)
      .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
      .replace(/[\r\n]/g, '') // Remove line breaks
      .slice(0, 1000) // Limit length
      .trim();

    if (sanitizedValue) {
      sanitized[name.toLowerCase()] = sanitizedValue;
    }
  });

  return sanitized;
}

/**
 * Sanitize JSON data
 */
export function sanitizeJSON(
  data: any,
  options: { maxDepth?: number; maxProperties?: number } = {}
): any {
  const { maxDepth = 10, maxProperties = 100 } = options;

  function sanitizeRecursive(obj: any, depth: number): any {
    if (depth > maxDepth) {
      throw new ValidationError('JSON object too deeply nested', 'json.depth', depth);
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return obj.slice(0, 10000); // Limit string length
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      if (obj.length > 1000) {
        throw new ValidationError('Array too large', 'json.array.length', obj.length);
      }
      return obj.map(item => sanitizeRecursive(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length > maxProperties) {
        throw new ValidationError('Object has too many properties', 'json.object.properties', keys.length);
      }

      const sanitizedObj: any = {};
      keys.forEach(key => {
        // Sanitize key
        const sanitizedKey = key.replace(/[<>&"']/g, '').slice(0, 100);
        if (sanitizedKey) {
          sanitizedObj[sanitizedKey] = sanitizeRecursive(obj[key], depth + 1);
        }
      });

      return sanitizedObj;
    }

    return String(obj).slice(0, 1000);
  }

  return sanitizeRecursive(data, 0);
}

/**
 * Validate and sanitize configuration data
 */
export function sanitizeConfig(config: any): any {
  if (!config || typeof config !== 'object') {
    throw new ValidationError('Configuration must be an object', 'config', config);
  }

  // Deep clone to avoid mutations
  const sanitized = JSON.parse(JSON.stringify(config));

  // Sanitize sensitive fields
  const sensitiveFields = ['password', 'secret', 'key', 'token', 'apiKey'];

  function sanitizeObjectRecursive(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObjectRecursive);
    }

    const result: any = {};
    Object.entries(obj).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();

      // Mask sensitive values in logs
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        if (typeof value === 'string' && value.length > 0) {
          result[key] = value.substring(0, 4) + '*'.repeat(Math.max(0, value.length - 4));
        } else {
          result[key] = '[REDACTED]';
        }
      } else {
        result[key] = sanitizeObjectRecursive(value);
      }
    });

    return result;
  }

  return sanitizeObjectRecursive(sanitized);
}

/**
 * Generate secure random string
 */
export function generateSecureRandomString(length: number = 32): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Hash sensitive data for storage
 */
export function hashSensitiveData(data: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || generateSecureRandomString(16);
  const hash = crypto.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512').toString('hex');

  return { hash, salt: actualSalt };
}

/**
 * Verify hashed data
 */
export function verifyHashedData(data: string, hash: string, salt: string): boolean {
  const verifyHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}

/**
 * Sanitize request parameters for logging
 */
export function sanitizeForLogging(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = { ...data };

  // Remove or mask sensitive fields
  const sensitiveFields = [
    'password', 'secret', 'key', 'token', 'apiKey', 'auth',
    'authorization', 'cookie', 'session'
  ];

  function maskSensitiveFields(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(maskSensitiveFields);
    }

    const result: any = {};
    Object.entries(obj).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();

      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = maskSensitiveFields(value);
      }
    });

    return result;
  }

  return maskSensitiveFields(sanitized);
}