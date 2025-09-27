import { WebDriver } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import {
  GetPerformanceMetricsResult,
  ProfilePageLoadParams,
  ProfilePageLoadResult,
  AnalyzeRenderPerformanceParams,
  AnalyzeRenderPerformanceResult,
  PerformanceMetrics,
  LoadProfile,
  MCPToolResult
} from '../types/index.js';
import { ValidationError, createErrorResponse } from '../utils/errors.js';
import winston from 'winston';

export class PerformanceTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async getPerformanceMetrics(params: unknown = {}, sessionId?: string): Promise<MCPToolResult<GetPerformanceMetricsResult>> {
    const startTime = Date.now();
    this.logger.info('Executing get_performance_metrics tool', { params, sessionId });

    try {
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Getting performance metrics', { sessionId: actualSessionId });

      // Extract comprehensive performance metrics
      const metrics = await session.driver.executeScript(`
        const perfData = {
          navigation: {},
          resources: {},
          memory: {},
          fps: 0
        };

        // Navigation timing
        if (performance.timing) {
          const timing = performance.timing;
          perfData.navigation = {
            loadTime: timing.loadEventEnd - timing.navigationStart,
            domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
            firstPaint: 0,
            firstContentfulPaint: 0,
            largestContentfulPaint: 0,
            timeToInteractive: 0
          };

          // Get paint timing if available
          if (performance.getEntriesByType) {
            const paintEntries = performance.getEntriesByType('paint');
            paintEntries.forEach(entry => {
              if (entry.name === 'first-paint') {
                perfData.navigation.firstPaint = entry.startTime;
              } else if (entry.name === 'first-contentful-paint') {
                perfData.navigation.firstContentfulPaint = entry.startTime;
              }
            });

            // Get LCP if available
            const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
            if (lcpEntries.length > 0) {
              perfData.navigation.largestContentfulPaint = lcpEntries[lcpEntries.length - 1].startTime;
            }
          }
        }

        // Resource timing
        if (performance.getEntriesByType) {
          const resourceEntries = performance.getEntriesByType('resource');
          let totalSize = 0;
          let cachedSize = 0;
          let totalDuration = 0;

          resourceEntries.forEach(entry => {
            totalDuration += entry.duration;

            // Estimate size (not perfect but useful)
            if (entry.transferSize !== undefined) {
              totalSize += entry.transferSize;
              if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
                cachedSize += entry.decodedBodySize;
              }
            }
          });

          perfData.resources = {
            count: resourceEntries.length,
            totalSize: totalSize,
            cachedSize: cachedSize,
            averageDuration: resourceEntries.length > 0 ? totalDuration / resourceEntries.length : 0
          };
        }

        // Memory information
        if (performance.memory) {
          perfData.memory = {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          };
        }

        // FPS estimation (simplified)
        if (window.requestAnimationFrame) {
          let frameCount = 0;
          let lastTime = performance.now();

          const measureFPS = () => {
            frameCount++;
            const currentTime = performance.now();
            if (currentTime - lastTime >= 1000) {
              perfData.fps = Math.round(frameCount * 1000 / (currentTime - lastTime));
            }
          };

          // Sample for a short period
          for (let i = 0; i < 60; i++) {
            requestAnimationFrame(measureFPS);
          }
        }

        return perfData;
      `);

      const result: GetPerformanceMetricsResult = {
        metrics: metrics as PerformanceMetrics
      };

      this.logger.info('Performance metrics collection completed', {
        loadTime: result.metrics.navigation.loadTime,
        resourceCount: result.metrics.resources.count,
        memoryUsed: result.metrics.memory?.usedJSHeapSize,
        fps: result.metrics.fps,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'getPerformanceMetrics', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Performance metrics collection failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'getPerformanceMetrics', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Performance metrics collection failed'));
    }
  }

  async profilePageLoad(params: unknown, sessionId?: string): Promise<MCPToolResult<ProfilePageLoadResult>> {
    const startTime = Date.now();
    this.logger.info('Executing profile_page_load tool', { params, sessionId });

    try {
      const validatedParams = this.validateProfilePageLoadParams(params);
      const {
        url,
        iterations = 1,
        clearCache = false,
        throttling
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Starting page load profiling', {
        url,
        iterations,
        clearCache,
        throttling,
        sessionId: actualSessionId
      });

      const profiles: LoadProfile[] = [];

      // Apply throttling if specified
      if (throttling) {
        await this.applyThrottling(session.driver, throttling);
      }

      // Run multiple iterations
      for (let i = 0; i < iterations; i++) {
        this.logger.debug(`Starting iteration ${i + 1}/${iterations}`, { url });

        const iterationStart = Date.now();

        // Clear cache if requested
        if (clearCache) {
          await session.driver.executeScript(`
            if ('caches' in window) {
              caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
              });
            }
          `);
        }

        // Navigate to URL
        await session.driver.get(url);

        // Wait for page to fully load
        await session.driver.wait(async () => {
          const readyState = await session.driver.executeScript('return document.readyState;');
          return readyState === 'complete';
        }, 30000);

        // Get performance metrics for this iteration
        const metricsResult = await this.getPerformanceMetrics({}, sessionId);
        if (metricsResult.status === 'success') {
          profiles.push({
            iteration: i + 1,
            metrics: metricsResult.data!.metrics,
            timestamp: iterationStart
          });
        }

        // Wait between iterations
        if (i < iterations - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Calculate averages
      const averages = this.calculateAverageMetrics(profiles);

      // Generate recommendations
      const recommendations = this.generatePerformanceRecommendations(averages, profiles);

      const result: ProfilePageLoadResult = {
        profiles,
        averages,
        recommendations
      };

      this.logger.info('Page load profiling completed', {
        url,
        iterations,
        avgLoadTime: averages.navigation.loadTime,
        avgResourceCount: averages.resources.count,
        recommendationsCount: recommendations.length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'profilePageLoad', url, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Page load profiling failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'profilePageLoad', (params as any)?.url, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Page load profiling failed'));
    }
  }

  async analyzeRenderPerformance(params: unknown, sessionId?: string): Promise<MCPToolResult<AnalyzeRenderPerformanceResult>> {
    const startTime = Date.now();
    this.logger.info('Executing analyze_render_performance tool', { params, sessionId });

    try {
      const validatedParams = this.validateAnalyzeRenderPerformanceParams(params);
      const { duration, interactions } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Starting render performance analysis', {
        duration,
        interactionsCount: interactions?.length || 0,
        sessionId: actualSessionId
      });

      // Start render performance monitoring
      const renderData = await session.driver.executeScript(`
        const monitoringDuration = arguments[0];
        const interactions = arguments[1] || [];

        return new Promise((resolve) => {
          const renderMetrics = {
            fps: [],
            jank: 0,
            longTasks: [],
            layouts: 0,
            paints: 0,
            compositeLayers: 0
          };

          const issues = [];
          const startTime = performance.now();

          // FPS monitoring
          let frameCount = 0;
          let lastFrameTime = startTime;

          const measureFrame = (currentTime) => {
            frameCount++;
            const deltaTime = currentTime - lastFrameTime;

            if (deltaTime >= 1000) {
              const fps = Math.round(frameCount * 1000 / deltaTime);
              renderMetrics.fps.push(fps);

              // Detect jank (FPS below 30)
              if (fps < 30) {
                renderMetrics.jank++;
              }

              frameCount = 0;
              lastFrameTime = currentTime;
            }

            if (currentTime - startTime < monitoringDuration) {
              requestAnimationFrame(measureFrame);
            }
          };

          requestAnimationFrame(measureFrame);

          // Long task observer
          if ('PerformanceObserver' in window) {
            try {
              const longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                  if (entry.duration > 50) { // Long task threshold
                    renderMetrics.longTasks.push({
                      start: entry.startTime,
                      duration: entry.duration
                    });
                  }
                });
              });

              longTaskObserver.observe({ entryTypes: ['longtask'] });

              // Layout and paint observer
              const layoutObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                  if (entry.name === 'layout') renderMetrics.layouts++;
                  if (entry.name === 'paint') renderMetrics.paints++;
                });
              });

              // Note: layout/paint observation requires special setup
              // This is a simplified version
            } catch (e) {
              issues.push('PerformanceObserver not fully supported');
            }
          }

          // Execute interactions if provided
          interactions.forEach((interaction, index) => {
            setTimeout(() => {
              try {
                const element = document.querySelector(interaction.selector);
                if (element) {
                  switch (interaction.action) {
                    case 'click':
                      element.click();
                      break;
                    case 'scroll':
                      element.scrollIntoView();
                      break;
                    case 'hover':
                      element.dispatchEvent(new MouseEvent('mouseover'));
                      break;
                  }
                }
              } catch (e) {
                issues.push('Interaction failed: ' + interaction.action + ' on ' + interaction.selector);
              }
            }, (index + 1) * 1000); // Spread interactions over time
          });

          // Resolve after monitoring duration
          setTimeout(() => {
            // Analyze results
            if (renderMetrics.fps.length > 0) {
              const avgFPS = renderMetrics.fps.reduce((sum, fps) => sum + fps, 0) / renderMetrics.fps.length;
              if (avgFPS < 30) {
                issues.push('Low average FPS detected: ' + avgFPS.toFixed(1));
              }
            }

            if (renderMetrics.longTasks.length > 0) {
              issues.push(renderMetrics.longTasks.length + ' long tasks detected');
            }

            if (renderMetrics.jank > renderMetrics.fps.length * 0.1) {
              issues.push('Significant frame drops detected (jank)');
            }

            resolve({
              renderMetrics: renderMetrics,
              issues: issues
            });
          }, monitoringDuration);
        });
      `, duration, interactions);

      const result = renderData as AnalyzeRenderPerformanceResult;

      this.logger.info('Render performance analysis completed', {
        duration,
        avgFPS: result.renderMetrics.fps.length > 0 ?
          result.renderMetrics.fps.reduce((sum, fps) => sum + fps, 0) / result.renderMetrics.fps.length : 0,
        longTasks: result.renderMetrics.longTasks.length,
        jankEvents: result.renderMetrics.jank,
        issuesCount: result.issues.length,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'analyzeRenderPerformance', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Render performance analysis failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'analyzeRenderPerformance', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Render performance analysis failed'));
    }
  }

  // Private helper methods

  private async applyThrottling(driver: WebDriver, throttling: any): Promise<void> {
    try {
      // Note: This is a simplified implementation
      // Real throttling would require Chrome DevTools Protocol
      this.logger.debug('Applying performance throttling', throttling);

      if (throttling.network) {
        // Network throttling would be implemented via CDP
        this.logger.warn('Network throttling not fully implemented - requires Chrome DevTools Protocol');
      }

      if (throttling.cpu && throttling.cpu > 1) {
        // CPU throttling simulation
        await driver.executeScript(`
          const slowdownFactor = arguments[0];

          // Simulate CPU slowdown with busy work
          window.MCPCPUThrottle = {
            active: true,
            factor: slowdownFactor
          };

          const originalSetTimeout = window.setTimeout;
          window.setTimeout = function(callback, delay) {
            return originalSetTimeout(callback, delay * slowdownFactor);
          };
        `, throttling.cpu);
      }

    } catch (error) {
      this.logger.warn('Failed to apply throttling', { throttling, error });
    }
  }

  private calculateAverageMetrics(profiles: LoadProfile[]): PerformanceMetrics {
    if (profiles.length === 0) {
      return {
        navigation: {
          loadTime: 0,
          domContentLoaded: 0,
          firstPaint: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          timeToInteractive: 0
        },
        resources: {
          count: 0,
          totalSize: 0,
          cachedSize: 0,
          averageDuration: 0
        }
      };
    }

    const totalProfiles = profiles.length;

    const averages: PerformanceMetrics = {
      navigation: {
        loadTime: 0,
        domContentLoaded: 0,
        firstPaint: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        timeToInteractive: 0
      },
      resources: {
        count: 0,
        totalSize: 0,
        cachedSize: 0,
        averageDuration: 0
      }
    };

    // Sum all metrics
    profiles.forEach(profile => {
      averages.navigation.loadTime += profile.metrics.navigation.loadTime;
      averages.navigation.domContentLoaded += profile.metrics.navigation.domContentLoaded;
      averages.navigation.firstPaint += profile.metrics.navigation.firstPaint;
      averages.navigation.firstContentfulPaint += profile.metrics.navigation.firstContentfulPaint;
      averages.navigation.largestContentfulPaint += profile.metrics.navigation.largestContentfulPaint;
      averages.navigation.timeToInteractive += profile.metrics.navigation.timeToInteractive;

      averages.resources.count += profile.metrics.resources.count;
      averages.resources.totalSize += profile.metrics.resources.totalSize;
      averages.resources.cachedSize += profile.metrics.resources.cachedSize;
      averages.resources.averageDuration += profile.metrics.resources.averageDuration;
    });

    // Calculate averages
    averages.navigation.loadTime /= totalProfiles;
    averages.navigation.domContentLoaded /= totalProfiles;
    averages.navigation.firstPaint /= totalProfiles;
    averages.navigation.firstContentfulPaint /= totalProfiles;
    averages.navigation.largestContentfulPaint /= totalProfiles;
    averages.navigation.timeToInteractive /= totalProfiles;

    averages.resources.count /= totalProfiles;
    averages.resources.totalSize /= totalProfiles;
    averages.resources.cachedSize /= totalProfiles;
    averages.resources.averageDuration /= totalProfiles;

    // Add memory and FPS averages if available
    const memoryProfiles = profiles.filter(p => p.metrics.memory);
    if (memoryProfiles.length > 0) {
      averages.memory = {
        usedJSHeapSize: memoryProfiles.reduce((sum, p) => sum + p.metrics.memory!.usedJSHeapSize, 0) / memoryProfiles.length,
        totalJSHeapSize: memoryProfiles.reduce((sum, p) => sum + p.metrics.memory!.totalJSHeapSize, 0) / memoryProfiles.length,
        jsHeapSizeLimit: memoryProfiles.reduce((sum, p) => sum + p.metrics.memory!.jsHeapSizeLimit, 0) / memoryProfiles.length
      };
    }

    const fpsProfiles = profiles.filter(p => p.metrics.fps);
    if (fpsProfiles.length > 0) {
      averages.fps = fpsProfiles.reduce((sum, p) => sum + p.metrics.fps!, 0) / fpsProfiles.length;
    }

    return averages;
  }

  private generatePerformanceRecommendations(averages: PerformanceMetrics, profiles: LoadProfile[]): string[] {
    const recommendations: string[] = [];

    // Load time recommendations
    if (averages.navigation.loadTime > 3000) {
      recommendations.push('Page load time is slow (>3s). Consider optimizing resources and reducing payload size.');
    }

    if (averages.navigation.firstContentfulPaint > 2500) {
      recommendations.push('First Contentful Paint is slow (>2.5s). Optimize critical rendering path.');
    }

    if (averages.navigation.largestContentfulPaint > 4000) {
      recommendations.push('Largest Contentful Paint is slow (>4s). Optimize largest content elements.');
    }

    // Resource recommendations
    if (averages.resources.count > 100) {
      recommendations.push('High number of resources (' + Math.round(averages.resources.count) + '). Consider bundling and reducing HTTP requests.');
    }

    if (averages.resources.totalSize > 5 * 1024 * 1024) { // 5MB
      recommendations.push('Large total resource size. Consider compression and optimization.');
    }

    // Memory recommendations
    if (averages.memory && averages.memory.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
      recommendations.push('High JavaScript memory usage. Check for memory leaks and optimize code.');
    }

    // FPS recommendations
    if (averages.fps && averages.fps < 30) {
      recommendations.push('Low frame rate detected. Optimize animations and reduce DOM complexity.');
    }

    // Variance analysis
    if (profiles.length > 1) {
      const loadTimes = profiles.map(p => p.metrics.navigation.loadTime);
      const variance = this.calculateVariance(loadTimes);

      if (variance > 1000) { // High variance
        recommendations.push('Inconsistent load times detected. Check for network issues or server performance.');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance appears to be within acceptable ranges.');
    }

    return recommendations;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private async getDefaultSession(): Promise<string> {
    const sessions = this.sessionManager.listSessions();
    if (sessions.length > 0) {
      return sessions[0].id;
    }
    throw new Error('No session ID provided and no active sessions available. Create a session first.');
  }

  // Validation methods

  private validateProfilePageLoadParams(params: unknown): ProfilePageLoadParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!p.url || typeof p.url !== 'string') {
      throw new ValidationError('url is required and must be a string', 'url', p.url);
    }

    // Validate URL format
    try {
      new URL(p.url);
    } catch {
      throw new ValidationError('Invalid URL format', 'url', p.url);
    }

    if (p.iterations && (typeof p.iterations !== 'number' || p.iterations < 1 || p.iterations > 20)) {
      throw new ValidationError('iterations must be a number between 1 and 20', 'iterations', p.iterations);
    }

    // Validate throttling options
    if (p.throttling) {
      if (typeof p.throttling !== 'object') {
        throw new ValidationError('throttling must be an object', 'throttling', p.throttling);
      }

      if (p.throttling.cpu && (typeof p.throttling.cpu !== 'number' || p.throttling.cpu < 1 || p.throttling.cpu > 10)) {
        throw new ValidationError('throttling.cpu must be a number between 1 and 10', 'throttling.cpu', p.throttling.cpu);
      }

      const validNetworkTypes = ['offline', 'slow-2g', 'fast-3g', '4g'];
      if (p.throttling.network && !validNetworkTypes.includes(p.throttling.network)) {
        throw new ValidationError(
          `throttling.network must be one of: ${validNetworkTypes.join(', ')}`,
          'throttling.network',
          p.throttling.network
        );
      }
    }

    return {
      url: p.url,
      iterations: p.iterations,
      clearCache: p.clearCache,
      throttling: p.throttling
    };
  }

  private validateAnalyzeRenderPerformanceParams(params: unknown): AnalyzeRenderPerformanceParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (typeof p.duration !== 'number' || p.duration < 1000 || p.duration > 60000) {
      throw new ValidationError('duration is required and must be a number between 1000 and 60000 ms', 'duration', p.duration);
    }

    if (p.interactions && !Array.isArray(p.interactions)) {
      throw new ValidationError('interactions must be an array', 'interactions', p.interactions);
    }

    // Validate interaction objects
    if (p.interactions) {
      p.interactions.forEach((interaction: any, index: number) => {
        if (!interaction.action || typeof interaction.action !== 'string') {
          throw new ValidationError(`interactions[${index}].action is required and must be a string`, 'interaction.action', interaction.action);
        }

        if (!interaction.selector || typeof interaction.selector !== 'string') {
          throw new ValidationError(`interactions[${index}].selector is required and must be a string`, 'interaction.selector', interaction.selector);
        }

        const validActions = ['click', 'scroll', 'hover'];
        if (!validActions.includes(interaction.action)) {
          throw new ValidationError(
            `interactions[${index}].action must be one of: ${validActions.join(', ')}`,
            'interaction.action',
            interaction.action
          );
        }
      });
    }

    return {
      duration: p.duration,
      interactions: p.interactions
    };
  }
}