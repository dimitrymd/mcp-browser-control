import { EventEmitter } from 'events';
import winston from 'winston';

export interface QueueConfig {
  maxQueueSize: number;
  defaultPriority: number;
  maxRetries: number;
  retryDelay: number;
  deadLetterQueue: boolean;
  processingTimeout: number;
}

export interface QueuedRequest {
  id: string;
  toolName: string;
  params: any;
  sessionId?: string;
  priority: number;
  timestamp: number;
  retries: number;
  maxRetries: number;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

export interface RequestResult {
  success: boolean;
  data?: any;
  error?: Error;
  duration: number;
  retries: number;
}

export class RequestQueue extends EventEmitter {
  private config: QueueConfig;
  private logger: winston.Logger;
  private queue: QueuedRequest[] = [];
  private processing: Map<string, QueuedRequest> = new Map();
  private deadLetterQueue: QueuedRequest[] = [];
  private isProcessing = false;

  // Queue statistics
  private stats = {
    totalEnqueued: 0,
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    totalRetries: 0,
    averageProcessingTime: 0,
    currentQueueSize: 0,
    peakQueueSize: 0
  };

  constructor(config: QueueConfig, logger: winston.Logger) {
    super();
    this.config = config;
    this.logger = logger;

    this.logger.info('Request queue initialized', {
      maxQueueSize: config.maxQueueSize,
      defaultPriority: config.defaultPriority,
      maxRetries: config.maxRetries,
      deadLetterQueue: config.deadLetterQueue
    });

    this.startProcessing();
  }

