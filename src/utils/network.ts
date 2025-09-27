/**
 * Network utilities for HTTP Archive (HAR) generation and analysis
 */

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  responseHeaders: Record<string, string>;
  body?: any;
  responseBody?: any;
  startTime: number;
  endTime: number;
  duration: number;
  size: number;
  type: string;
  initiator?: string;
}

export interface HAR {
  log: {
    version: string;
    creator: {
      name: string;
      version: string;
    };
    entries: HAREntry[];
  };
}

export interface HAREntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    headers: Array<{ name: string; value: string }>;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    headers: Array<{ name: string; value: string }>;
    content: {
      size: number;
      mimeType: string;
    };
    bodySize: number;
  };
  timings: {
    send: number;
    wait: number;
    receive: number;
  };
}

export interface WaterfallAnalysis {
  criticalPath: NetworkRequest[];
  blockingResources: NetworkRequest[];
  totalTime: number;
  parallelRequests: NetworkRequest[][];
  recommendations: string[];
}

export interface Bottleneck {
  type: 'slow-request' | 'large-resource' | 'blocking-script' | 'redirect-chain';
  description: string;
  impact: 'high' | 'medium' | 'low';
  requests: NetworkRequest[];
  suggestions: string[];
}

/**
 * Create HTTP Archive (HAR) from network requests
 */
export function createHAR(requests: NetworkRequest[]): HAR {
  const entries: HAREntry[] = requests.map(request => {
    // Convert headers to HAR format
    const requestHeaders = Object.entries(request.headers).map(([name, value]) => ({
      name,
      value
    }));

    const responseHeaders = Object.entries(request.responseHeaders).map(([name, value]) => ({
      name,
      value
    }));

    // Calculate timings (simplified)
    const totalTime = request.duration;
    const send = Math.min(totalTime * 0.1, 50); // 10% for send, max 50ms
    const receive = Math.min(totalTime * 0.1, 50); // 10% for receive, max 50ms
    const wait = totalTime - send - receive;

    return {
      startedDateTime: new Date(request.startTime).toISOString(),
      time: totalTime,
      request: {
        method: request.method,
        url: request.url,
        headers: requestHeaders,
        bodySize: request.body ? JSON.stringify(request.body).length : 0
      },
      response: {
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        content: {
          size: request.size,
          mimeType: this.getMimeTypeFromUrl(request.url)
        },
        bodySize: request.size
      },
      timings: {
        send: Math.round(send),
        wait: Math.round(wait),
        receive: Math.round(receive)
      }
    };
  });

  return {
    log: {
      version: '1.2',
      creator: {
        name: 'MCP Browser Control Server',
        version: '1.0.0'
      },
      entries
    }
  };
}

/**
 * Analyze waterfall timing for bottlenecks
 */
