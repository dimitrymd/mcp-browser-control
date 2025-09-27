import { WebDriver } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import {
  StartNetworkCaptureParams,
  StartNetworkCaptureResult,
  GetNetworkDataParams,
  GetNetworkDataResult,
  StopNetworkCaptureParams,
  StopNetworkCaptureResult,
  BlockRequestsParams,
  BlockRequestsResult,
  MCPToolResult
} from '../types/index.js';
import { ValidationError, createErrorResponse } from '../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

export class NetworkTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;
  private activeCaptures: Map<string, any> = new Map();

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async startNetworkCapture(params: unknown, sessionId?: string): Promise<MCPToolResult<StartNetworkCaptureResult>> {
    const startTime = Date.now();
    this.logger.info('Executing start_network_capture tool', { params, sessionId });

    try {
      const validatedParams = this.validateStartNetworkCaptureParams(params);
      const {
        captureTypes,
        urlPattern,
        includeHeaders = true,
        includeBody = false,
        maxSize = 1024 * 1024 // 1MB default
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Starting network capture', {
        captureTypes,
        urlPattern,
        includeHeaders,
        includeBody,
        maxSize,
        sessionId: actualSessionId
      });

      const captureId = uuidv4();

      // Set up network monitoring
      const networkCapture = await session.driver.executeScript(`
        const captureId = arguments[0];
        const captureTypes = arguments[1];
        const urlPattern = arguments[2];
        const includeHeaders = arguments[3];
        const includeBody = arguments[4];
        const maxSize = arguments[5];

        // Store captured requests
        window.MCPNetworkCapture = window.MCPNetworkCapture || {};
        window.MCPNetworkCapture[captureId] = {
          requests: [],
          startTime: Date.now(),
          active: true
        };

        const capture = window.MCPNetworkCapture[captureId];

        // Override fetch API
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
          const startTime = Date.now();
          const url = typeof args[0] === 'string' ? args[0] : args[0].url;

          // Check if we should capture this request
          let shouldCapture = captureTypes.includes('fetch');
          if (urlPattern) {
            const pattern = new RegExp(urlPattern);
            shouldCapture = shouldCapture && pattern.test(url);
          }

          if (shouldCapture) {
            try {
              const response = await originalFetch.apply(this, args);
              const endTime = Date.now();

              const requestData = {
                url: url,
                method: args[1]?.method || 'GET',
                status: response.status,
                statusText: response.statusText,
                headers: includeHeaders ? Object.fromEntries(response.headers.entries()) : {},
                responseHeaders: includeHeaders ? Object.fromEntries(response.headers.entries()) : {},
                startTime: startTime,
                endTime: endTime,
                duration: endTime - startTime,
                size: 0, // Would need response body to calculate
                type: 'fetch',
                initiator: 'script'
              };

              if (includeBody && response.body) {
                // Clone response to read body
                const clonedResponse = response.clone();
                try {
                  const text = await clonedResponse.text();
                  if (text.length <= maxSize) {
                    requestData.responseBody = text;
                    requestData.size = text.length;
                  }
                } catch (e) {
                  // Can't read body
                }
              }

              capture.requests.push(requestData);
              return response;
            } catch (error) {
              const endTime = Date.now();
              capture.requests.push({
                url: url,
                method: args[1]?.method || 'GET',
                status: 0,
                statusText: 'Network Error',
                headers: {},
                responseHeaders: {},
                startTime: startTime,
                endTime: endTime,
                duration: endTime - startTime,
                size: 0,
                type: 'fetch',
                initiator: 'script',
                error: error.message
              });
              throw error;
            }
          } else {
            return originalFetch.apply(this, args);
          }
        };

        // Override XMLHttpRequest (simplified)
        if (captureTypes.includes('xhr')) {
          const originalXHR = window.XMLHttpRequest;
          window.XMLHttpRequest = function() {
            const xhr = new originalXHR();
            const originalOpen = xhr.open;
            const originalSend = xhr.send;

            let requestData = {
              url: '',
              method: 'GET',
              startTime: 0,
              endTime: 0
            };

            xhr.open = function(method, url, ...args) {
              requestData.method = method;
              requestData.url = typeof url === 'string' ? url : String(url);
              return originalOpen.apply(this, [method, url, ...args]);
            };

            xhr.send = function(body) {
              requestData.startTime = Date.now();

              const originalOnLoadEnd = xhr.onloadend;
              xhr.onloadend = function(event) {
                requestData.endTime = Date.now();

                // Check if we should capture this request
                let shouldCapture = true;
                if (urlPattern) {
                  const pattern = new RegExp(urlPattern);
                  shouldCapture = pattern.test(requestData.url);
                }

                if (shouldCapture) {
                  capture.requests.push({
                    url: requestData.url,
                    method: requestData.method,
                    status: xhr.status,
                    statusText: xhr.statusText,
                    headers: {},
                    responseHeaders: {},
                    startTime: requestData.startTime,
                    endTime: requestData.endTime,
                    duration: requestData.endTime - requestData.startTime,
                    size: xhr.responseText ? xhr.responseText.length : 0,
                    type: 'xhr',
                    initiator: 'script',
                    responseBody: includeBody ? xhr.responseText : undefined
                  });
                }

                if (originalOnLoadEnd) {
                  originalOnLoadEnd.call(this, event);
                }
              };

              return originalSend.apply(this, [body]);
            };

            return xhr;
          };
        }

        return { captureId: captureId, success: true };
      `, captureId, captureTypes, urlPattern, includeHeaders, includeBody, maxSize);

      // Store capture info
      this.activeCaptures.set(captureId, {
        sessionId: actualSessionId,
        startTime: Date.now(),
        captureTypes,
        urlPattern
      });

      const result: StartNetworkCaptureResult = {
        captureId,
        success: true
      };

      this.logger.info('Network capture started', {
        captureId,
        captureTypes,
        urlPattern,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'startNetworkCapture', captureId, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Network capture start failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'startNetworkCapture', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Network capture start failed'));
    }
  }

  async getNetworkData(params: unknown, sessionId?: string): Promise<MCPToolResult<GetNetworkDataResult>> {
    const startTime = Date.now();
    this.logger.info('Executing get_network_data tool', { params, sessionId });

    try {
      const validatedParams = this.validateGetNetworkDataParams(params);
      const { captureId, filter } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Getting network data', {
        captureId,
        hasFilter: !!filter,
        sessionId: actualSessionId
      });

      // Get captured network data
      const networkData = await session.driver.executeScript(`
        const captureId = arguments[0];
        const filter = arguments[1];

        if (!window.MCPNetworkCapture || !window.MCPNetworkCapture[captureId]) {
          throw new Error('Network capture not found: ' + captureId);
        }

        const capture = window.MCPNetworkCapture[captureId];
        let requests = [...capture.requests];

        // Apply filters if provided
        if (filter) {
          if (filter.status && Array.isArray(filter.status)) {
            requests = requests.filter(req => filter.status.includes(req.status));
          }

          if (filter.method && Array.isArray(filter.method)) {
            requests = requests.filter(req => filter.method.includes(req.method.toUpperCase()));
          }

          if (filter.url && typeof filter.url === 'string') {
            const urlPattern = new RegExp(filter.url);
            requests = requests.filter(req => urlPattern.test(req.url));
          }

          if (filter.minDuration && typeof filter.minDuration === 'number') {
            requests = requests.filter(req => req.duration >= filter.minDuration);
          }

          if (filter.maxDuration && typeof filter.maxDuration === 'number') {
            requests = requests.filter(req => req.duration <= filter.maxDuration);
          }
        }

        // Calculate summary
        const summary = {
          total: requests.length,
          successful: requests.filter(req => req.status >= 200 && req.status < 300).length,
          failed: requests.filter(req => req.status >= 400 || req.status === 0).length,
          pending: 0, // In our simplified implementation, we don't track pending requests
          totalSize: requests.reduce((sum, req) => sum + (req.size || 0), 0),
          averageDuration: requests.length > 0 ?
            requests.reduce((sum, req) => sum + req.duration, 0) / requests.length : 0
        };

        return {
          requests: requests,
          summary: summary
        };
      `, captureId, filter);

      const result = networkData as GetNetworkDataResult;

      this.logger.info('Network data retrieval completed', {
        captureId,
        requestsCount: result.requests.length,
        summary: result.summary,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'getNetworkData', captureId, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Network data retrieval failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'getNetworkData', (params as any)?.captureId, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Network data retrieval failed'));
    }
  }

  async stopNetworkCapture(params: unknown, sessionId?: string): Promise<MCPToolResult<StopNetworkCaptureResult>> {
    const startTime = Date.now();
    this.logger.info('Executing stop_network_capture tool', { params, sessionId });

    try {
      const validatedParams = this.validateStopNetworkCaptureParams(params);
      const { captureId, getData = true } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Stopping network capture', {
        captureId,
        getData,
        sessionId: actualSessionId
      });

      // Get final data if requested
      let finalData: GetNetworkDataResult | undefined;
      if (getData) {
        const dataResult = await this.getNetworkData({ captureId }, sessionId);
        if (dataResult.status === 'success') {
          finalData = dataResult.data;
        }
      }

      // Stop capture and restore original functions
      await session.driver.executeScript(`
        const captureId = arguments[0];

        if (window.MCPNetworkCapture && window.MCPNetworkCapture[captureId]) {
          window.MCPNetworkCapture[captureId].active = false;
          delete window.MCPNetworkCapture[captureId];
        }

        // Note: In a full implementation, we would restore original fetch/XHR
        // For now, we just mark the capture as inactive
      `, captureId);

      // Remove from active captures
      this.activeCaptures.delete(captureId);

      const result: StopNetworkCaptureResult = {
        success: true,
        data: finalData
      };

      this.logger.info('Network capture stopped', {
        captureId,
        hadData: !!finalData,
        requestsCaptured: finalData?.requests.length || 0,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'stopNetworkCapture', captureId, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Network capture stop failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'stopNetworkCapture', (params as any)?.captureId, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Network capture stop failed'));
    }
  }

  async blockRequests(params: unknown, sessionId?: string): Promise<MCPToolResult<BlockRequestsResult>> {
    const startTime = Date.now();
    this.logger.info('Executing block_requests tool', { params, sessionId });

    try {
      const validatedParams = this.validateBlockRequestsParams(params);
      const { patterns, action, redirectUrl, modifyHeaders } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Setting up request blocking', {
        patterns,
        action,
        redirectUrl,
        hasModifyHeaders: !!modifyHeaders,
        sessionId: actualSessionId
      });

      // Set up request blocking
      const blockingResult = await session.driver.executeScript(`
        const patterns = arguments[0];
        const action = arguments[1];
        const redirectUrl = arguments[2];
        const modifyHeaders = arguments[3];

        let blockedCount = 0;

        // Store original fetch for blocking
        if (!window.originalFetch) {
          window.originalFetch = window.fetch;
        }

        window.fetch = async function(...args) {
          const url = typeof args[0] === 'string' ? args[0] : args[0].url;

          // Check if URL matches any blocking patterns
          const shouldBlock = patterns.some(pattern => {
            const regex = new RegExp(pattern);
            return regex.test(url);
          });

          if (shouldBlock) {
            blockedCount++;

            switch (action) {
              case 'block':
                throw new Error('Request blocked: ' + url);

              case 'redirect':
                if (redirectUrl) {
                  const redirectedArgs = [...args];
                  if (typeof redirectedArgs[0] === 'string') {
                    redirectedArgs[0] = redirectUrl;
                  } else {
                    redirectedArgs[0] = { ...redirectedArgs[0], url: redirectUrl };
                  }
                  return window.originalFetch.apply(this, redirectedArgs);
                }
                break;

              case 'modify':
                if (modifyHeaders && args[1]) {
                  args[1].headers = { ...args[1].headers, ...modifyHeaders };
                }
                return window.originalFetch.apply(this, args);

              default:
                return window.originalFetch.apply(this, args);
            }
          }

          return window.originalFetch.apply(this, args);
        };

        return { blockedCount: blockedCount };
      `, patterns, action, redirectUrl, modifyHeaders);

      const result: BlockRequestsResult = {
        success: true,
        blockedCount: (blockingResult as any).blockedCount || 0
      };

      this.logger.info('Request blocking setup completed', {
        patterns,
        action,
        blockedCount: result.blockedCount,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'blockRequests', action, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Request blocking setup failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'blockRequests', (params as any)?.action, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Request blocking setup failed'));
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

  private validateStartNetworkCaptureParams(params: unknown): StartNetworkCaptureParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!Array.isArray(p.captureTypes) || p.captureTypes.length === 0) {
      throw new ValidationError('captureTypes is required and must be a non-empty array', 'captureTypes', p.captureTypes);
    }

    const validTypes = ['xhr', 'fetch', 'document', 'script', 'stylesheet', 'image', 'media', 'font', 'websocket'];
    const invalidTypes = p.captureTypes.filter((type: any) => !validTypes.includes(type));

    if (invalidTypes.length > 0) {
      throw new ValidationError(
        `Invalid capture types: ${invalidTypes.join(', ')}. Valid types: ${validTypes.join(', ')}`,
        'captureTypes',
        invalidTypes
      );
    }

    if (p.urlPattern && typeof p.urlPattern !== 'string') {
      throw new ValidationError('urlPattern must be a string', 'urlPattern', p.urlPattern);
    }

    if (p.maxSize && (typeof p.maxSize !== 'number' || p.maxSize < 1)) {
      throw new ValidationError('maxSize must be a positive number', 'maxSize', p.maxSize);
    }

    return {
      captureTypes: p.captureTypes,
      urlPattern: p.urlPattern,
      includeHeaders: p.includeHeaders,
      includeBody: p.includeBody,
      maxSize: p.maxSize
    };
  }

  private validateGetNetworkDataParams(params: unknown): GetNetworkDataParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (p.captureId && typeof p.captureId !== 'string') {
      throw new ValidationError('captureId must be a string', 'captureId', p.captureId);
    }

    return {
      captureId: p.captureId,
      filter: p.filter
    };
  }

  private validateStopNetworkCaptureParams(params: unknown): StopNetworkCaptureParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!p.captureId || typeof p.captureId !== 'string') {
      throw new ValidationError('captureId is required and must be a string', 'captureId', p.captureId);
    }

    return {
      captureId: p.captureId,
      getData: p.getData
    };
  }

  private validateBlockRequestsParams(params: unknown): BlockRequestsParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!Array.isArray(p.patterns) || p.patterns.length === 0) {
      throw new ValidationError('patterns is required and must be a non-empty array', 'patterns', p.patterns);
    }

    const validActions = ['block', 'redirect', 'modify'];
    if (!p.action || !validActions.includes(p.action)) {
      throw new ValidationError(
        `action is required and must be one of: ${validActions.join(', ')}`,
        'action',
        p.action
      );
    }

    if (p.action === 'redirect' && (!p.redirectUrl || typeof p.redirectUrl !== 'string')) {
      throw new ValidationError('redirectUrl is required for redirect action', 'redirectUrl', p.redirectUrl);
    }

    // Validate patterns are valid regex
    p.patterns.forEach((pattern: any, index: number) => {
      if (typeof pattern !== 'string') {
        throw new ValidationError(`Pattern at index ${index} must be a string`, 'patterns', pattern);
      }

      try {
        new RegExp(pattern);
      } catch (error) {
        throw new ValidationError(
          `Invalid regex pattern at index ${index}: ${error instanceof Error ? error.message : 'Invalid pattern'}`,
          'patterns',
          pattern
        );
      }
    });

    return {
      patterns: p.patterns,
      action: p.action,
      redirectUrl: p.redirectUrl,
      modifyHeaders: p.modifyHeaders
    };
  }
}