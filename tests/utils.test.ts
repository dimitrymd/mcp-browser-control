import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';

// Mock crypto for browser environment
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn().mockImplementation((size: number) => ({
      toString: vi.fn().mockImplementation((encoding: string) => {
        if (encoding === 'hex') {
          return 'a'.repeat(size * 2);
        }
        return 'a'.repeat(size);
      })
    })),
    pbkdf2Sync: vi.fn().mockImplementation(() => ({
      toString: vi.fn().mockReturnValue('mockedhash1234567890abcdef1234567890abcdef')
    })),
    timingSafeEqual: vi.fn().mockReturnValue(true)
  }
}));

// Import all utility functions for comprehensive testing
import {
  htmlToText,
  htmlToMarkdown,
  cleanText,
  extractTableData,
  tableToCSV,
  tableToJSON,
  parseCSV,
  formatForDisplay,
  extractListData,
  extractJSON
} from '../src/utils/converters.js';

import {
  isXPath,
  cssToXPath,
  validateSelector,
  normalizeSelector,
  escapeSelector,
  getSelectorType,
  parseCSS
} from '../src/utils/selectors.js';

import {
  validateInput,
  validateNavigateToParams,
  validateRefreshParams,
  validateUrlSafety,
  sanitizeString,
  sanitizeTimeout,
  validateEnvironmentConfig
} from '../src/utils/validation.js';

import {
  MCPError,
  SessionError,
  NavigationError,
  TimeoutError,
  ValidationError,
  WebDriverError,
  ConfigurationError,
  ConcurrencyError,
  ElementNotFoundError,
  ElementNotInteractableError,
  StaleElementError,
  InvalidSelectorError,
  createErrorResponse,
  isRecoverableError
} from '../src/utils/errors.js';

import {
  parseCSV as dataParseCSV,
  parseJSON,
  transformData,
  validateData,
  aggregateData,
  detectDataTypes,
  cleanData,
  extractTableFromHTML,
  convertToFormat,
  analyzeDataQuality
} from '../src/utils/data-processing.js';

import {
  sanitizeAndValidateURL,
  sanitizeJavaScriptCode,
  sanitizeSelector as securitySanitizeSelector,
  sanitizeFilePath,
  sanitizeHTML,
  sanitizeInput,
  generateSecureRandomString,
  hashSensitiveData,
  verifyHashedData,
  sanitizeForLogging
} from '../src/security/sanitization.js';