export function analyzeWaterfall(requests: NetworkRequest[]): WaterfallAnalysis {
  if (requests.length === 0) {
    return {
      criticalPath: [],
      blockingResources: [],
      totalTime: 0,
      parallelRequests: [],
      recommendations: []
    };
  }

  // Sort requests by start time
  const sortedRequests = [...requests].sort((a, b) => a.startTime - b.startTime);

  const firstRequest = sortedRequests[0];
  const lastRequest = sortedRequests[sortedRequests.length - 1];
  const totalTime = lastRequest.endTime - firstRequest.startTime;

  // Find critical path (longest chain of dependent requests)
  const criticalPath: NetworkRequest[] = [];
  const blockingResources: NetworkRequest[] = [];

  // Identify blocking resources
  sortedRequests.forEach(request => {
    // Scripts and stylesheets in <head> are typically blocking
    if (request.type === 'script' || request.type === 'stylesheet') {
      blockingResources.push(request);
    }

    // Large resources that take significant time
    if (request.duration > 1000) { // > 1 second
      criticalPath.push(request);
    }
  });

  // Group parallel requests (requests that overlap in time)
  const parallelRequests: NetworkRequest[][] = [];
  let currentGroup: NetworkRequest[] = [];
  let currentGroupEndTime = 0;

  sortedRequests.forEach(request => {
    if (request.startTime < currentGroupEndTime) {
      // Overlaps with current group
      currentGroup.push(request);
      currentGroupEndTime = Math.max(currentGroupEndTime, request.endTime);
    } else {
      // Start new group
      if (currentGroup.length > 1) {
        parallelRequests.push([...currentGroup]);
      }
      currentGroup = [request];
      currentGroupEndTime = request.endTime;
    }
  });

  // Add last group
  if (currentGroup.length > 1) {
    parallelRequests.push(currentGroup);
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (blockingResources.length > 5) {
    recommendations.push(`Reduce blocking resources (${blockingResources.length} found). Consider async loading.`);
  }

  if (criticalPath.length > 0) {
    const avgCriticalTime = criticalPath.reduce((sum, req) => sum + req.duration, 0) / criticalPath.length;
    if (avgCriticalTime > 1000) {
      recommendations.push('Critical path requests are slow. Optimize server response times.');
    }
  }

  if (parallelRequests.length === 0) {
    recommendations.push('All requests are sequential. Consider parallel loading for better performance.');
  }

  const totalSize = requests.reduce((sum, req) => sum + req.size, 0);
  if (totalSize > 5 * 1024 * 1024) { // 5MB
    recommendations.push('Total request size is large. Consider compression and optimization.');
  }

  return {
    criticalPath,
    blockingResources,
    totalTime,
    parallelRequests,
    recommendations
  };
}

/**
 * Find performance bottlenecks in network requests
 */
export function findBottlenecks(requests: NetworkRequest[]): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];

  if (requests.length === 0) {
    return bottlenecks;
  }

  // Find slow requests
  const slowRequests = requests.filter(req => req.duration > 2000); // > 2 seconds
  if (slowRequests.length > 0) {
    bottlenecks.push({
      type: 'slow-request',
      description: `${slowRequests.length} slow requests detected (>2s)`,
      impact: slowRequests.length > 3 ? 'high' : 'medium',
      requests: slowRequests,
      suggestions: [
        'Optimize server response times',
        'Consider caching strategies',
        'Check database query performance',
        'Review API endpoints for optimization'
      ]
    });
  }

  // Find large resources
  const largeResources = requests.filter(req => req.size > 1024 * 1024); // > 1MB
  if (largeResources.length > 0) {
    bottlenecks.push({
      type: 'large-resource',
      description: `${largeResources.length} large resources detected (>1MB)`,
      impact: 'high',
      requests: largeResources,
      suggestions: [
        'Compress images and media files',
        'Implement lazy loading for large resources',
        'Use progressive image formats (WebP, AVIF)',
        'Consider resource bundling and minification'
      ]
    });
  }

  // Find blocking scripts
  const blockingScripts = requests.filter(req =>
    req.type === 'script' &&
    req.duration > 500 &&
    !req.url.includes('async') &&
    !req.url.includes('defer')
  );
  if (blockingScripts.length > 0) {
    bottlenecks.push({
      type: 'blocking-script',
      description: `${blockingScripts.length} blocking scripts detected`,
      impact: 'medium',
      requests: blockingScripts,
      suggestions: [
        'Add async or defer attributes to script tags',
        'Move non-critical scripts to bottom of page',
        'Consider script bundling and minification',
        'Use dynamic imports for code splitting'
      ]
    });
  }

  // Find redirect chains
  const redirectRequests = requests.filter(req =>
    req.status >= 300 && req.status < 400
  );
  if (redirectRequests.length > 0) {
    bottlenecks.push({
      type: 'redirect-chain',
      description: `${redirectRequests.length} redirects detected`,
      impact: 'low',
      requests: redirectRequests,
      suggestions: [
        'Minimize redirect chains',
        'Update links to final destinations',
        'Configure server to avoid unnecessary redirects',
        'Check for redirect loops'
      ]
    });
  }

  return bottlenecks;
}

/**
 * Calculate network bandwidth from requests
 */
export function calculateBandwidth(requests: NetworkRequest[]): number {
  if (requests.length === 0) {
    return 0;
  }

  const totalBytes = requests.reduce((sum, req) => sum + req.size, 0);
  const firstRequest = Math.min(...requests.map(req => req.startTime));
  const lastRequest = Math.max(...requests.map(req => req.endTime));
  const totalTime = (lastRequest - firstRequest) / 1000; // Convert to seconds

  if (totalTime === 0) {
    return 0;
  }

  // Return bytes per second
  return totalBytes / totalTime;
}

/**
 * Analyze request timing patterns
 */
