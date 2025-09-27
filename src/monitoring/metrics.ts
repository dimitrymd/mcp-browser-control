import { EventEmitter } from 'events';
import winston from 'winston';

/**
 * Prometheus-compatible metrics collection system
 */

export interface MetricLabel {
  [key: string]: string;
}

export interface MetricValue {
  value: number;
  timestamp: number;
  labels: MetricLabel;
}

export interface Histogram {
  buckets: Map<number, number>;
  sum: number;
  count: number;
}

export class MetricsCollector extends EventEmitter {
  private logger: winston.Logger;
  private counters: Map<string, Map<string, number>> = new Map();
  private gauges: Map<string, Map<string, number>> = new Map();
  private histograms: Map<string, Map<string, Histogram>> = new Map();
  private labels: Map<string, MetricLabel> = new Map();

  constructor(logger: winston.Logger) {
    super();
    this.logger = logger;

    this.logger.info('Metrics collector initialized');
    this.initializeDefaultMetrics();
  }

  /**
   * Initialize default metrics
   */
  private initializeDefaultMetrics(): void {
    // MCP request metrics
    this.createCounter('mcp_requests_total', 'Total number of MCP requests');
    this.createHistogram('mcp_request_duration_seconds', 'MCP request duration in seconds');

    // Tool execution metrics
    this.createCounter('mcp_tool_executions_total', 'Total number of tool executions');
    this.createHistogram('mcp_tool_duration_seconds', 'Tool execution duration in seconds');

    // Browser session metrics
    this.createGauge('mcp_browser_sessions_active', 'Number of active browser sessions');
    this.createCounter('mcp_browser_crashes_total', 'Total number of browser crashes');

    // Cache metrics
    this.createCounter('mcp_cache_hits_total', 'Total number of cache hits');
    this.createCounter('mcp_cache_misses_total', 'Total number of cache misses');

    // Error metrics
    this.createCounter('mcp_errors_total', 'Total number of errors by type');

    // Queue metrics
    this.createGauge('mcp_queue_size', 'Current queue size');
    this.createHistogram('mcp_queue_wait_time_seconds', 'Queue wait time in seconds');

    // Performance metrics
    this.createGauge('mcp_memory_usage_bytes', 'Memory usage in bytes');
    this.createGauge('mcp_cpu_usage_percent', 'CPU usage percentage');
  }

