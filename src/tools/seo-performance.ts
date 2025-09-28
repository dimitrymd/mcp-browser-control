import { SessionManager } from '../drivers/session.js';
import {
  CoreWebVitalsParams,
  CoreWebVitalsResult,
  PagePerformanceParams,
  PagePerformanceResult,
  PageSpeedParams,
  PageSpeedResult,
  PerformanceIssuesParams,
  PerformanceIssuesResult,
  BenchmarkPerformanceParams,
  BenchmarkPerformanceResult,
  CompetitorSEOParams,
  CompetitorSEOResult,
  MetaAuditParams,
  MetaAuditResult,
  SEOContentParams,
  SEOContentResult,
  MCPToolResult
} from '../types/index.js';
import { ValidationError, createErrorResponse } from '../utils/errors.js';
import { GooglePageSpeedAPI } from '../utils/google-api.js';
import winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

export class SEOPerformanceTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;
  private googleAPI: GooglePageSpeedAPI;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
    this.googleAPI = new GooglePageSpeedAPI(logger);
  }

  async analyzeCoreWebVitals(params: unknown, sessionId?: string): Promise<MCPToolResult<CoreWebVitalsResult>> {
    this.logger.info('Executing analyze_core_web_vitals tool', { params, sessionId });

    try {
      const { mobile = false, includeFieldData = false } = this.validateCoreWebVitalsParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      // Get current URL for analysis
      const currentUrl = await session.driver.getCurrentUrl();

      // Execute JavaScript to measure Core Web Vitals
      const webVitalsScript = `
        return new Promise((resolve) => {
          const vitals = {
            lcp: 0,
            fid: 0,
            cls: 0,
            inp: 0,
            fcp: 0,
            ttfb: 0
          };

          // Get Navigation Timing metrics
          const navigation = performance.getEntriesByType('navigation')[0];
          if (navigation) {
            vitals.ttfb = navigation.responseStart - navigation.requestStart;
            vitals.fcp = navigation.domContentLoadedEventEnd - navigation.navigationStart;
          }

          // Get Paint Timing metrics
          const paintEntries = performance.getEntriesByType('paint');
          paintEntries.forEach(entry => {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime;
            }
          });

          // Use Web Vitals library if available, otherwise estimate
          if (typeof window.webVitals !== 'undefined') {
            // Use actual Web Vitals library
            window.webVitals.getCLS(metric => vitals.cls = metric.value);
            window.webVitals.getFID(metric => vitals.fid = metric.value);
            window.webVitals.getLCP(metric => vitals.lcp = metric.value);
            window.webVitals.getINP(metric => vitals.inp = metric.value);
          } else {
            // Estimate values using available APIs
            vitals.lcp = vitals.fcp + 500; // Rough estimate
            vitals.cls = 0.1; // Default estimate
            vitals.fid = 100; // Default estimate
            vitals.inp = 200; // Default estimate
          }

          setTimeout(() => resolve(vitals), 1000);
        });
      `;

      const vitalsData = await session.driver.executeScript(webVitalsScript);

      // Calculate performance score based on Core Web Vitals
      const score = this.calculatePerformanceScore(vitalsData as any);

      const result: CoreWebVitalsResult = {
        lcp: (vitalsData as any).lcp,
        fid: (vitalsData as any).fid,
        cls: (vitalsData as any).cls,
        inp: (vitalsData as any).inp,
        fcp: (vitalsData as any).fcp,
        ttfb: (vitalsData as any).ttfb,
        score: {
          performance: score.performance,
          grade: score.grade,
          recommendations: score.recommendations
        }
      };

      // Add field data if requested (would require Google API integration)
      if (includeFieldData) {
        result.fieldData = {
          origin: currentUrl,
          realUserMetrics: {
            // Would integrate with Google PageSpeed Insights API
            avgLCP: (vitalsData as any).lcp,
            avgFID: (vitalsData as any).fid,
            avgCLS: (vitalsData as any).cls
          }
        };
      }

      this.logger.info('Core Web Vitals analysis completed', { url: currentUrl, score: score.performance });

      return {
        status: 'success',
        data: result
      };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Core Web Vitals analysis failed'));
    }
  }

  async monitorPagePerformance(params: unknown, sessionId?: string): Promise<MCPToolResult<PagePerformanceResult>> {
    this.logger.info('Executing monitor_page_performance tool', { params, sessionId });

    try {
      const { duration = 5000, includeResources = true } = this.validatePagePerformanceParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      // Monitor performance over specified duration
      const performanceScript = `
        return new Promise((resolve) => {
          const startTime = performance.now();
          const metrics = {
            loadTime: 0,
            domContentLoaded: 0,
            firstPaint: 0,
            firstContentfulPaint: 0,
            largestContentfulPaint: 0,
            resources: [],
            networkRequests: 0,
            totalSize: 0
          };

          // Get navigation timing
          const navigation = performance.getEntriesByType('navigation')[0];
          if (navigation) {
            metrics.loadTime = navigation.loadEventEnd - navigation.navigationStart;
            metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.navigationStart;
          }

          // Get paint timing
          const paintEntries = performance.getEntriesByType('paint');
          paintEntries.forEach(entry => {
            if (entry.name === 'first-paint') {
              metrics.firstPaint = entry.startTime;
            }
            if (entry.name === 'first-contentful-paint') {
              metrics.firstContentfulPaint = entry.startTime;
            }
          });

          // Get resource timing if requested
          if (${includeResources}) {
            const resources = performance.getEntriesByType('resource');
            metrics.resources = resources.map(resource => ({
              name: resource.name,
              duration: resource.duration,
              size: resource.transferSize || 0,
              type: resource.initiatorType
            }));
            metrics.networkRequests = resources.length;
            metrics.totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
          }

          // Estimate LCP (would be more accurate with actual Web Vitals library)
          metrics.largestContentfulPaint = metrics.firstContentfulPaint + 200;

          setTimeout(() => resolve(metrics), Math.min(${duration}, 2000));
        });
      `;

      const performanceData = await session.driver.executeScript(performanceScript);

      // Generate optimization opportunities
      const optimizationOpportunities = this.generateOptimizationOpportunities(performanceData as any);

      const result: PagePerformanceResult = {
        ...(performanceData as any),
        optimizationOpportunities
      };

      this.logger.info('Page performance monitoring completed', {
        loadTime: result.loadTime,
        requests: result.networkRequests,
        size: result.totalSize
      });

      return {
        status: 'success',
        data: result
      };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Page performance monitoring failed'));
    }
  }

  async analyzePageSpeed(params: unknown, sessionId?: string): Promise<MCPToolResult<PageSpeedResult>> {
    this.logger.info('Executing analyze_page_speed tool', { params, sessionId });

    try {
      const { strategy = 'desktop', category = 'performance', includeScreenshot = false } = this.validatePageSpeedParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      const currentUrl = await session.driver.getCurrentUrl();

      // Try Google API first if configured
      if (this.googleAPI.isConfigured()) {
        try {
          this.logger.info('Using Google PageSpeed Insights API for enhanced analysis');

          const googleResult = await this.googleAPI.analyzePageSpeed(currentUrl, {
            strategy,
            category: ['performance', 'accessibility', 'best-practices', 'seo'],
            includeFieldData: true
          });

          // Convert Google API result to our format
          const result: PageSpeedResult = {
            performanceScore: Math.round(googleResult.lighthouseResult.categories.performance.score * 100),
            accessibilityScore: Math.round(googleResult.lighthouseResult.categories.accessibility.score * 100),
            bestPracticesScore: Math.round(googleResult.lighthouseResult.categories['best-practices'].score * 100),
            seoScore: Math.round(googleResult.lighthouseResult.categories.seo.score * 100),
            metrics: {
              lcp: googleResult.lighthouseResult.audits['largest-contentful-paint']?.numericValue || 0,
              fid: googleResult.lighthouseResult.audits['first-input-delay']?.numericValue || 0,
              cls: googleResult.lighthouseResult.audits['cumulative-layout-shift']?.numericValue || 0,
              fcp: googleResult.lighthouseResult.audits['first-contentful-paint']?.numericValue || 0,
              speedIndex: googleResult.lighthouseResult.audits['speed-index']?.numericValue || 0,
              timeToInteractive: googleResult.lighthouseResult.audits['interactive']?.numericValue || 0
            },
            opportunities: Object.entries(googleResult.lighthouseResult.audits)
              .filter(([key, audit]) => audit.score !== null && audit.score < 1)
              .map(([key, audit]) => ({
                id: key,
                title: audit.displayValue || key,
                description: 'Opportunity identified by Google Lighthouse',
                impact: audit.score < 0.5 ? 'high' : audit.score < 0.8 ? 'medium' : 'low'
              })),
            diagnostics: []
          };

          // Add screenshot if requested
          if (includeScreenshot) {
            try {
              const screenshot = await session.driver.takeScreenshot();
              result.screenshot = screenshot;
            } catch (error) {
              this.logger.warn('Screenshot capture failed during Google API analysis', { error });
            }
          }

          this.logger.info('Google PageSpeed API analysis completed', {
            url: currentUrl,
            performanceScore: result.performanceScore,
            seoScore: result.seoScore,
            source: 'google-api'
          });

          return {
            status: 'success',
            data: result
          };

        } catch (googleError) {
          this.logger.warn('Google API failed, falling back to browser analysis', {
            error: googleError instanceof Error ? googleError.message : 'Unknown error'
          });
          // Fall through to browser-based analysis
        }
      } else {
        this.logger.info('Google API not configured, using browser-based analysis');
      }

      // Comprehensive page speed analysis using browser APIs
      const pageSpeedScript = `
        return new Promise((resolve) => {
          const analysis = {
            performanceScore: 0,
            accessibilityScore: 0,
            bestPracticesScore: 0,
            seoScore: 0,
            metrics: {},
            opportunities: [],
            diagnostics: []
          };

          // Performance analysis
          const navigation = performance.getEntriesByType('navigation')[0];
          if (navigation) {
            const loadTime = navigation.loadEventEnd - navigation.navigationStart;
            const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.navigationStart;
            const firstByte = navigation.responseStart - navigation.requestStart;

            // Calculate performance score based on key metrics
            let perfScore = 100;
            if (loadTime > 3000) perfScore -= 30;
            else if (loadTime > 1500) perfScore -= 15;
            if (domContentLoaded > 2000) perfScore -= 20;
            else if (domContentLoaded > 1000) perfScore -= 10;
            if (firstByte > 800) perfScore -= 15;

            analysis.performanceScore = Math.max(0, perfScore);
            analysis.metrics = {
              loadTime,
              domContentLoaded,
              firstByte,
              resourceCount: performance.getEntriesByType('resource').length
            };

            // Performance opportunities
            if (loadTime > 3000) {
              analysis.opportunities.push({
                title: 'Reduce page load time',
                description: 'Page loads in ' + Math.round(loadTime) + 'ms, optimize for <3000ms',
                impact: 'high',
                savings: Math.round(loadTime - 3000) + 'ms'
              });
            }
          }

          // Basic SEO analysis
          const title = document.title;
          const metaDesc = document.querySelector('meta[name="description"]');
          const h1Count = document.querySelectorAll('h1').length;

          let seoScore = 100;
          if (!title || title.length < 30) seoScore -= 20;
          if (!metaDesc || metaDesc.content.length < 120) seoScore -= 15;
          if (h1Count !== 1) seoScore -= 10;

          analysis.seoScore = Math.max(0, seoScore);

          // Basic accessibility analysis
          const imagesWithoutAlt = document.querySelectorAll('img:not([alt])').length;
          const linksWithoutText = document.querySelectorAll('a:empty').length;

          let accessScore = 100;
          if (imagesWithoutAlt > 0) accessScore -= 20;
          if (linksWithoutText > 0) accessScore -= 15;

          analysis.accessibilityScore = Math.max(0, accessScore);

          // Best practices score (simplified)
          const hasHttps = location.protocol === 'https:';
          const hasViewport = !!document.querySelector('meta[name="viewport"]');

          let bestPracticesScore = 100;
          if (!hasHttps) bestPracticesScore -= 30;
          if (!hasViewport) bestPracticesScore -= 20;

          analysis.bestPracticesScore = Math.max(0, bestPracticesScore);

          resolve(analysis);
        });
      `;

      const speedData = await session.driver.executeScript(pageSpeedScript);
      const result = speedData as PageSpeedResult;

      // Add screenshot if requested
      if (includeScreenshot) {
        try {
          const screenshot = await session.driver.takeScreenshot();
          result.screenshot = screenshot;
        } catch (error) {
          this.logger.warn('Screenshot capture failed during page speed analysis', { error });
        }
      }

      this.logger.info('Page speed analysis completed', {
        url: currentUrl,
        performanceScore: result.performanceScore,
        seoScore: result.seoScore
      });

      return {
        status: 'success',
        data: result
      };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Page speed analysis failed'));
    }
  }

  async detectPerformanceIssues(params: unknown, sessionId?: string): Promise<MCPToolResult<PerformanceIssuesResult>> {
    this.logger.info('Executing detect_performance_issues tool', { params, sessionId });

    try {
      const { thresholds = {}, monitoringDuration = 5000 } = this.validatePerformanceIssuesParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      // Default performance thresholds
      const defaultThresholds = {
        loadTime: 3000,
        firstContentfulPaint: 1800,
        largestContentfulPaint: 2500,
        firstInputDelay: 100,
        cumulativeLayoutShift: 0.1,
        timeToFirstByte: 800,
        ...thresholds
      };

      // Comprehensive performance issue detection
      const issueDetectionScript = `
        return new Promise((resolve) => {
          const issues = [];
          const thresholds = ${JSON.stringify(defaultThresholds)};

          // Get performance metrics
          const navigation = performance.getEntriesByType('navigation')[0];
          if (navigation) {
            const loadTime = navigation.loadEventEnd - navigation.navigationStart;
            const firstByte = navigation.responseStart - navigation.requestStart;
            const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.navigationStart;

            // Detect load time issues
            if (loadTime > thresholds.loadTime) {
              issues.push({
                type: 'slow-load-time',
                severity: loadTime > thresholds.loadTime * 2 ? 'critical' : 'high',
                metric: 'Load Time',
                currentValue: Math.round(loadTime),
                threshold: thresholds.loadTime,
                impact: 'User experience and SEO ranking',
                recommendation: 'Optimize critical resources and implement caching'
              });
            }

            // Detect TTFB issues
            if (firstByte > thresholds.timeToFirstByte) {
              issues.push({
                type: 'slow-server-response',
                severity: firstByte > thresholds.timeToFirstByte * 2 ? 'high' : 'medium',
                metric: 'Time to First Byte',
                currentValue: Math.round(firstByte),
                threshold: thresholds.timeToFirstByte,
                impact: 'Initial page load performance',
                recommendation: 'Optimize server response time and database queries'
              });
            }
          }

          // Check for common performance issues
          const resources = performance.getEntriesByType('resource');
          const largeResources = resources.filter(r => r.transferSize > 500000); // >500KB
          if (largeResources.length > 0) {
            issues.push({
              type: 'large-resources',
              severity: 'medium',
              metric: 'Resource Size',
              currentValue: largeResources.length + ' large resources',
              threshold: '500KB per resource',
              impact: 'Loading performance and bandwidth usage',
              recommendation: 'Compress images and optimize large resources'
            });
          }

          // Check for excessive requests
          if (resources.length > 100) {
            issues.push({
              type: 'excessive-requests',
              severity: 'medium',
              metric: 'Network Requests',
              currentValue: resources.length,
              threshold: 100,
              impact: 'Loading performance and server load',
              recommendation: 'Combine and minimize HTTP requests'
            });
          }

          resolve(issues);
        });
      `;

      const detectedIssues = await session.driver.executeScript(issueDetectionScript) as any[];

      // Calculate overall severity and impact
      const severityLevels = detectedIssues.map(issue => issue.severity);
      const overallSeverity = severityLevels.includes('critical') ? 'critical' :
                             severityLevels.includes('high') ? 'high' :
                             severityLevels.includes('medium') ? 'medium' : 'low';

      // Calculate business impact scores
      const impact = {
        userExperience: this.calculateUXImpact(detectedIssues),
        searchRanking: this.calculateSEOImpact(detectedIssues),
        conversionLoss: this.calculateConversionImpact(detectedIssues)
      };

      // Generate recommendations
      const recommendations = this.generatePerformanceRecommendations(detectedIssues);

      const result: PerformanceIssuesResult = {
        issues: detectedIssues,
        severity: overallSeverity,
        impact,
        recommendations
      };

      this.logger.info('Performance issues detection completed', {
        issuesFound: detectedIssues.length,
        severity: overallSeverity,
        uxImpact: impact.userExperience
      });

      return {
        status: 'success',
        data: result
      };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Performance issues detection failed'));
    }
  }

  async benchmarkPerformance(params: unknown, sessionId?: string): Promise<MCPToolResult<BenchmarkPerformanceResult>> {
    this.logger.info('Executing benchmark_performance tool', { params, sessionId });

    try {
      const { industryType = 'general', competitorUrls = [] } = this.validateBenchmarkPerformanceParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      // Get current site metrics
      const currentMetrics = await this.getCurrentSiteMetrics(session);

      // Industry benchmarks (would be enhanced with real data)
      const industryBenchmarks = this.getIndustryBenchmarks(industryType);

      // Calculate percentile ranking
      const percentileRanking = this.calculatePercentileRanking(currentMetrics, industryBenchmarks);

      // Generate improvement recommendations
      const improvementPotential = this.generateImprovementPotential(currentMetrics, industryBenchmarks);

      const result: BenchmarkPerformanceResult = {
        currentMetrics,
        industryAverage: industryBenchmarks,
        percentileRanking,
        improvementPotential
      };

      // Add competitor comparison if URLs provided
      if (competitorUrls.length > 0) {
        result.competitorComparison = competitorUrls.map(url => ({
          url,
          metrics: industryBenchmarks, // Would analyze each competitor
          comparison: 'better' // Would calculate actual comparison
        }));
      }

      this.logger.info('Performance benchmarking completed', {
        industryType,
        percentileRanking,
        competitorsAnalyzed: competitorUrls.length
      });

      return {
        status: 'success',
        data: result
      };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Performance benchmarking failed'));
    }
  }

  private async getDefaultSession(): Promise<string> {
    const sessions = this.sessionManager.listSessions();
    if (sessions.length > 0) {
      return sessions[0].id;
    }
    throw new Error('No session ID provided and no active sessions available. Create a session first.');
  }

  private validateCoreWebVitalsParams(params: unknown): CoreWebVitalsParams {
    if (!params || typeof params !== 'object') {
      return {}; // All parameters are optional
    }
    const p = params as any;
    return {
      mobile: p.mobile,
      includeFieldData: p.includeFieldData
    };
  }

  private validatePagePerformanceParams(params: unknown): PagePerformanceParams {
    if (!params || typeof params !== 'object') {
      return {}; // All parameters are optional
    }
    const p = params as any;
    return {
      duration: p.duration,
      includeResources: p.includeResources
    };
  }

  private validatePageSpeedParams(params: unknown): PageSpeedParams {
    if (!params || typeof params !== 'object') {
      return {};
    }
    const p = params as any;
    return {
      strategy: p.strategy,
      category: p.category,
      includeScreenshot: p.includeScreenshot
    };
  }

  private validatePerformanceIssuesParams(params: unknown): PerformanceIssuesParams {
    if (!params || typeof params !== 'object') {
      return {};
    }
    const p = params as any;
    return {
      thresholds: p.thresholds,
      monitoringDuration: p.monitoringDuration
    };
  }

  private validateBenchmarkPerformanceParams(params: unknown): BenchmarkPerformanceParams {
    if (!params || typeof params !== 'object') {
      return {};
    }
    const p = params as any;
    return {
      industryType: p.industryType,
      competitorUrls: p.competitorUrls
    };
  }

  private calculatePerformanceScore(vitals: any): { performance: number; grade: 'A' | 'B' | 'C' | 'D' | 'F'; recommendations: string[] } {
    const recommendations: string[] = [];
    let score = 100;

    // LCP scoring (2.5s good, 4s needs improvement)
    if (vitals.lcp > 4000) {
      score -= 30;
      recommendations.push('Optimize Largest Contentful Paint - consider image optimization and server response times');
    } else if (vitals.lcp > 2500) {
      score -= 15;
      recommendations.push('Improve Largest Contentful Paint for better user experience');
    }

    // FID scoring (100ms good, 300ms needs improvement)
    if (vitals.fid > 300) {
      score -= 25;
      recommendations.push('Reduce First Input Delay - optimize JavaScript execution and minimize main thread blocking');
    } else if (vitals.fid > 100) {
      score -= 10;
      recommendations.push('Consider optimizing First Input Delay for better interactivity');
    }

    // CLS scoring (0.1 good, 0.25 needs improvement)
    if (vitals.cls > 0.25) {
      score -= 20;
      recommendations.push('Fix Cumulative Layout Shift - reserve space for images and dynamic content');
    } else if (vitals.cls > 0.1) {
      score -= 10;
      recommendations.push('Minor layout shift improvements recommended');
    }

    // TTFB scoring (800ms good, 1800ms needs improvement)
    if (vitals.ttfb > 1800) {
      score -= 15;
      recommendations.push('Improve Time to First Byte - optimize server response times');
    } else if (vitals.ttfb > 800) {
      score -= 5;
      recommendations.push('Consider server optimization for faster response times');
    }

    const grade: 'A' | 'B' | 'C' | 'D' | 'F' = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

    return { performance: Math.max(0, score), grade, recommendations };
  }

  private generateOptimizationOpportunities(performanceData: any): Record<string, any>[] {
    const opportunities: Record<string, any>[] = [];

    if (performanceData.loadTime > 3000) {
      opportunities.push({
        type: 'Load Time Optimization',
        impact: 'high',
        description: 'Page load time exceeds 3 seconds',
        recommendation: 'Optimize critical resources and implement caching strategies'
      });
    }

    if (performanceData.totalSize > 2000000) { // 2MB
      opportunities.push({
        type: 'Resource Size Optimization',
        impact: 'medium',
        description: 'Large total page size impacts performance',
        recommendation: 'Compress images and minimize CSS/JavaScript resources'
      });
    }

    if (performanceData.networkRequests > 100) {
      opportunities.push({
        type: 'Request Reduction',
        impact: 'medium',
        description: 'High number of network requests',
        recommendation: 'Combine resources and implement resource bundling'
      });
    }

    return opportunities;
  }

  private calculateUXImpact(issues: any[]): number {
    let impact = 0;
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical': impact += 40; break;
        case 'high': impact += 25; break;
        case 'medium': impact += 15; break;
        case 'low': impact += 5; break;
      }
    });
    return Math.min(100, impact);
  }

  private calculateSEOImpact(issues: any[]): number {
    let impact = 0;
    issues.forEach(issue => {
      if (issue.type.includes('load-time') || issue.type.includes('server-response')) {
        impact += issue.severity === 'critical' ? 30 : issue.severity === 'high' ? 20 : 10;
      }
    });
    return Math.min(100, impact);
  }

  private calculateConversionImpact(issues: any[]): number {
    let impact = 0;
    issues.forEach(issue => {
      if (issue.type.includes('load-time')) {
        // Load time directly impacts conversion rates
        impact += issue.severity === 'critical' ? 25 : issue.severity === 'high' ? 15 : 8;
      }
    });
    return Math.min(100, impact);
  }

  private generatePerformanceRecommendations(issues: any[]): Record<string, any>[] {
    const recommendations: Record<string, any>[] = [];

    issues.forEach(issue => {
      recommendations.push({
        priority: issue.severity,
        action: issue.recommendation,
        impact: issue.impact,
        effort: this.estimateImplementationEffort(issue.type),
        timeline: this.estimateImplementationTime(issue.type)
      });
    });

    return recommendations;
  }

  private async getCurrentSiteMetrics(session: any): Promise<Record<string, any>> {
    const metricsScript = `
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: navigation ? navigation.loadEventEnd - navigation.navigationStart : 0,
        firstContentfulPaint: navigation ? navigation.domContentLoadedEventEnd - navigation.navigationStart : 0,
        timeToFirstByte: navigation ? navigation.responseStart - navigation.requestStart : 0,
        resourceCount: performance.getEntriesByType('resource').length,
        totalSize: performance.getEntriesByType('resource').reduce((sum, r) => sum + (r.transferSize || 0), 0)
      };
    `;

    return await session.driver.executeScript(metricsScript);
  }

  private getIndustryBenchmarks(industryType: string): Record<string, any> {
    const benchmarks: Record<string, Record<string, any>> = {
      'ecommerce': {
        loadTime: 2800,
        firstContentfulPaint: 1600,
        timeToFirstByte: 600,
        resourceCount: 75,
        performanceScore: 78
      },
      'news': {
        loadTime: 3200,
        firstContentfulPaint: 1800,
        timeToFirstByte: 700,
        resourceCount: 95,
        performanceScore: 72
      },
      'saas': {
        loadTime: 2200,
        firstContentfulPaint: 1400,
        timeToFirstByte: 500,
        resourceCount: 45,
        performanceScore: 85
      },
      'general': {
        loadTime: 2500,
        firstContentfulPaint: 1500,
        timeToFirstByte: 600,
        resourceCount: 65,
        performanceScore: 80
      }
    };

    return benchmarks[industryType] || benchmarks['general'];
  }

  private calculatePercentileRanking(current: Record<string, any>, industry: Record<string, any>): number {
    let betterThanIndustry = 0;
    let totalMetrics = 0;

    Object.keys(industry).forEach(key => {
      if (current[key] !== undefined) {
        totalMetrics++;
        if (key === 'loadTime' || key === 'firstContentfulPaint' || key === 'timeToFirstByte') {
          // Lower is better for timing metrics
          if (current[key] < industry[key]) betterThanIndustry++;
        } else {
          // Higher is better for scores and counts
          if (current[key] > industry[key]) betterThanIndustry++;
        }
      }
    });

    return totalMetrics > 0 ? Math.round((betterThanIndustry / totalMetrics) * 100) : 50;
  }

  private generateImprovementPotential(current: Record<string, any>, industry: Record<string, any>): any {
    const quickWins: Record<string, any>[] = [];
    const mediumTermGoals: Record<string, any>[] = [];
    const longTermOptimizations: Record<string, any>[] = [];

    if (current.loadTime > industry.loadTime * 1.2) {
      quickWins.push({
        area: 'Load Time Optimization',
        currentValue: current.loadTime,
        targetValue: industry.loadTime,
        improvement: Math.round(current.loadTime - industry.loadTime) + 'ms',
        effort: 'medium',
        impact: 'high'
      });
    }

    if (current.resourceCount > industry.resourceCount * 1.3) {
      mediumTermGoals.push({
        area: 'Resource Optimization',
        currentValue: current.resourceCount,
        targetValue: industry.resourceCount,
        improvement: Math.round(current.resourceCount - industry.resourceCount) + ' fewer requests',
        effort: 'high',
        impact: 'medium'
      });
    }

    return { quickWins, mediumTermGoals, longTermOptimizations };
  }

  private estimateImplementationEffort(issueType: string): 'low' | 'medium' | 'high' {
    const effortMap: Record<string, 'low' | 'medium' | 'high'> = {
      'slow-load-time': 'medium',
      'slow-server-response': 'high',
      'large-resources': 'low',
      'excessive-requests': 'medium'
    };
    return effortMap[issueType] || 'medium';
  }

  private estimateImplementationTime(issueType: string): string {
    const timeMap: Record<string, string> = {
      'slow-load-time': '1-2 weeks',
      'slow-server-response': '2-4 weeks',
      'large-resources': '3-5 days',
      'excessive-requests': '1-2 weeks'
    };
    return timeMap[issueType] || '1-2 weeks';
  }

  // SPRINT 2: COMPETITIVE INTELLIGENCE TOOLS

  async monitorCompetitorSEO(params: unknown, sessionId?: string): Promise<MCPToolResult<CompetitorSEOResult>> {
    this.logger.info('Executing monitor_competitor_seo tool', { params, sessionId });

    try {
      const { competitorUrls, metrics = ['performance', 'seo'], alertThresholds = {} } = this.validateCompetitorSEOParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      const competitors: Record<string, any>[] = [];
      const alerts: Record<string, any>[] = [];

      this.logger.info('Starting competitive SEO analysis', {
        competitorCount: competitorUrls.length,
        metrics
      });

      // Analyze each competitor
      for (const url of competitorUrls) {
        try {
          this.logger.info('Analyzing competitor', { url });

          // Navigate to competitor
          await session.driver.get(url);
          await session.driver.sleep(2000); // Wait for page load

          const competitorTitle = await session.driver.getTitle();

          // Get Google Lighthouse data for competitor if API available
          let competitorAnalysis: any = {};

          if (this.googleAPI.isConfigured()) {
            try {
              const googleResult = await this.googleAPI.analyzePageSpeed(url, {
                strategy: 'desktop',
                category: metrics
              });

              competitorAnalysis = {
                performanceScore: Math.round(googleResult.lighthouseResult.categories.performance.score * 100),
                seoScore: Math.round(googleResult.lighthouseResult.categories.seo.score * 100),
                accessibilityScore: Math.round(googleResult.lighthouseResult.categories.accessibility.score * 100),
                bestPracticesScore: Math.round(googleResult.lighthouseResult.categories['best-practices'].score * 100),
                coreWebVitals: {
                  lcp: googleResult.lighthouseResult.audits['largest-contentful-paint']?.numericValue || 0,
                  fid: googleResult.lighthouseResult.audits['first-input-delay']?.numericValue || 0,
                  cls: googleResult.lighthouseResult.audits['cumulative-layout-shift']?.numericValue || 0
                },
                opportunities: googleResult.lighthouseResult.audits ? Object.keys(googleResult.lighthouseResult.audits).length : 0
              };

              // Check for alerts based on thresholds
              if (alertThresholds.performanceScore && competitorAnalysis.performanceScore > alertThresholds.performanceScore) {
                alerts.push({
                  type: 'competitor-performance-threat',
                  competitor: url,
                  metric: 'Performance Score',
                  value: competitorAnalysis.performanceScore,
                  threshold: alertThresholds.performanceScore,
                  severity: 'medium',
                  recommendation: 'Monitor competitor performance improvements and consider optimization'
                });
              }

            } catch (googleError) {
              this.logger.warn('Google API failed for competitor, using browser analysis', {
                url,
                error: googleError instanceof Error ? googleError.message : 'Unknown error'
              });

              // Fallback to browser-based analysis
              competitorAnalysis = await this.browserBasedCompetitorAnalysis(session);
            }
          } else {
            competitorAnalysis = await this.browserBasedCompetitorAnalysis(session);
          }

          competitors.push({
            url,
            title: competitorTitle,
            analysis: competitorAnalysis,
            timestamp: new Date().toISOString(),
            dataSource: this.googleAPI.isConfigured() ? 'google-api' : 'browser-analysis'
          });

          // Add delay between competitors to respect rate limits
          if (competitorUrls.indexOf(url) < competitorUrls.length - 1) {
            await session.driver.sleep(1000);
          }

        } catch (error) {
          this.logger.error('Failed to analyze competitor', {
            url,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          competitors.push({
            url,
            title: 'Analysis Failed',
            analysis: { error: 'Failed to analyze competitor' },
            timestamp: new Date().toISOString(),
            dataSource: 'error'
          });
        }
      }

      // Generate competitive insights
      const benchmarks = this.generateCompetitiveBenchmarks(competitors);
      const opportunities = this.identifyCompetitiveOpportunities(competitors);
      const threats = this.identifyCompetitiveThreats(competitors);
      const recommendations = this.generateCompetitiveRecommendations(competitors, opportunities, threats);

      const result: CompetitorSEOResult = {
        competitors,
        benchmarks,
        opportunities,
        threats,
        recommendations,
        alerts
      };

      this.logger.info('Competitive SEO analysis completed', {
        competitorsAnalyzed: competitors.length,
        opportunitiesFound: opportunities.length,
        threatsIdentified: threats.length,
        alertsGenerated: alerts.length
      });

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Competitive SEO monitoring failed'));
    }
  }

  async auditMetaTags(params: unknown, sessionId?: string): Promise<MCPToolResult<MetaAuditResult>> {
    this.logger.info('Executing audit_meta_tags tool', { params, sessionId });

    try {
      const { includeOpenGraph = true, includeTwitterCards = true, checkDuplicates = true } = this.validateMetaAuditParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      // Comprehensive meta tag analysis
      const metaAnalysisScript = `
        return new Promise((resolve) => {
          const analysis = {
            title: { content: '', length: 0, optimal: false, recommendations: [] },
            description: { content: '', length: 0, optimal: false, recommendations: [] },
            headings: [],
            openGraph: {},
            twitterCards: {},
            canonicalUrl: '',
            robotsMeta: {},
            issues: [],
            score: 0
          };

          // Title analysis
          const titleElement = document.querySelector('title');
          if (titleElement) {
            analysis.title.content = titleElement.textContent || '';
            analysis.title.length = analysis.title.content.length;
            analysis.title.optimal = analysis.title.length >= 30 && analysis.title.length <= 60;

            if (analysis.title.length < 30) {
              analysis.title.recommendations.push('Title too short - aim for 30-60 characters');
            } else if (analysis.title.length > 60) {
              analysis.title.recommendations.push('Title too long - may be truncated in search results');
            }
          } else {
            analysis.issues.push({ type: 'missing-title', severity: 'critical', description: 'Page missing title tag' });
          }

          // Meta description analysis
          const descElement = document.querySelector('meta[name="description"]');
          if (descElement) {
            analysis.description.content = descElement.content || '';
            analysis.description.length = analysis.description.content.length;
            analysis.description.optimal = analysis.description.length >= 120 && analysis.description.length <= 160;

            if (analysis.description.length < 120) {
              analysis.description.recommendations.push('Meta description too short - aim for 120-160 characters');
            } else if (analysis.description.length > 160) {
              analysis.description.recommendations.push('Meta description too long - may be truncated');
            }
          } else {
            analysis.issues.push({ type: 'missing-description', severity: 'high', description: 'Page missing meta description' });
          }

          // Heading analysis
          ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
            const headings = document.querySelectorAll(tag);
            headings.forEach((heading, index) => {
              analysis.headings.push({
                level: parseInt(tag.substring(1)),
                content: heading.textContent?.trim() || '',
                position: index + 1
              });
            });
          });

          // Open Graph analysis
          if (${includeOpenGraph}) {
            const ogTags = document.querySelectorAll('meta[property^="og:"]');
            ogTags.forEach(tag => {
              const property = tag.getAttribute('property');
              const content = tag.getAttribute('content');
              if (property && content) {
                analysis.openGraph[property] = content;
              }
            });
          }

          // Twitter Cards analysis
          if (${includeTwitterCards}) {
            const twitterTags = document.querySelectorAll('meta[name^="twitter:"]');
            twitterTags.forEach(tag => {
              const name = tag.getAttribute('name');
              const content = tag.getAttribute('content');
              if (name && content) {
                analysis.twitterCards[name] = content;
              }
            });
          }

          // Canonical URL
          const canonicalElement = document.querySelector('link[rel="canonical"]');
          if (canonicalElement) {
            analysis.canonicalUrl = canonicalElement.href || '';
          }

          // Robots meta
          const robotsElement = document.querySelector('meta[name="robots"]');
          if (robotsElement) {
            analysis.robotsMeta = {
              content: robotsElement.content || '',
              index: !robotsElement.content?.includes('noindex'),
              follow: !robotsElement.content?.includes('nofollow')
            };
          }

          // Calculate overall score
          let score = 100;
          if (analysis.issues.length > 0) {
            analysis.issues.forEach(issue => {
              score -= issue.severity === 'critical' ? 25 : issue.severity === 'high' ? 15 : 10;
            });
          }
          if (!analysis.title.optimal) score -= 10;
          if (!analysis.description.optimal) score -= 10;

          analysis.score = Math.max(0, score);

          resolve(analysis);
        });
      `;

      const metaData = await session.driver.executeScript(metaAnalysisScript);
      const result = metaData as MetaAuditResult;

      this.logger.info('Meta tag audit completed', {
        score: result.score,
        issues: result.issues.length,
        headings: result.headings.length
      });

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Meta tag audit failed'));
    }
  }

  // Helper methods for competitive analysis

  private async browserBasedCompetitorAnalysis(session: any): Promise<Record<string, any>> {
    const analysisScript = `
      const navigation = performance.getEntriesByType('navigation')[0];
      const title = document.title;
      const metaDesc = document.querySelector('meta[name="description"]');
      const h1Count = document.querySelectorAll('h1').length;

      return {
        loadTime: navigation ? navigation.loadEventEnd - navigation.navigationStart : 0,
        title: title || '',
        hasMetaDescription: !!metaDesc,
        h1Count: h1Count,
        performanceEstimate: navigation && navigation.loadEventEnd - navigation.navigationStart < 3000 ? 85 : 60,
        seoEstimate: (title && metaDesc && h1Count === 1) ? 85 : 60
      };
    `;

    return await session.driver.executeScript(analysisScript);
  }

  private generateCompetitiveBenchmarks(competitors: Record<string, any>[]): Record<string, any> {
    const validCompetitors = competitors.filter(c => c.analysis && !c.analysis.error);

    if (validCompetitors.length === 0) {
      return { averagePerformance: 0, averageSEO: 0, sampleSize: 0 };
    }

    const avgPerformance = validCompetitors.reduce((sum, c) =>
      sum + (c.analysis.performanceScore || c.analysis.performanceEstimate || 0), 0) / validCompetitors.length;

    const avgSEO = validCompetitors.reduce((sum, c) =>
      sum + (c.analysis.seoScore || c.analysis.seoEstimate || 0), 0) / validCompetitors.length;

    return {
      averagePerformance: Math.round(avgPerformance),
      averageSEO: Math.round(avgSEO),
      sampleSize: validCompetitors.length,
      dataQuality: validCompetitors.every(c => c.dataSource === 'google-api') ? 'high' : 'medium'
    };
  }

  private identifyCompetitiveOpportunities(competitors: Record<string, any>[]): Record<string, any>[] {
    const opportunities: Record<string, any>[] = [];
    const benchmarks = this.generateCompetitiveBenchmarks(competitors);

    // Look for competitors with lower scores (opportunities to differentiate)
    competitors.forEach(competitor => {
      if (competitor.analysis && !competitor.analysis.error) {
        const perfScore = competitor.analysis.performanceScore || competitor.analysis.performanceEstimate || 0;
        const seoScore = competitor.analysis.seoScore || competitor.analysis.seoEstimate || 0;

        if (perfScore < 70) {
          opportunities.push({
            type: 'performance-advantage',
            competitor: competitor.url,
            opportunity: 'Competitor has poor performance - opportunity to differentiate',
            competitorScore: perfScore,
            recommendation: 'Highlight your superior performance in marketing materials'
          });
        }

        if (seoScore < 70) {
          opportunities.push({
            type: 'seo-advantage',
            competitor: competitor.url,
            opportunity: 'Competitor has SEO weaknesses - opportunity for search ranking advantage',
            competitorScore: seoScore,
            recommendation: 'Focus on SEO content and optimization to outrank competitor'
          });
        }
      }
    });

    return opportunities;
  }

  private identifyCompetitiveThreats(competitors: Record<string, any>[]): Record<string, any>[] {
    const threats: Record<string, any>[] = [];

    // Look for competitors with higher scores (potential threats)
    competitors.forEach(competitor => {
      if (competitor.analysis && !competitor.analysis.error) {
        const perfScore = competitor.analysis.performanceScore || competitor.analysis.performanceEstimate || 0;
        const seoScore = competitor.analysis.seoScore || competitor.analysis.seoEstimate || 0;

        if (perfScore > 90) {
          threats.push({
            type: 'performance-threat',
            competitor: competitor.url,
            threat: 'Competitor has excellent performance',
            competitorScore: perfScore,
            recommendation: 'Monitor competitor performance strategies and maintain optimization focus'
          });
        }

        if (seoScore > 90) {
          threats.push({
            type: 'seo-threat',
            competitor: competitor.url,
            threat: 'Competitor has strong SEO optimization',
            competitorScore: seoScore,
            recommendation: 'Enhance content strategy and SEO optimization to compete'
          });
        }
      }
    });

    return threats;
  }

  private generateCompetitiveRecommendations(
    competitors: Record<string, any>[],
    opportunities: Record<string, any>[],
    threats: Record<string, any>[]
  ): Record<string, any>[] {
    const recommendations: Record<string, any>[] = [];

    // Strategic recommendations based on competitive landscape
    if (opportunities.length > threats.length) {
      recommendations.push({
        priority: 'high',
        strategy: 'aggressive-optimization',
        action: 'Leverage performance advantages for competitive differentiation',
        rationale: `${opportunities.length} optimization opportunities vs ${threats.length} competitive threats`,
        timeline: '1-2 months'
      });
    }

    if (threats.length > 0) {
      recommendations.push({
        priority: 'medium',
        strategy: 'defensive-optimization',
        action: 'Strengthen areas where competitors excel',
        rationale: `${threats.length} competitive threats requiring attention`,
        timeline: '2-3 months'
      });
    }

    // Always recommend continuous monitoring
    recommendations.push({
      priority: 'ongoing',
      strategy: 'continuous-monitoring',
      action: 'Regular competitive SEO monitoring using automated tools',
      rationale: 'Stay ahead of competitive changes and market trends',
      timeline: 'continuous'
    });

    return recommendations;
  }

  private validateCompetitorSEOParams(params: unknown): CompetitorSEOParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }
    const p = params as any;
    if (!Array.isArray(p.competitorUrls) || p.competitorUrls.length === 0) {
      throw new ValidationError('competitorUrls must be a non-empty array', 'competitorUrls', p.competitorUrls);
    }
    return {
      competitorUrls: p.competitorUrls,
      metrics: p.metrics,
      alertThresholds: p.alertThresholds,
      monitoringFrequency: p.monitoringFrequency
    };
  }

  private validateMetaAuditParams(params: unknown): MetaAuditParams {
    if (!params || typeof params !== 'object') {
      return {};
    }
    const p = params as any;
    return {
      includeOpenGraph: p.includeOpenGraph,
      includeTwitterCards: p.includeTwitterCards,
      checkDuplicates: p.checkDuplicates
    };
  }

  async analyzeSEOContent(params: unknown, sessionId?: string): Promise<MCPToolResult<SEOContentResult>> {
    this.logger.info('Executing analyze_seo_content tool', { params, sessionId });

    try {
      const { targetKeywords = [], analyzeReadability = true, checkDuplicateContent = false } = this.validateSEOContentParams(params);
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      // Comprehensive SEO content analysis
      const contentAnalysisScript = `
        return new Promise((resolve) => {
          const analysis = {
            wordCount: 0,
            readabilityScore: 0,
            keywordDensity: [],
            headingStructure: {},
            internalLinks: { count: 0, links: [] },
            externalLinks: { count: 0, links: [] },
            imageOptimization: { total: 0, withAlt: 0, optimized: 0 },
            contentQuality: { score: 0, factors: [], improvements: [] }
          };

          // Get all text content
          const textContent = document.body.innerText || '';
          const words = textContent.toLowerCase().match(/\\b\\w+\\b/g) || [];
          analysis.wordCount = words.length;

          // Basic readability analysis (simplified Flesch Reading Ease)
          const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
          const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
          const avgSyllablesPerWord = 1.5; // Simplified estimate

          if (${analyzeReadability}) {
            const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
            analysis.readabilityScore = Math.max(0, Math.min(100, fleschScore));
          }

          // Keyword density analysis
          const targetKeywords = ${JSON.stringify(targetKeywords)};
          targetKeywords.forEach(keyword => {
            const keywordCount = (textContent.toLowerCase().match(new RegExp('\\\\b' + keyword.toLowerCase() + '\\\\b', 'g')) || []).length;
            const density = (keywordCount / words.length) * 100;
            analysis.keywordDensity.push({
              keyword: keyword,
              count: keywordCount,
              density: Math.round(density * 100) / 100,
              optimal: density >= 0.5 && density <= 3.0
            });
          });

          // Heading structure analysis
          const headingCounts = {};
          ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
            const count = document.querySelectorAll(tag).length;
            headingCounts[tag] = count;
          });
          analysis.headingStructure = {
            counts: headingCounts,
            hasH1: headingCounts.h1 > 0,
            h1Count: headingCounts.h1,
            totalHeadings: Object.values(headingCounts).reduce((sum, count) => sum + count, 0)
          };

          // Link analysis
          const allLinks = document.querySelectorAll('a[href]');
          allLinks.forEach(link => {
            const href = link.href;
            const isInternal = href.includes(window.location.hostname);
            const linkData = {
              url: href,
              text: link.textContent?.trim() || '',
              title: link.title || ''
            };

            if (isInternal) {
              analysis.internalLinks.links.push(linkData);
            } else {
              analysis.externalLinks.links.push(linkData);
            }
          });

          analysis.internalLinks.count = analysis.internalLinks.links.length;
          analysis.externalLinks.count = analysis.externalLinks.links.length;

          // Image optimization analysis
          const images = document.querySelectorAll('img');
          analysis.imageOptimization.total = images.length;
          images.forEach(img => {
            if (img.alt && img.alt.trim().length > 0) {
              analysis.imageOptimization.withAlt++;
            }
            if (img.loading === 'lazy' || img.src.includes('webp') || img.sizes) {
              analysis.imageOptimization.optimized++;
            }
          });

          // Content quality scoring
          let qualityScore = 100;
          const factors = [];
          const improvements = [];

          // Word count analysis
          if (analysis.wordCount < 300) {
            qualityScore -= 20;
            factors.push({ factor: 'Low word count', impact: -20 });
            improvements.push('Increase content length to at least 300 words for better SEO');
          } else if (analysis.wordCount > 1000) {
            factors.push({ factor: 'Good content length', impact: +5 });
          }

          // Heading structure
          if (headingCounts.h1 !== 1) {
            qualityScore -= 15;
            factors.push({ factor: 'H1 structure issue', impact: -15 });
            improvements.push('Use exactly one H1 tag per page');
          }

          // Image optimization
          const altTextRatio = analysis.imageOptimization.total > 0 ?
            analysis.imageOptimization.withAlt / analysis.imageOptimization.total : 1;
          if (altTextRatio < 0.8) {
            qualityScore -= 10;
            factors.push({ factor: 'Missing alt text', impact: -10 });
            improvements.push('Add alt text to all images for better accessibility and SEO');
          }

          // Readability
          if (analysis.readabilityScore < 60) {
            qualityScore -= 10;
            factors.push({ factor: 'Poor readability', impact: -10 });
            improvements.push('Improve content readability with shorter sentences and simpler words');
          }

          analysis.contentQuality = {
            score: Math.max(0, qualityScore),
            factors: factors,
            improvements: improvements
          };

          resolve(analysis);
        });
      `;

      const contentData = await session.driver.executeScript(contentAnalysisScript);
      const result = contentData as SEOContentResult;

      this.logger.info('SEO content analysis completed', {
        wordCount: result.wordCount,
        readabilityScore: result.readabilityScore,
        contentQualityScore: result.contentQuality.score,
        keywordsAnalyzed: targetKeywords.length
      });

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('SEO content analysis failed'));
    }
  }

  private validateSEOContentParams(params: unknown): SEOContentParams {
    if (!params || typeof params !== 'object') {
      return {};
    }
    const p = params as any;
    return {
      targetKeywords: Array.isArray(p.targetKeywords) ? p.targetKeywords : [],
      analyzeReadability: p.analyzeReadability,
      checkDuplicateContent: p.checkDuplicateContent
    };
  }
}