export function analyzeRequestPatterns(requests: NetworkRequest[]): {
  patterns: Array<{
    type: string;
    description: string;
    requests: NetworkRequest[];
    impact: string;
  }>;
  summary: {
    totalRequests: number;
    avgDuration: number;
    errorRate: number;
    cacheHitRate: number;
  };
} {
  const patterns: Array<{
    type: string;
    description: string;
    requests: NetworkRequest[];
    impact: string;
  }> = [];

  // Analyze error patterns
  const errorRequests = requests.filter(req => req.status >= 400);
  if (errorRequests.length > 0) {
    patterns.push({
      type: 'errors',
      description: `${errorRequests.length} failed requests detected`,
      requests: errorRequests,
      impact: errorRequests.length > requests.length * 0.1 ? 'high' : 'medium'
    });
  }

  // Analyze cache patterns
  const cacheableRequests = requests.filter(req =>
    req.responseHeaders['cache-control'] ||
    req.responseHeaders['expires'] ||
    req.responseHeaders['etag']
  );

  if (cacheableRequests.length > 0) {
    patterns.push({
      type: 'caching',
      description: `${cacheableRequests.length} cacheable resources found`,
      requests: cacheableRequests,
      impact: 'positive'
    });
  }

  // Analyze request timing
  const slowRequests = requests.filter(req => req.duration > 1000);
  if (slowRequests.length > 0) {
    patterns.push({
      type: 'performance',
      description: `${slowRequests.length} slow requests (>1s) detected`,
      requests: slowRequests,
      impact: 'high'
    });
  }

  // Calculate summary metrics
  const totalRequests = requests.length;
  const avgDuration = totalRequests > 0 ?
    requests.reduce((sum, req) => sum + req.duration, 0) / totalRequests : 0;
  const errorRate = totalRequests > 0 ? errorRequests.length / totalRequests : 0;
  const cacheHitRate = totalRequests > 0 ? cacheableRequests.length / totalRequests : 0;

  return {
    patterns,
    summary: {
      totalRequests,
      avgDuration,
      errorRate,
      cacheHitRate
    }
  };
}

/**
 * Generate network performance report
 */
export function generateNetworkReport(requests: NetworkRequest[]): {
  overview: {
    totalRequests: number;
    totalSize: number;
    totalTime: number;
    bandwidth: number;
  };
  performance: {
    fastestRequest: NetworkRequest | null;
    slowestRequest: NetworkRequest | null;
    largestRequest: NetworkRequest | null;
    avgResponseTime: number;
  };
  issues: string[];
  recommendations: string[];
} {
  if (requests.length === 0) {
    return {
      overview: { totalRequests: 0, totalSize: 0, totalTime: 0, bandwidth: 0 },
      performance: { fastestRequest: null, slowestRequest: null, largestRequest: null, avgResponseTime: 0 },
      issues: ['No network requests captured'],
      recommendations: ['Enable network monitoring to analyze performance']
    };
  }

  // Overview metrics
  const totalRequests = requests.length;
  const totalSize = requests.reduce((sum, req) => sum + req.size, 0);
  const firstRequest = Math.min(...requests.map(req => req.startTime));
  const lastRequest = Math.max(...requests.map(req => req.endTime));
  const totalTime = lastRequest - firstRequest;
  const bandwidth = calculateBandwidth(requests);

  // Performance metrics
  const sortedByDuration = [...requests].sort((a, b) => a.duration - b.duration);
  const sortedBySize = [...requests].sort((a, b) => a.size - b.size);

  const fastestRequest = sortedByDuration[0];
  const slowestRequest = sortedByDuration[sortedByDuration.length - 1];
  const largestRequest = sortedBySize[sortedBySize.length - 1];
  const avgResponseTime = requests.reduce((sum, req) => sum + req.duration, 0) / requests.length;

  // Identify issues
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check for slow requests
  const slowRequests = requests.filter(req => req.duration > 2000);
  if (slowRequests.length > 0) {
    issues.push(`${slowRequests.length} slow requests (>2s) detected`);
    recommendations.push('Optimize slow requests or implement caching');
  }

  // Check for large resources
  const largeRequests = requests.filter(req => req.size > 1024 * 1024);
  if (largeRequests.length > 0) {
    issues.push(`${largeRequests.length} large resources (>1MB) detected`);
    recommendations.push('Compress large resources or implement progressive loading');
  }

  // Check error rate
  const errorRequests = requests.filter(req => req.status >= 400);
  if (errorRequests.length > requests.length * 0.05) { // >5% error rate
    issues.push(`High error rate: ${Math.round(errorRequests.length / requests.length * 100)}%`);
    recommendations.push('Investigate and fix failing requests');
  }

  // Check for excessive requests
  if (requests.length > 100) {
    issues.push(`High number of requests: ${requests.length}`);
    recommendations.push('Consider request bundling and resource optimization');
  }

  // Check bandwidth utilization
  if (bandwidth < 1024 * 1024) { // < 1MB/s
    issues.push('Low bandwidth utilization detected');
    recommendations.push('Consider parallel loading and connection optimization');
  }

  if (issues.length === 0) {
    recommendations.push('Network performance appears to be within acceptable ranges');
  }

  return {
    overview: {
      totalRequests,
      totalSize,
      totalTime,
      bandwidth
    },
    performance: {
      fastestRequest,
      slowestRequest,
      largestRequest,
      avgResponseTime
    },
    issues,
    recommendations
  };
}

/**
 * Filter requests by various criteria
 */
