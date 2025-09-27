import { WebDriver } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import {
  ManageCookiesParams,
  ManageCookiesResult,
  ManageStorageParams,
  ManageStorageResult,
  ClearBrowserDataParams,
  ClearBrowserDataResult,
  Cookie,
  MCPToolResult
} from '../types/index.js';
import { ValidationError, createErrorResponse } from '../utils/errors.js';
import winston from 'winston';

export class StorageTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async manageCookies(params: unknown, sessionId?: string): Promise<MCPToolResult<ManageCookiesResult>> {
    const startTime = Date.now();
    this.logger.info('Executing manage_cookies tool', { params, sessionId });

    try {
      const validatedParams = this.validateManageCookiesParams(params);
      const { action, cookie, filter } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Managing cookies', {
        action,
        hasCookie: !!cookie,
        hasFilter: !!filter,
        sessionId: actualSessionId
      });

      let cookies: Cookie[] = [];
      let affected = 0;

      switch (action) {
        case 'get':
          const allCookies = await session.driver.manage().getCookies();
          cookies = allCookies.map(c => {
            const cookie: Cookie = {
              name: c.name,
              value: c.value
            };
            if (c.domain) cookie.domain = c.domain;
            if (c.path) cookie.path = c.path;
            if (c.secure !== undefined) cookie.secure = c.secure;
            if (c.httpOnly !== undefined) cookie.httpOnly = c.httpOnly;
            if (c.sameSite) cookie.sameSite = c.sameSite as 'Lax' | 'Strict' | 'None';
            if (c.expiry && typeof c.expiry === 'number') cookie.expires = c.expiry * 1000; // Convert to milliseconds
            return cookie;
          });

          // Apply filters if provided
          if (filter) {
            cookies = cookies.filter(c => {
              if (filter.name && c.name !== filter.name) return false;
              if (filter.domain && (!c.domain || !c.domain.includes(filter.domain))) return false;
              return true;
            });
          }
          break;

        case 'set':
          if (!cookie) {
            throw new ValidationError('cookie is required for set action', 'cookie', cookie);
          }

          const cookieOptions: any = {
            name: cookie.name,
            value: cookie.value
          };

          if (cookie.domain) cookieOptions.domain = cookie.domain;
          if (cookie.path) cookieOptions.path = cookie.path;
          if (cookie.secure !== undefined) cookieOptions.secure = cookie.secure;
          if (cookie.httpOnly !== undefined) cookieOptions.httpOnly = cookie.httpOnly;
          if (cookie.sameSite) cookieOptions.sameSite = cookie.sameSite;
          if (cookie.expires) cookieOptions.expiry = Math.floor(cookie.expires / 1000); // Convert to seconds

          await session.driver.manage().addCookie(cookieOptions);
          cookies = [cookie];
          affected = 1;
          break;

        case 'delete':
          if (filter?.name) {
            await session.driver.manage().deleteCookie(filter.name);
            affected = 1;
          } else if (cookie?.name) {
            await session.driver.manage().deleteCookie(cookie.name);
            affected = 1;
          } else {
            throw new ValidationError('Must provide cookie name or filter with name for delete action', 'identifier', { cookie, filter });
          }
          break;

        case 'clear':
          await session.driver.manage().deleteAllCookies();
          affected = -1; // Unknown count
          break;

        default:
          throw new ValidationError(`Invalid action: ${action}`, 'action', action);
      }

      const result: ManageCookiesResult = {
        cookies,
        affected
      };

      this.logger.info('Cookie management completed', {
        action,
        cookiesCount: cookies.length,
        affected,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'manageCookies', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Cookie management failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'manageCookies', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Cookie management failed'));
    }
  }

  async manageStorage(params: unknown, sessionId?: string): Promise<MCPToolResult<ManageStorageResult>> {
    const startTime = Date.now();
    this.logger.info('Executing manage_storage tool', { params, sessionId });

    try {
      const validatedParams = this.validateManageStorageParams(params);
      const { storageType, action, key, value } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Managing storage', {
        storageType,
        action,
        key,
        hasValue: value !== undefined,
        sessionId: actualSessionId
      });

      const result = await session.driver.executeScript(`
        const storageType = arguments[0];
        const action = arguments[1];
        const key = arguments[2];
        const value = arguments[3];

        const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
        const result = { data: null, size: 0, keys: [] };

        try {
          switch (action) {
            case 'get':
              if (key) {
                result.data = storage.getItem(key);
              } else {
                const allData = {};
                for (let i = 0; i < storage.length; i++) {
                  const k = storage.key(i);
                  if (k) allData[k] = storage.getItem(k);
                }
                result.data = allData;
              }
              break;

            case 'set':
              if (!key) throw new Error('Key is required for set action');
              storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
              result.data = value;
              break;

            case 'remove':
              if (!key) throw new Error('Key is required for remove action');
              storage.removeItem(key);
              break;

            case 'clear':
              storage.clear();
              break;

            case 'getAllKeys':
              const keys = [];
              for (let i = 0; i < storage.length; i++) {
                const k = storage.key(i);
                if (k) keys.push(k);
              }
              result.keys = keys;
              result.data = keys;
              break;

            default:
              throw new Error('Invalid action: ' + action);
          }

          // Calculate storage size
          let totalSize = 0;
          for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (k) {
              const v = storage.getItem(k);
              totalSize += k.length + (v ? v.length : 0);
            }
          }
          result.size = totalSize;

          // Get all keys
          const allKeys = [];
          for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (k) allKeys.push(k);
          }
          result.keys = allKeys;

          return result;
        } catch (error) {
          throw new Error(storageType + ' operation failed: ' + error.message);
        }
      `, storageType, action, key, value);

      const storageResult = result as ManageStorageResult;

      this.logger.info('Storage management completed', {
        storageType,
        action,
        dataSize: storageResult.size,
        keysCount: storageResult.keys.length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'manageStorage', key, true, Date.now() - startTime);

      return {
        status: 'success',
        data: storageResult
      };

    } catch (error) {
      this.logger.error('Storage management failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'manageStorage', (params as any)?.key, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Storage management failed'));
    }
  }

  async clearBrowserData(params: unknown, sessionId?: string): Promise<MCPToolResult<ClearBrowserDataResult>> {
    const startTime = Date.now();
    this.logger.info('Executing clear_browser_data tool', { params, sessionId });

    try {
      const validatedParams = this.validateClearBrowserDataParams(params);
      const { dataTypes, timeRange } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Clearing browser data', {
        dataTypes,
        timeRange,
        sessionId: actualSessionId
      });

      const cleared: string[] = [];
      const errors: string[] = [];

      // Clear different types of data
      for (const dataType of dataTypes) {
        try {
          switch (dataType) {
            case 'cookies':
              await session.driver.manage().deleteAllCookies();
              cleared.push('cookies');
              break;

            case 'localStorage':
              await session.driver.executeScript('localStorage.clear();');
              cleared.push('localStorage');
              break;

            case 'sessionStorage':
              await session.driver.executeScript('sessionStorage.clear();');
              cleared.push('sessionStorage');
              break;

            case 'indexedDB':
              await session.driver.executeScript(`
                if (window.indexedDB) {
                  // This is a simplified approach - real implementation would need more comprehensive clearing
                  const databases = await indexedDB.databases();
                  for (const db of databases) {
                    if (db.name) {
                      const deleteReq = indexedDB.deleteDatabase(db.name);
                      await new Promise((resolve, reject) => {
                        deleteReq.onsuccess = () => resolve(true);
                        deleteReq.onerror = () => reject(deleteReq.error);
                      });
                    }
                  }
                }
              `);
              cleared.push('indexedDB');
              break;

            case 'cache':
              await session.driver.executeScript(`
                if ('caches' in window) {
                  const cacheNames = await caches.keys();
                  for (const cacheName of cacheNames) {
                    await caches.delete(cacheName);
                  }
                }
              `);
              cleared.push('cache');
              break;

            default:
              errors.push(`Unknown data type: ${dataType}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to clear ${dataType}`, { error });
          errors.push(`Failed to clear ${dataType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const result: ClearBrowserDataResult = {
        cleared,
        errors
      };

      this.logger.info('Browser data clearing completed', {
        cleared,
        errorsCount: errors.length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'clearBrowserData', undefined, errors.length === 0, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Browser data clearing failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'clearBrowserData', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Browser data clearing failed'));
    }
  }

  // Private helper methods

  private async getDefaultSession(): Promise<string> {
    const sessions = this.sessionManager.listSessions();
    if (sessions.length > 0) {
      return sessions[0].id;
    }
    throw new Error('No session ID provided and no active sessions available. Create a session first.');
  }

  // Validation methods

  private validateManageCookiesParams(params: unknown): ManageCookiesParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    const validActions = ['get', 'set', 'delete', 'clear'];
    if (!p.action || !validActions.includes(p.action)) {
      throw new ValidationError(
        `action is required and must be one of: ${validActions.join(', ')}`,
        'action',
        p.action
      );
    }

    // Validate cookie structure if provided
    if (p.cookie) {
      if (typeof p.cookie !== 'object') {
        throw new ValidationError('cookie must be an object', 'cookie', p.cookie);
      }

      if (!p.cookie.name || typeof p.cookie.name !== 'string') {
        throw new ValidationError('cookie.name is required and must be a string', 'cookie.name', p.cookie.name);
      }

      if (p.action === 'set' && (p.cookie.value === undefined || typeof p.cookie.value !== 'string')) {
        throw new ValidationError('cookie.value is required and must be a string for set action', 'cookie.value', p.cookie.value);
      }

      // Validate sameSite if provided
      if (p.cookie.sameSite && !['Lax', 'Strict', 'None'].includes(p.cookie.sameSite)) {
        throw new ValidationError('cookie.sameSite must be one of: Lax, Strict, None', 'cookie.sameSite', p.cookie.sameSite);
      }
    }

    return {
      action: p.action,
      cookie: p.cookie,
      filter: p.filter
    };
  }

  private validateManageStorageParams(params: unknown): ManageStorageParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    const validStorageTypes = ['localStorage', 'sessionStorage'];
    if (!p.storageType || !validStorageTypes.includes(p.storageType)) {
      throw new ValidationError(
        `storageType is required and must be one of: ${validStorageTypes.join(', ')}`,
        'storageType',
        p.storageType
      );
    }

    const validActions = ['get', 'set', 'remove', 'clear', 'getAllKeys'];
    if (!p.action || !validActions.includes(p.action)) {
      throw new ValidationError(
        `action is required and must be one of: ${validActions.join(', ')}`,
        'action',
        p.action
      );
    }

    // Validate key for actions that require it
    if (['set', 'remove'].includes(p.action) && (!p.key || typeof p.key !== 'string')) {
      throw new ValidationError(`key is required and must be a string for ${p.action} action`, 'key', p.key);
    }

    // Validate value for set action
    if (p.action === 'set' && p.value === undefined) {
      throw new ValidationError('value is required for set action', 'value', p.value);
    }

    return {
      storageType: p.storageType,
      action: p.action,
      key: p.key,
      value: p.value
    };
  }

  private validateClearBrowserDataParams(params: unknown): ClearBrowserDataParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!Array.isArray(p.dataTypes) || p.dataTypes.length === 0) {
      throw new ValidationError('dataTypes is required and must be a non-empty array', 'dataTypes', p.dataTypes);
    }

    const validDataTypes = ['cookies', 'localStorage', 'sessionStorage', 'indexedDB', 'cache'];
    const invalidTypes = p.dataTypes.filter((type: any) => !validDataTypes.includes(type));

    if (invalidTypes.length > 0) {
      throw new ValidationError(
        `Invalid data types: ${invalidTypes.join(', ')}. Valid types: ${validDataTypes.join(', ')}`,
        'dataTypes',
        invalidTypes
      );
    }

    // Validate time range if provided
    if (p.timeRange) {
      if (typeof p.timeRange !== 'object') {
        throw new ValidationError('timeRange must be an object', 'timeRange', p.timeRange);
      }

      if (p.timeRange.start && typeof p.timeRange.start !== 'number') {
        throw new ValidationError('timeRange.start must be a number', 'timeRange.start', p.timeRange.start);
      }

      if (p.timeRange.end && typeof p.timeRange.end !== 'number') {
        throw new ValidationError('timeRange.end must be a number', 'timeRange.end', p.timeRange.end);
      }

      if (p.timeRange.start && p.timeRange.end && p.timeRange.start >= p.timeRange.end) {
        throw new ValidationError('timeRange.start must be less than timeRange.end', 'timeRange', p.timeRange);
      }
    }

    return {
      dataTypes: p.dataTypes,
      timeRange: p.timeRange
    };
  }
}