  /**
   * Enqueue a request
   */
  async enqueueRequest(
    toolName: string,
    params: any,
    sessionId?: string,
    priority?: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Check queue capacity
      if (this.queue.length >= this.config.maxQueueSize) {
        reject(new Error('Queue is full'));
        return;
      }

      const request: QueuedRequest = {
        id: this.generateRequestId(),
        toolName,
        params,
        sessionId,
        priority: priority || this.config.defaultPriority,
        timestamp: Date.now(),
        retries: 0,
        maxRetries: this.config.maxRetries,
        resolve,
        reject
      };

      // Set timeout for request
      request.timeout = setTimeout(() => {
        this.timeoutRequest(request.id);
      }, this.config.processingTimeout);

      this.queue.push(request);
      this.stats.totalEnqueued++;
      this.stats.currentQueueSize = this.queue.length;
      this.stats.peakQueueSize = Math.max(this.stats.peakQueueSize, this.stats.currentQueueSize);

      // Sort queue by priority (higher priority first)
      this.queue.sort((a, b) => b.priority - a.priority);

      this.logger.debug('Request enqueued', {
        requestId: request.id,
        toolName,
        priority: request.priority,
        queueSize: this.queue.length
      });

      this.emit('requestEnqueued', request);
    });
  }

  /**
   * Start processing queue
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    const processNext = async () => {
      while (this.queue.length > 0 && this.isProcessing) {
        const request = this.queue.shift();

        if (request) {
          await this.processRequest(request);
        }

        // Small delay to prevent tight loops
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Continue processing after a short delay
      if (this.isProcessing) {
        setTimeout(processNext, 100);
      }
    };

    processNext();

    this.logger.info('Request queue processing started');
  }

  /**
   * Process a single request
   */
  private async processRequest(request: QueuedRequest): Promise<void> {
    const startTime = Date.now();

    this.processing.set(request.id, request);
    this.stats.currentQueueSize = this.queue.length;

    this.logger.debug('Processing request', {
      requestId: request.id,
      toolName: request.toolName,
      attempt: request.retries + 1,
      queueSize: this.queue.length
    });

    try {
      // Here we would execute the actual tool
      // For now, we'll simulate the execution
      const result = await this.executeRequest(request);

      // Clear timeout
      if (request.timeout) {
        clearTimeout(request.timeout);
      }

      // Resolve the promise
      request.resolve(result);

      this.stats.totalProcessed++;
      this.stats.totalSuccessful++;

      // Update average processing time
      const duration = Date.now() - startTime;
      this.stats.averageProcessingTime =
        (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + duration) /
        this.stats.totalProcessed;

      this.logger.debug('Request processed successfully', {
        requestId: request.id,
        duration
      });

      this.emit('requestCompleted', { request, result, duration });

    } catch (error) {
      this.stats.totalFailed++;

      // Check if we should retry
      if (request.retries < request.maxRetries) {
        request.retries++;
        this.stats.totalRetries++;

        // Calculate retry delay with exponential backoff
        const retryDelay = this.config.retryDelay * Math.pow(2, request.retries - 1);

        this.logger.debug('Retrying request', {
          requestId: request.id,
          attempt: request.retries + 1,
          delay: retryDelay
        });

        // Re-enqueue after delay
        setTimeout(() => {
          this.queue.unshift(request); // Add to front with original priority
          this.queue.sort((a, b) => b.priority - a.priority);
        }, retryDelay);

      } else {
        // Max retries exceeded
        this.logger.warn('Request failed after max retries', {
          requestId: request.id,
          retries: request.retries,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Clear timeout
        if (request.timeout) {
          clearTimeout(request.timeout);
        }

        // Move to dead letter queue if enabled
        if (this.config.deadLetterQueue) {
          this.deadLetterQueue.push(request);
          // Keep only last 100 failed requests
          if (this.deadLetterQueue.length > 100) {
            this.deadLetterQueue = this.deadLetterQueue.slice(-100);
          }
        }

        // Reject the promise
        request.reject(error instanceof Error ? error : new Error('Request processing failed'));

        this.emit('requestFailed', { request, error });
      }
    } finally {
      this.processing.delete(request.id);
    }
  }

  /**
   * Execute the actual request (placeholder)
   */
  private async executeRequest(request: QueuedRequest): Promise<any> {
    // In a real implementation, this would call the actual tool execution
    // For now, we simulate the execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    // Simulate occasional failures for testing
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error('Simulated processing error');
    }

    return {
      status: 'success',
      data: { requestId: request.id, toolName: request.toolName }
    };
  }

  /**
   * Timeout a request
   */
  private timeoutRequest(requestId: string): void {
    // Remove from queue if still there
    const queueIndex = this.queue.findIndex(req => req.id === requestId);
    if (queueIndex !== -1) {
      const request = this.queue.splice(queueIndex, 1)[0];
      request.reject(new Error('Request timeout'));

      this.logger.warn('Request timed out in queue', {
        requestId,
        waitTime: Date.now() - request.timestamp
      });
    }

    // Check if currently processing
    const processingRequest = this.processing.get(requestId);
    if (processingRequest) {
      this.processing.delete(requestId);
      processingRequest.reject(new Error('Request processing timeout'));

      this.logger.warn('Request timed out during processing', {
        requestId,
        processingTime: Date.now() - processingRequest.timestamp
      });
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueSize: number;
    processing: number;
    deadLetterSize: number;
    stats: typeof this.stats;
  } {
    return {
      queueSize: this.queue.length,
      processing: this.processing.size,
      deadLetterSize: this.deadLetterQueue.length,
      stats: this.stats
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): number {
    const clearedCount = this.queue.length;

    // Reject all pending requests
    this.queue.forEach(request => {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new Error('Queue cleared'));
    });

    this.queue = [];
    this.stats.currentQueueSize = 0;

    this.logger.info('Queue cleared', { clearedCount });

    return clearedCount;
  }

  /**
   * Pause queue processing
   */
  pauseProcessing(): void {
    this.isProcessing = false;
    this.logger.info('Queue processing paused');
  }

  /**
   * Resume queue processing
   */
  resumeProcessing(): void {
    if (!this.isProcessing) {
      this.isProcessing = true;
      this.startProcessing();
      this.logger.info('Queue processing resumed');
    }
  }

  /**
   * Get dead letter queue entries
   */
  getDeadLetterQueue(): QueuedRequest[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): number {
    const clearedCount = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    this.logger.info('Dead letter queue cleared', { clearedCount });
    return clearedCount;
  }

  /**
   * Get requests currently being processed
   */
  getProcessingRequests(): QueuedRequest[] {
    return Array.from(this.processing.values());
  }

  /**
   * Cancel a specific request
   */
  cancelRequest(requestId: string): boolean {
    // Check queue first
    const queueIndex = this.queue.findIndex(req => req.id === requestId);
    if (queueIndex !== -1) {
      const request = this.queue.splice(queueIndex, 1)[0];
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new Error('Request cancelled'));

      this.logger.info('Request cancelled from queue', { requestId });
      return true;
    }

    // Check processing
    const processingRequest = this.processing.get(requestId);
    if (processingRequest) {
      this.processing.delete(requestId);
      if (processingRequest.timeout) {
        clearTimeout(processingRequest.timeout);
      }
      processingRequest.reject(new Error('Request cancelled'));

      this.logger.info('Request cancelled during processing', { requestId });
      return true;
    }

    return false;
  }
}