export function filterRequests(
  requests: NetworkRequest[],
  filters: {
    status?: number[];
    method?: string[];
    urlPattern?: string;
    minDuration?: number;
    maxDuration?: number;
    minSize?: number;
    maxSize?: number;
    type?: string[];
    timeRange?: { start: number; end: number };
  }
): NetworkRequest[] {
  let filtered = [...requests];

  if (filters.status) {
    filtered = filtered.filter(req => filters.status!.includes(req.status));
  }

  if (filters.method) {
    filtered = filtered.filter(req => filters.method!.includes(req.method.toUpperCase()));
  }

  if (filters.urlPattern) {
    const regex = new RegExp(filters.urlPattern);
    filtered = filtered.filter(req => regex.test(req.url));
  }

  if (filters.minDuration !== undefined) {
    filtered = filtered.filter(req => req.duration >= filters.minDuration!);
  }

  if (filters.maxDuration !== undefined) {
    filtered = filtered.filter(req => req.duration <= filters.maxDuration!);
  }

  if (filters.minSize !== undefined) {
    filtered = filtered.filter(req => req.size >= filters.minSize!);
  }

  if (filters.maxSize !== undefined) {
    filtered = filtered.filter(req => req.size <= filters.maxSize!);
  }

  if (filters.type) {
    filtered = filtered.filter(req => filters.type!.includes(req.type));
  }

  if (filters.timeRange) {
    filtered = filtered.filter(req =>
      req.startTime >= filters.timeRange!.start &&
      req.endTime <= filters.timeRange!.end
    );
  }

  return filtered;
}

/**
 * Helper function to determine MIME type from URL
 */
function getMimeTypeFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    if (pathname.endsWith('.js')) return 'application/javascript';
    if (pathname.endsWith('.css')) return 'text/css';
    if (pathname.endsWith('.html') || pathname.endsWith('.htm')) return 'text/html';
    if (pathname.endsWith('.json')) return 'application/json';
    if (pathname.endsWith('.xml')) return 'application/xml';
    if (pathname.endsWith('.png')) return 'image/png';
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
    if (pathname.endsWith('.gif')) return 'image/gif';
    if (pathname.endsWith('.svg')) return 'image/svg+xml';
    if (pathname.endsWith('.webp')) return 'image/webp';
    if (pathname.endsWith('.mp4')) return 'video/mp4';
    if (pathname.endsWith('.mp3')) return 'audio/mpeg';
    if (pathname.endsWith('.wav')) return 'audio/wav';
    if (pathname.endsWith('.ogg')) return 'audio/ogg';

    return 'application/octet-stream';
  } catch {
    return 'application/octet-stream';
  }
}

/**
 * Calculate request statistics
 */
export function calculateRequestStats(requests: NetworkRequest[]): {
  byType: Record<string, { count: number; totalSize: number; avgDuration: number }>;
  byStatus: Record<number, number>;
  timeline: Array<{ timestamp: number; concurrentRequests: number }>;
} {
  const byType: Record<string, { count: number; totalSize: number; avgDuration: number }> = {};
  const byStatus: Record<number, number> = {};
  const timeline: Array<{ timestamp: number; concurrentRequests: number }> = [];

  // Group by type
  requests.forEach(req => {
    if (!byType[req.type]) {
      byType[req.type] = { count: 0, totalSize: 0, avgDuration: 0 };
    }

    byType[req.type].count++;
    byType[req.type].totalSize += req.size;
    byType[req.type].avgDuration += req.duration;

    // Count by status
    byStatus[req.status] = (byStatus[req.status] || 0) + 1;
  });

  // Calculate averages
  Object.keys(byType).forEach(type => {
    byType[type].avgDuration /= byType[type].count;
  });

  // Create timeline of concurrent requests
  const events: Array<{ timestamp: number; type: 'start' | 'end'; request: NetworkRequest }> = [];

  requests.forEach(req => {
    events.push({ timestamp: req.startTime, type: 'start', request: req });
    events.push({ timestamp: req.endTime, type: 'end', request: req });
  });

  events.sort((a, b) => a.timestamp - b.timestamp);

  let concurrentCount = 0;
  events.forEach(event => {
    if (event.type === 'start') {
      concurrentCount++;
    } else {
      concurrentCount--;
    }

    timeline.push({
      timestamp: event.timestamp,
      concurrentRequests: concurrentCount
    });
  });

  return { byType, byStatus, timeline };
}

/**
 * Export HAR data to file format
 */
export function exportHAR(har: HAR): string {
  return JSON.stringify(har, null, 2);
}

/**
 * Import HAR data from string
 */
export function importHAR(harString: string): HAR | null {
  try {
    const har = JSON.parse(harString);

    // Validate HAR structure
    if (!har.log || !har.log.entries || !Array.isArray(har.log.entries)) {
      throw new Error('Invalid HAR format');
    }

    return har as HAR;
  } catch (error) {
    return null;
  }
}