  /**
   * Create a counter metric
   */
  createCounter(name: string, description: string): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, new Map());
      this.logger.debug('Counter metric created', { name, description });
    }
  }

  /**
   * Create a gauge metric
   */
  createGauge(name: string, description: string): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Map());
      this.logger.debug('Gauge metric created', { name, description });
    }
  }

  /**
   * Create a histogram metric
   */
  createHistogram(name: string, description: string, buckets?: number[]): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Map());
      this.logger.debug('Histogram metric created', { name, description });
    }
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels: MetricLabel = {}, value: number = 1): void {
    const counter = this.counters.get(name);
    if (!counter) {
      this.logger.warn('Counter not found', { name });
      return;
    }

    const labelKey = this.createLabelKey(labels);
    const currentValue = counter.get(labelKey) || 0;
    counter.set(labelKey, currentValue + value);

    this.emit('metric', {
      type: 'counter',
      name,
      value: currentValue + value,
      labels
    });
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: MetricLabel = {}): void {
    const gauge = this.gauges.get(name);
    if (!gauge) {
      this.logger.warn('Gauge not found', { name });
      return;
    }

    const labelKey = this.createLabelKey(labels);
    gauge.set(labelKey, value);

    this.emit('metric', {
      type: 'gauge',
      name,
      value,
      labels
    });
  }

  /**
   * Observe a value in histogram
   */
  observeHistogram(name: string, value: number, labels: MetricLabel = {}): void {
    const histogram = this.histograms.get(name);
    if (!histogram) {
      this.logger.warn('Histogram not found', { name });
      return;
    }

    const labelKey = this.createLabelKey(labels);
    let hist = histogram.get(labelKey);

    if (!hist) {
      hist = {
        buckets: new Map(),
        sum: 0,
        count: 0
      };
      histogram.set(labelKey, hist);
    }

    // Update histogram
    hist.sum += value;
    hist.count++;

    // Update buckets (simplified buckets)
    const buckets = [0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    buckets.forEach(bucket => {
      if (value <= bucket) {
        const currentCount = hist!.buckets.get(bucket) || 0;
        hist!.buckets.set(bucket, currentCount + 1);
      }
    });

    this.emit('metric', {
      type: 'histogram',
      name,
      value,
      labels
    });
  }

  /**
   * Record tool execution
   */
  recordToolExecution(toolName: string, duration: number, success: boolean): void {
    const labels = { tool: toolName, status: success ? 'success' : 'error' };

    this.incrementCounter('mcp_tool_executions_total', labels);
    this.observeHistogram('mcp_tool_duration_seconds', duration / 1000, labels);

    if (!success) {
      this.incrementCounter('mcp_errors_total', { type: 'tool_execution', tool: toolName });
    }
  }

  /**
   * Record MCP request
   */
  recordMCPRequest(duration: number, success: boolean): void {
    const labels = { status: success ? 'success' : 'error' };

    this.incrementCounter('mcp_requests_total', labels);
    this.observeHistogram('mcp_request_duration_seconds', duration / 1000, labels);

    if (!success) {
      this.incrementCounter('mcp_errors_total', { type: 'mcp_request' });
    }
  }

  /**
   * Record session metrics
   */
  recordSessionMetrics(activeSessions: number, crashes: number = 0): void {
    this.setGauge('mcp_browser_sessions_active', activeSessions);

    if (crashes > 0) {
      this.incrementCounter('mcp_browser_crashes_total', {}, crashes);
      this.incrementCounter('mcp_errors_total', { type: 'browser_crash' }, crashes);
    }
  }

  /**
   * Record cache metrics
   */
  recordCacheMetrics(hits: number, misses: number): void {
    if (hits > 0) {
      this.incrementCounter('mcp_cache_hits_total', {}, hits);
    }

    if (misses > 0) {
      this.incrementCounter('mcp_cache_misses_total', {}, misses);
    }
  }

  /**
   * Record queue metrics
   */
  recordQueueMetrics(queueSize: number, waitTime?: number): void {
    this.setGauge('mcp_queue_size', queueSize);

    if (waitTime !== undefined) {
      this.observeHistogram('mcp_queue_wait_time_seconds', waitTime / 1000);
    }
  }

  /**
   * Record system metrics
   */
  recordSystemMetrics(memoryUsage: number, cpuUsage: number): void {
    this.setGauge('mcp_memory_usage_bytes', memoryUsage);
    this.setGauge('mcp_cpu_usage_percent', cpuUsage);
  }

  /**
   * Get Prometheus-formatted metrics
   */
  getPrometheusMetrics(): string {
    let output = '';

    // Export counters
    for (const [name, counter] of this.counters.entries()) {
      output += `# TYPE ${name} counter\n`;
      for (const [labelKey, value] of counter.entries()) {
        const labels = this.parseLabelKey(labelKey);
        const labelStr = Object.keys(labels).length > 0 ?
          '{' + Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}' : '';
        output += `${name}${labelStr} ${value}\n`;
      }
      output += '\n';
    }

    // Export gauges
    for (const [name, gauge] of this.gauges.entries()) {
      output += `# TYPE ${name} gauge\n`;
      for (const [labelKey, value] of gauge.entries()) {
        const labels = this.parseLabelKey(labelKey);
        const labelStr = Object.keys(labels).length > 0 ?
          '{' + Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}' : '';
        output += `${name}${labelStr} ${value}\n`;
      }
      output += '\n';
    }

    // Export histograms
    for (const [name, histogram] of this.histograms.entries()) {
      output += `# TYPE ${name} histogram\n`;
      for (const [labelKey, hist] of histogram.entries()) {
        const labels = this.parseLabelKey(labelKey);
        const baseLabelStr = Object.keys(labels).length > 0 ?
          Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') : '';

        // Export buckets
        for (const [bucket, count] of hist.buckets.entries()) {
          const bucketLabels = baseLabelStr ? `{${baseLabelStr},le="${bucket}"}` : `{le="${bucket}"}`;
          output += `${name}_bucket${bucketLabels} ${count}\n`;
        }

        // Export sum and count
        const sumLabels = baseLabelStr ? `{${baseLabelStr}}` : '';
        output += `${name}_sum${sumLabels} ${hist.sum}\n`;
        output += `${name}_count${sumLabels} ${hist.count}\n`;
      }
      output += '\n';
    }

    return output;
  }

  /**
   * Get JSON metrics for API
   */
  getJSONMetrics(): any {
    const result: any = {
      timestamp: Date.now(),
      counters: {},
      gauges: {},
      histograms: {}
    };

    // Convert counters
    for (const [name, counter] of this.counters.entries()) {
      result.counters[name] = {};
      for (const [labelKey, value] of counter.entries()) {
        const labels = this.parseLabelKey(labelKey);
        result.counters[name][labelKey] = { value, labels };
      }
    }

    // Convert gauges
    for (const [name, gauge] of this.gauges.entries()) {
      result.gauges[name] = {};
      for (const [labelKey, value] of gauge.entries()) {
        const labels = this.parseLabelKey(labelKey);
        result.gauges[name][labelKey] = { value, labels };
      }
    }

    // Convert histograms
    for (const [name, histogram] of this.histograms.entries()) {
      result.histograms[name] = {};
      for (const [labelKey, hist] of histogram.entries()) {
        const labels = this.parseLabelKey(labelKey);
        result.histograms[name][labelKey] = {
          buckets: Object.fromEntries(hist.buckets),
          sum: hist.sum,
          count: hist.count,
          average: hist.count > 0 ? hist.sum / hist.count : 0,
          labels
        };
      }
    }

    return result;
  }

  /**
   * Create label key for storage
   */
  private createLabelKey(labels: MetricLabel): string {
    const sortedEntries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(sortedEntries);
  }

  /**
   * Parse label key back to object
   */
  private parseLabelKey(labelKey: string): MetricLabel {
    try {
      const entries = JSON.parse(labelKey);
      return Object.fromEntries(entries);
    } catch {
      return {};
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.labels.clear();

    this.logger.info('All metrics reset');
    this.initializeDefaultMetrics();
  }

  /**
   * Get metrics summary
   */
  getSummary(): {
    counters: number;
    gauges: number;
    histograms: number;
    totalSeries: number;
  } {
    const counterSeries = Array.from(this.counters.values())
      .reduce((sum, counter) => sum + counter.size, 0);

    const gaugeSeries = Array.from(this.gauges.values())
      .reduce((sum, gauge) => sum + gauge.size, 0);

    const histogramSeries = Array.from(this.histograms.values())
      .reduce((sum, histogram) => sum + histogram.size, 0);

    return {
      counters: this.counters.size,
      gauges: this.gauges.size,
      histograms: this.histograms.size,
      totalSeries: counterSeries + gaugeSeries + histogramSeries
    };
  }
}