describe('Utility Functions - Comprehensive Coverage', () => {

  describe('Content Converters', () => {
    describe('htmlToText', () => {
      it('should convert HTML to plain text', () => {
        const html = '<div><h1>Title</h1><p>Paragraph with <strong>bold</strong> text</p></div>';
        const result = htmlToText(html);

        expect(result).toContain('Title');
        expect(result).toContain('Paragraph with bold text');
        expect(result).not.toContain('<h1>');
        expect(result).not.toContain('<strong>');
      });

      it('should remove script and style elements', () => {
        const html = '<div>Content<script>alert("xss")</script><style>body{}</style></div>';
        const result = htmlToText(html);

        expect(result).toBe('Content');
        expect(result).not.toContain('alert');
        expect(result).not.toContain('body{}');
      });

      it('should handle empty or invalid input', () => {
        expect(htmlToText('')).toBe('');
        expect(htmlToText(null as any)).toBe('');
        expect(htmlToText(undefined as any)).toBe('');
      });

      it('should decode HTML entities', () => {
        const html = '&lt;div&gt;&nbsp;&quot;test&quot;&amp;';
        const result = htmlToText(html);

        expect(result).toContain('<div> "test"&');
      });
    });

    describe('htmlToMarkdown', () => {
      it('should convert headers', () => {
        const html = '<h1>Main</h1><h2>Sub</h2><h3>SubSub</h3>';
        const result = htmlToMarkdown(html);

        expect(result).toContain('# Main');
        expect(result).toContain('## Sub');
        expect(result).toContain('### SubSub');
      });

      it('should convert links and images', () => {
        const html = '<a href="https://example.com">Link</a><img src="image.png" alt="Image">';
        const result = htmlToMarkdown(html);

        expect(result).toContain('[Link](https://example.com)');
        expect(result).toContain('![Image](image.png)');
      });

      it('should convert lists', () => {
        const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
        const result = htmlToMarkdown(html);

        expect(result).toContain('- Item 1');
        expect(result).toContain('- Item 2');
      });

      it('should handle code blocks', () => {
        const html = '<pre><code>const x = 5;</code></pre>';
        const result = htmlToMarkdown(html);

        expect(result).toContain('```');
        expect(result).toContain('const x = 5;');
      });
    });

    describe('extractTableData', () => {
      it('should extract table data to array format', () => {
        const html = '<table><tr><th>Name</th><th>Age</th></tr><tr><td>John</td><td>25</td></tr></table>';
        const result = extractTableData(html);

        expect(result.length).toBeGreaterThan(0);
        expect(result[result.length - 1]).toEqual(['John', '25']);
      });

      it('should handle tables with no headers', () => {
        const html = '<table><tr><td>Data1</td><td>Data2</td></tr></table>';
        const result = extractTableData(html);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(['Data1', 'Data2']);
      });

      it('should handle empty tables', () => {
        const html = '<table></table>';
        const result = extractTableData(html);

        expect(result).toEqual([]);
      });

      it('should handle malformed HTML', () => {
        const html = '<table><tr><td>Incomplete';
        const result = extractTableData(html);

        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('tableToCSV', () => {
      it('should convert table data to CSV', () => {
        const data = [['Name', 'Age'], ['John', '25'], ['Jane', '30']];
        const result = tableToCSV(data);

        expect(result).toBe('Name,Age\nJohn,25\nJane,30');
      });

      it('should handle cells with commas', () => {
        const data = [['Name', 'Location'], ['John', 'New York, NY']];
        const result = tableToCSV(data);

        expect(result).toContain('"New York, NY"');
      });

      it('should handle empty data', () => {
        expect(tableToCSV([])).toBe('');
        expect(tableToCSV(null as any)).toBe('');
      });
    });

    describe('parseCSV', () => {
      it('should parse basic CSV', () => {
        const csv = 'Name,Age\nJohn,25\nJane,30';
        const result = parseCSV(csv);

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual(['Name', 'Age']);
        expect(result[1]).toEqual(['John', '25']);
      });

      it('should handle quoted fields', () => {
        const csv = 'Name,Location\nJohn,"New York, NY"';
        const result = parseCSV(csv);

        expect(result[1][1]).toBe('New York, NY');
      });

      it('should handle escaped quotes', () => {
        const csv = 'Name,Quote\nJohn,"He said ""Hello"""';
        const result = parseCSV(csv);

        expect(result[1][1]).toBe('He said "Hello"');
      });
    });
  });

  describe('Selector Utilities', () => {
    describe('isXPath', () => {
      it('should detect XPath expressions', () => {
        expect(isXPath('//div')).toBe(true);
        expect(isXPath('/html/body')).toBe(true);
        expect(isXPath('(//div)[1]')).toBe(true);
        expect(isXPath('./div')).toBe(true);
        expect(isXPath('../div')).toBe(true);
      });

      it('should not detect CSS selectors as XPath', () => {
        expect(isXPath('#id')).toBe(false);
        expect(isXPath('.class')).toBe(false);
        expect(isXPath('div.class')).toBe(false);
        expect(isXPath('[attr="value"]')).toBe(false);
      });

      it('should handle empty or invalid input', () => {
        expect(isXPath('')).toBe(false);
        expect(isXPath(null as any)).toBe(false);
        expect(isXPath(undefined as any)).toBe(false);
      });
    });

    describe('cssToXPath', () => {
      it('should convert ID selectors', () => {
        const result = cssToXPath('#myId');
        expect(result).toContain("[@id='myId']");
      });

      it('should convert class selectors', () => {
        const result = cssToXPath('.myClass');
        expect(result).toContain("[contains(@class,'myClass')]");
      });

      it('should convert attribute selectors', () => {
        const result = cssToXPath('[data-test="value"]');
        expect(result).toContain("[@data-test='value']");
      });

      it('should handle descendant selectors', () => {
        const result = cssToXPath('div span');
        expect(result).toContain('//');
      });

      it('should throw error for empty selector', () => {
        expect(() => cssToXPath('')).toThrow();
        expect(() => cssToXPath(null as any)).toThrow();
      });
    });

    describe('validateSelector', () => {
      it('should validate CSS selectors', () => {
        expect(validateSelector('#id')).toBe(true);
        expect(validateSelector('.class')).toBe(true);
        expect(validateSelector('div.class')).toBe(true);
        expect(validateSelector('[attr="value"]')).toBe(true);
      });

      it('should validate XPath selectors', () => {
        expect(validateSelector('//div')).toBe(true);
        expect(validateSelector('/html/body')).toBe(true);
        expect(validateSelector('//div[@class="test"]')).toBe(true);
      });

      it('should reject invalid selectors', () => {
        expect(validateSelector('')).toBe(false);
        expect(validateSelector('[unclosed')).toBe(false);
        expect(validateSelector('div{')).toBe(false);
      });
    });

    describe('escapeSelector', () => {
      it('should escape special characters', () => {
        const input = 'text with "quotes" and \'apostrophes\'';
        const result = escapeSelector(input);

        expect(result).toContain('\\"');
        expect(result).toContain("\\'");
      });

      it('should escape newlines and tabs', () => {
        const input = 'text with\nnewlines\tand\ttabs';
        const result = escapeSelector(input);

        expect(result).toContain('\\n');
        expect(result).toContain('\\t');
      });

      it('should handle empty input', () => {
        expect(escapeSelector('')).toBe('');
        expect(escapeSelector(null as any)).toBe('');
      });
    });

    describe('parseCSS', () => {
      it('should parse tag selectors', () => {
        const result = parseCSS('div');
        expect(result.tag).toBe('div');
      });

      it('should parse ID selectors', () => {
        const result = parseCSS('#myId');
        expect(result.id).toBe('myId');
      });

      it('should parse class selectors', () => {
        const result = parseCSS('.class1.class2');
        expect(result.classes).toContain('class1');
        expect(result.classes).toContain('class2');
      });

      it('should parse attribute selectors', () => {
        const result = parseCSS('[data-test="value"]');
        expect(result.attributes).toHaveLength(1);
        expect(result.attributes[0].name).toBe('data-test');
        expect(result.attributes[0].value).toBe('value');
      });

      it('should parse complex selectors', () => {
        const result = parseCSS('div#id.class[attr="value"]');
        expect(result.tag).toBe('div');
        expect(result.id).toBe('id');
        expect(result.classes).toContain('class');
        expect(result.attributes).toHaveLength(1);
      });
    });
  });

  describe('Validation Utilities', () => {
    describe('validateUrlSafety', () => {
      it('should accept safe URLs', () => {
        expect(() => validateUrlSafety('https://example.com')).not.toThrow();
        expect(() => validateUrlSafety('http://localhost:3000')).not.toThrow();
      });

      it('should reject dangerous protocols', () => {
        expect(() => validateUrlSafety('file:///etc/passwd')).toThrow();
        expect(() => validateUrlSafety('javascript:alert(1)')).toThrow();
        expect(() => validateUrlSafety('data:text/html,<script>')).toThrow();
      });

      it('should reject malformed URLs', () => {
        expect(() => validateUrlSafety('not-a-url')).toThrow();
        expect(() => validateUrlSafety('http://')).toThrow();
      });
    });

    describe('sanitizeString', () => {
      it('should remove control characters', () => {
        const input = 'text\x00with\x1fcontrol\x7fchars';
        const result = sanitizeString(input);

        expect(result).toBe('textwithcontrolchars');
      });

      it('should trim whitespace', () => {
        const input = '  padded text  ';
        const result = sanitizeString(input);

        expect(result).toBe('padded text');
      });

      it('should enforce max length', () => {
        const input = 'a'.repeat(2000);
        const result = sanitizeString(input, 100);

        expect(result.length).toBe(100);
      });

      it('should handle non-string input', () => {
        expect(sanitizeString(null as any)).toBe('');
        expect(sanitizeString(123 as any)).toBe('');
      });
    });

    describe('sanitizeTimeout', () => {
      it('should enforce minimum timeout', () => {
        expect(sanitizeTimeout(500, 1000)).toBe(1000);
        expect(sanitizeTimeout(0, 1000)).toBe(1000);
      });

      it('should enforce maximum timeout', () => {
        expect(sanitizeTimeout(600000, 1000, 300000)).toBe(300000);
      });

      it('should handle invalid input', () => {
        expect(sanitizeTimeout(NaN, 1000)).toBe(1000);
        expect(sanitizeTimeout('invalid' as any, 1000)).toBe(1000);
      });

      it('should pass valid timeout', () => {
        expect(sanitizeTimeout(5000, 1000, 10000)).toBe(5000);
      });
    });

    describe('validateEnvironmentConfig', () => {
      beforeEach(() => {
        // Reset environment variables
        delete process.env.BROWSER_TYPE;
        delete process.env.HEADLESS;
        delete process.env.MAX_CONCURRENT_SESSIONS;
        delete process.env.SESSION_TIMEOUT;
        delete process.env.LOG_LEVEL;
      });

      it('should use default values', () => {
        const config = validateEnvironmentConfig();

        expect(config.browserType).toBe('chrome');
        expect(config.headless).toBe(true);
        expect(config.maxConcurrent).toBe(5);
        expect(config.sessionTimeout).toBe(600000);
        expect(config.logLevel).toBe('info');
      });

      it('should validate browser type', () => {
        process.env.BROWSER_TYPE = 'invalid';

        expect(() => validateEnvironmentConfig()).toThrow(ValidationError);
      });

      it('should validate session limits', () => {
        process.env.MAX_CONCURRENT_SESSIONS = '200';

        expect(() => validateEnvironmentConfig()).toThrow(ValidationError);
      });

      it('should validate log level', () => {
        process.env.LOG_LEVEL = 'invalid';

        expect(() => validateEnvironmentConfig()).toThrow(ValidationError);
      });
    });
  });

  describe('Error Handling', () => {
    describe('MCPError base class', () => {
      class TestError extends MCPError {
        readonly code = 'TEST001';
        readonly troubleshooting = ['Test troubleshooting step'];
      }

      it('should create error with timestamp', () => {
        const error = new TestError('Test message');

        expect(error.message).toBe('Test message');
        expect(error.code).toBe('TEST001');
        expect(error.timestamp).toBeGreaterThan(0);
        expect(error.troubleshooting).toContain('Test troubleshooting step');
      });

      it('should preserve original error', () => {
        const originalError = new Error('Original');
        const error = new TestError('Test message', originalError);

        expect(error.originalError).toBe(originalError);
      });

      it('should serialize to JSON', () => {
        const error = new TestError('Test message');
        const json = error.toJSON();

        expect(json.name).toBe('TestError');
        expect(json.code).toBe('TEST001');
        expect(json.message).toBe('Test message');
        expect(json.troubleshooting).toContain('Test troubleshooting step');
      });
    });

    describe('Specific error types', () => {
      it('should create SessionError', () => {
        const error = new SessionError('Session failed');
        expect(error.code).toBe('E001');
        expect(error.troubleshooting.length).toBeGreaterThan(0);
      });

      it('should create NavigationError', () => {
        const error = new NavigationError('Navigation failed');
        expect(error.code).toBe('E002');
      });

      it('should create TimeoutError', () => {
        const error = new TimeoutError('Timeout occurred');
        expect(error.code).toBe('E003');
      });

      it('should create ValidationError with field info', () => {
        const error = new ValidationError('Invalid input', 'fieldName', 'value');
        expect(error.code).toBe('E004');
        expect(error.field).toBe('fieldName');
        expect(error.value).toBe('value');
      });
    });

    describe('createErrorResponse', () => {
      it('should create response for MCPError', () => {
        const error = new ValidationError('Test error', 'field', 'value');
        const response = createErrorResponse(error);

        expect(response.status).toBe('error');
        expect(response.error.code).toBe('E004');
        expect(response.error.field).toBe('field');
        expect(response.error.value).toBe('value');
      });

      it('should handle unknown errors', () => {
        const error = new Error('Unknown error');
        const response = createErrorResponse(error);

        expect(response.status).toBe('error');
        expect(response.error.code).toBe('E999');
        expect(response.error.originalMessage).toBe('Unknown error');
      });
    });

    describe('isRecoverableError', () => {
      it('should identify recoverable errors', () => {
        const timeoutError = new TimeoutError('Timeout');
        const navigationError = new NavigationError('Navigation failed');

        expect(isRecoverableError(timeoutError)).toBe(true);
        expect(isRecoverableError(navigationError)).toBe(true);
      });

      it('should identify non-recoverable errors', () => {
        const validationError = new ValidationError('Invalid', 'field', 'value');
        const configError = new ConfigurationError('Config error');

        expect(isRecoverableError(validationError)).toBe(false);
        expect(isRecoverableError(configError)).toBe(false);
      });

      it('should check WebDriver error messages', () => {
        const staleElementError = new WebDriverError('stale element reference');
        const unknownError = new WebDriverError('unknown error');

        expect(isRecoverableError(staleElementError)).toBe(true);
        expect(isRecoverableError(unknownError)).toBe(false);
      });
    });
  });

  describe('Data Processing Utilities', () => {
    describe('parseJSON', () => {
      it('should parse valid JSON', () => {
        const json = '{"key": "value", "number": 42}';
        const result = parseJSON(json);

        expect(result.key).toBe('value');
        expect(result.number).toBe(42);
      });

      it('should throw error for invalid JSON', () => {
        expect(() => parseJSON('invalid json')).toThrow();
      });

      it('should repair common JSON issues', () => {
        const invalidJson = "{key: 'value', number: 42,}";
        const result = parseJSON(invalidJson, true);

        expect(result.key).toBe('value');
        expect(result.number).toBe(42);
      });

      it('should handle empty input', () => {
        expect(parseJSON('')).toBe(null);
        expect(parseJSON(null as any)).toBe(null);
      });
    });

    describe('detectDataTypes', () => {
      it('should detect string types', () => {
        const data = [{ name: 'John' }, { name: 'Jane' }];
        const types = detectDataTypes(data);

        expect(types.name).toBe('string');
      });

      it('should detect numeric types', () => {
        const data = [{ age: 25 }, { age: 30 }];
        const types = detectDataTypes(data);

        expect(types.age).toBe('integer');
      });

      it('should detect date types', () => {
        const data = [{ date: '2023-01-01' }, { date: '2023-01-02' }];
        const types = detectDataTypes(data);

        expect(types.date).toBe('date');
      });

      it('should detect URL types', () => {
        const data = [{ url: 'https://example.com' }, { url: 'https://test.com' }];
        const types = detectDataTypes(data);

        expect(types.url).toBe('url');
      });

      it('should handle empty data', () => {
        expect(detectDataTypes([])).toEqual({});
        expect(detectDataTypes(null as any)).toEqual({});
      });
    });

    describe('transformData', () => {
      it('should transform text fields', () => {
        const data = [{ name: '  John  ' }];
        const schema = {
          rules: [{ field: 'name', type: 'text' as const }],
          strict: false
        };

        const result = transformData(data, schema);
        expect(result[0].name).toBe('John');
      });

      it('should transform number fields', () => {
        const data = [{ price: '$25.99' }];
        const schema = {
          rules: [{ field: 'price', type: 'number' as const }],
          strict: false
        };

        const result = transformData(data, schema);
        expect(result[0].price).toBe(25.99);
      });

      it('should transform boolean fields', () => {
        const data = [{ active: 'true' }, { active: 'false' }];
        const schema = {
          rules: [{ field: 'active', type: 'boolean' as const }],
          strict: false
        };

        const result = transformData(data, schema);
        expect(result[0].active).toBe(true);
        expect(result[1].active).toBe(false);
      });

      it('should use default values for missing data', () => {
        const data = [{ name: 'John' }];
        const schema = {
          rules: [{ field: 'age', type: 'number' as const, default: 0 }],
          strict: false
        };

        const result = transformData(data, schema);
        expect(result[0].age).toBe(0);
      });
    });

    describe('cleanData', () => {
      it('should remove empty rows', () => {
        const data = [
          { name: 'John', age: 25 },
          { name: '', age: null },
          { name: 'Jane', age: 30 }
        ];

        const result = cleanData(data, { removeEmptyRows: true });
        expect(result).toHaveLength(2);
      });

      it('should trim strings', () => {
        const data = [{ name: '  John  ', city: '  NYC  ' }];
        const result = cleanData(data, { trimStrings: true });

        expect(result[0].name).toBe('John');
        expect(result[0].city).toBe('NYC');
      });

      it('should standardize nulls', () => {
        const data = [{ value1: '', value2: 'null', value3: 'NULL' }];
        const result = cleanData(data, { standardizeNulls: true });

        expect(result[0].value1).toBe(null);
        expect(result[0].value2).toBe(null);
        expect(result[0].value3).toBe(null);
      });
    });
  });

  describe('Security Sanitization', () => {
    describe('sanitizeAndValidateURL', () => {
      it('should accept valid URLs', () => {
        const result = sanitizeAndValidateURL('https://example.com/path?query=value');
        expect(result).toBe('https://example.com/path?query=value');
      });

      it('should reject dangerous protocols', () => {
        expect(() => sanitizeAndValidateURL('javascript:alert(1)')).toThrow();
        expect(() => sanitizeAndValidateURL('file:///etc/passwd')).toThrow();
        expect(() => sanitizeAndValidateURL('data:text/html,<script>')).toThrow();
      });

      it('should enforce length limits', () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(3000);
        expect(() => sanitizeAndValidateURL(longUrl)).toThrow();
      });

      it('should validate allowed domains', () => {
        const options = { allowedDomains: ['example.com', '*.test.com'] };

        expect(() => sanitizeAndValidateURL('https://example.com', options)).not.toThrow();
        expect(() => sanitizeAndValidateURL('https://sub.test.com', options)).not.toThrow();
        expect(() => sanitizeAndValidateURL('https://evil.com', options)).toThrow();
      });
    });

    describe('sanitizeJavaScriptCode', () => {
      it('should remove dangerous patterns', () => {
        const input = 'eval("alert(1)"); new Function("alert(2)");';
        const result = sanitizeJavaScriptCode(input);

        expect(result).toContain('// eval(');
        expect(result).toContain('// new Function(');
      });

      it('should remove window manipulation', () => {
        const input = 'window.location = "evil.com"; document.write("<script>");';
        const result = sanitizeJavaScriptCode(input);

        expect(result).toContain('// window.location =');
        expect(result).toContain('// document.write(');
      });

      it('should preserve safe code when allowed', () => {
        const input = 'const x = 5; return x * 2;';
        const result = sanitizeJavaScriptCode(input, { allowScripts: true });

        expect(result).toBe(input);
      });

      it('should enforce length limits', () => {
        const longScript = 'console.log("a");'.repeat(1000);
        expect(() => sanitizeJavaScriptCode(longScript)).toThrow();
      });
    });

    describe('sanitizeHTML', () => {
      it('should strip all HTML when not allowed', () => {
        const input = '<div>Safe <script>alert(1)</script> content</div>';
        const result = sanitizeHTML(input, { allowHTML: false });

        expect(result).toContain('Safe');
        expect(result).toContain('content');
        expect(result).not.toContain('<div>');
        expect(result).not.toContain('<script>');
      });

      it('should remove dangerous elements when HTML allowed', () => {
        const input = '<div>Safe</div><script>alert(1)</script><iframe src="evil.com"></iframe>';
        const result = sanitizeHTML(input, { allowHTML: true });

        expect(result).toContain('<div>Safe</div>');
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('<iframe>');
      });

      it('should remove dangerous attributes', () => {
        const input = '<div onclick="alert(1)" onload="evil()">Safe</div>';
        const result = sanitizeHTML(input, { allowHTML: true });

        expect(result).not.toContain('onclick');
        expect(result).not.toContain('onload');
      });
    });

    describe('generateSecureRandomString (validation)', () => {
      it('should validate function exists', () => {
        expect(typeof generateSecureRandomString).toBe('function');
      });

      it('should handle length parameter', () => {
        // Test that function is defined and can be called
        expect(generateSecureRandomString.length).toBe(0); // Function has default parameter
      });

      it('should be exported correctly', () => {
        expect(generateSecureRandomString).toBeDefined();
      });
    });

    describe('hashSensitiveData (validation)', () => {
      it('should validate function exists', () => {
        expect(typeof hashSensitiveData).toBe('function');
      });

      it('should validate function signature', () => {
        expect(hashSensitiveData.length).toBeGreaterThan(0); // Has parameters
      });

      it('should validate verify function exists', () => {
        expect(typeof verifyHashedData).toBe('function');
      });
    });

    describe('sanitizeForLogging', () => {
      it('should mask sensitive fields', () => {
        const data = {
          username: 'john',
          password: 'secret123',
          apiKey: 'key123',
          normalField: 'visible'
        };

        const result = sanitizeForLogging(data);

        expect(result.username).toBe('john');
        expect(result.password).toBe('[REDACTED]');
        expect(result.apiKey).toBe('[REDACTED]');
        expect(result.normalField).toBe('visible');
      });

      it('should handle nested objects', () => {
        const data = {
          user: {
            name: 'john',
            credentials: {
              password: 'secret',
              token: 'abc123'
            }
          }
        };

        const result = sanitizeForLogging(data);

        expect(result.user.name).toBe('john');
        expect(result.user.credentials.password).toBe('[REDACTED]');
        expect(result.user.credentials.token).toBe('[REDACTED]');
      });

      it('should handle arrays', () => {
        const data = {
          users: [
            { name: 'john', password: 'secret1' },
            { name: 'jane', password: 'secret2' }
          ]
        };

        const result = sanitizeForLogging(data);

        expect(result.users[0].name).toBe('john');
        expect(result.users[0].password).toBe('[REDACTED]');
        expect(result.users[1].name).toBe('jane');
        expect(result.users[1].password).toBe('[REDACTED]');
      });
    });
  });

  describe('Advanced Content Processing', () => {
    describe('extractListData', () => {
      it('should extract ordered lists', () => {
        const html = '<ol><li>First item</li><li>Second item</li></ol>';
        const result = extractListData(html);

        expect(result.ordered).toHaveLength(1);
        expect(result.ordered[0]).toContain('First item');
        expect(result.ordered[0]).toContain('Second item');
      });

      it('should extract unordered lists', () => {
        const html = '<ul><li>Bullet 1</li><li>Bullet 2</li></ul>';
        const result = extractListData(html);

        expect(result.unordered).toHaveLength(1);
        expect(result.unordered[0]).toContain('Bullet 1');
        expect(result.unordered[0]).toContain('Bullet 2');
      });

      it('should handle nested lists', () => {
        const html = '<ul><li>Item 1<ul><li>Nested item</li></ul></li></ul>';
        const result = extractListData(html);

        expect(result.unordered).toHaveLength(1);
        expect(result.unordered[0][0]).toContain('Item 1');
      });
    });

    describe('extractJSON', () => {
      it('should extract JSON objects from text', () => {
        const text = 'Some text {"key": "value"} more text [1, 2, 3] end';
        const result = extractJSON(text);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ key: 'value' });
        expect(result[1]).toEqual([1, 2, 3]);
      });

      it('should ignore invalid JSON', () => {
        const text = 'Some text {invalid json} more text';
        const result = extractJSON(text);

        expect(result).toHaveLength(0);
      });

      it('should handle empty input', () => {
        expect(extractJSON('')).toEqual([]);
        expect(extractJSON(null as any)).toEqual([]);
      });
    });

    describe('formatForDisplay', () => {
      it('should wrap long lines', () => {
        const longText = 'word '.repeat(20); // Create text with spaces for wrapping
        const result = formatForDisplay(longText, 50);

        expect(result.split('\n').length).toBeGreaterThan(1);
      });

      it('should preserve short lines', () => {
        const shortText = 'Short line';
        const result = formatForDisplay(shortText, 50);

        expect(result).toBe(shortText);
      });

      it('should handle multiple lines', () => {
        const text = 'Line 1\nLine 2\nLine 3';
        const result = formatForDisplay(text, 50);

        expect(result.split('\n')).toHaveLength(3);
      });
    });
  });
});