import { vi } from 'vitest';

// Global test setup

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.BROWSER_TYPE = 'chrome';
process.env.HEADLESS = 'true';
process.env.MAX_CONCURRENT_SESSIONS = '3';
process.env.SESSION_TIMEOUT = '300000';
process.env.LOG_LEVEL = 'error';

// Suppress console logs during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

// Global timeout for tests
vi.setConfig({ testTimeout: 10000 });