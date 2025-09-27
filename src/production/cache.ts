import winston from 'winston';

export interface CacheConfig {
  enabled: boolean;
  maxMemory: number; // bytes
  defaultTTL: number; // milliseconds
  strategies: Record<string, CacheStrategy>;
  cleanupInterval: number;
}

export interface CacheStrategy {
  ttl: number;
  maxSize: number;
  evictionPolicy: 'lru' | 'fifo' | 'lfu';
}

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  memoryUsed: number;
  hitRate: number;
  evictions: number;
}

export class IntelligentCache {
  private config: CacheConfig;
  private logger: winston.Logger;
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // For LRU
  private insertOrder: string[] = []; // For FIFO
  private cleanupInterval?: NodeJS.Timeout;

  // Cache statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    entries: 0,
    memoryUsed: 0,
    hitRate: 0,
    evictions: 0
  };

  constructor(config: CacheConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;

    this.logger.info('Intelligent cache initialized', {
      enabled: config.enabled,
      maxMemory: config.maxMemory,
      defaultTTL: config.defaultTTL,
      strategies: Object.keys(config.strategies)
    });

    if (config.enabled) {
      this.startCleanupProcess();
    }
  }

  /**
   * Get value from cache
   */
  get(key: string, strategy?: string): any {
    if (!this.config.enabled) {
      return null;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    const now = Date.now();

    // Check TTL
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.removeFromAccessTracking(key);
      this.stats.misses++;
      this.updateMemoryUsage();
      this.updateHitRate();

      this.logger.debug('Cache entry expired', {
        key,
        age: now - entry.timestamp,
        ttl: entry.ttl
      });

      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;

    // Update LRU order
    this.updateAccessOrder(key);

    this.stats.hits++;
    this.updateHitRate();

    this.logger.debug('Cache hit', {
      key,
      accessCount: entry.accessCount,
      hitRate: this.stats.hitRate
    });

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: any, ttl?: number, strategy?: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const now = Date.now();
    const cacheStrategy = strategy ? this.config.strategies[strategy] : null;
    const entryTTL = ttl || cacheStrategy?.ttl || this.config.defaultTTL;

    // Calculate entry size (approximate)
    const size = this.calculateSize(value);

    // Check if we need to evict entries
    if (this.stats.memoryUsed + size > this.config.maxMemory) {
      this.evictEntries(size);
    }

    // Check strategy-specific limits
    if (cacheStrategy && this.getEntriesForStrategy(strategy!).length >= cacheStrategy.maxSize) {
      this.evictByStrategy(strategy!);
    }

    const entry: CacheEntry = {
      key,
      value,
      timestamp: now,
      ttl: entryTTL,
      accessCount: 1,
      lastAccessed: now,
      size
    };

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.removeFromAccessTracking(key);
    }

    this.cache.set(key, entry);
    this.insertOrder.push(key);
    this.accessOrder.push(key);

    this.updateMemoryUsage();
    this.stats.entries = this.cache.size;

    this.logger.debug('Cache entry set', {
      key,
      size,
      ttl: entryTTL,
      strategy,
      totalMemory: this.stats.memoryUsed
    });

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.removeFromAccessTracking(key);
    this.updateMemoryUsage();
    this.stats.entries = this.cache.size;

    this.logger.debug('Cache entry deleted', {
      key,
      size: entry.size
    });

    return true;
  }

  /**
   * Clear entire cache
   */
  clear(): number {
    const entriesCleared = this.cache.size;

    this.cache.clear();
    this.accessOrder = [];
    this.insertOrder = [];

    this.stats.entries = 0;
    this.stats.memoryUsed = 0;
    this.stats.evictions += entriesCleared;

    this.logger.info('Cache cleared', { entriesCleared });

    return entriesCleared;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get all cache keys
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entry info (for debugging)
   */
  getEntryInfo(key: string): Partial<CacheEntry> | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    return {
      key: entry.key,
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed,
      size: entry.size
    };
  }

  /**
   * Evict entries to free memory
   */
  private evictEntries(requiredSize: number): void {
    const targetMemory = this.config.maxMemory - requiredSize;
    let evicted = 0;

    // Use LRU eviction by default
    while (this.stats.memoryUsed > targetMemory && this.cache.size > 0) {
      const oldestKey = this.accessOrder[0];
      if (oldestKey && this.cache.has(oldestKey)) {
        this.delete(oldestKey);
        evicted++;
      } else {
        // Fallback: remove first entry
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.delete(firstKey);
          evicted++;
        } else {
          break;
        }
      }
    }

    this.stats.evictions += evicted;

    this.logger.debug('Cache entries evicted', {
      evicted,
      requiredSize,
      currentMemory: this.stats.memoryUsed
    });
  }

  /**
   * Evict entries for a specific strategy
   */
  private evictByStrategy(strategy: string): void {
    const strategyConfig = this.config.strategies[strategy];
    if (!strategyConfig) return;

    const entries = this.getEntriesForStrategy(strategy);

    // Sort by eviction policy
    let sortedEntries: CacheEntry[];
    switch (strategyConfig.evictionPolicy) {
      case 'lru':
        sortedEntries = entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
        break;
      case 'fifo':
        sortedEntries = entries.sort((a, b) => a.timestamp - b.timestamp);
        break;
      case 'lfu':
        sortedEntries = entries.sort((a, b) => a.accessCount - b.accessCount);
        break;
      default:
        sortedEntries = entries;
    }

    // Evict oldest entry
    if (sortedEntries.length > 0) {
      this.delete(sortedEntries[0].key);
      this.stats.evictions++;
    }
  }

  /**
   * Get entries for a specific strategy
   */
  private getEntriesForStrategy(strategy: string): CacheEntry[] {
    // In a real implementation, we'd track which entries belong to which strategy
    // For now, return all entries
    return Array.from(this.cache.values());
  }

  /**
   * Calculate approximate size of value
   */
  private calculateSize(value: any): number {
    try {
      if (typeof value === 'string') {
        return value.length * 2; // Approximate UTF-16 encoding
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return 8; // Approximate size
      }

      if (value === null || value === undefined) {
        return 0;
      }

      // For objects and arrays, use JSON.stringify length as approximation
      return JSON.stringify(value).length * 2;

    } catch {
      return 1000; // Default size if calculation fails
    }
  }

  /**
   * Update memory usage statistics
   */
  private updateMemoryUsage(): void {
    this.stats.memoryUsed = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Remove key from tracking arrays
   */
  private removeFromAccessTracking(key: string): void {
    const accessIndex = this.accessOrder.indexOf(key);
    if (accessIndex !== -1) {
      this.accessOrder.splice(accessIndex, 1);
    }

    const insertIndex = this.insertOrder.indexOf(key);
    if (insertIndex !== -1) {
      this.insertOrder.splice(insertIndex, 1);
    }
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Start cleanup process
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);

    this.logger.info('Cache cleanup process started', {
      interval: this.config.cleanupInterval
    });
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug('Expired cache entries cleaned', {
        cleanedCount,
        remainingEntries: this.cache.size
      });
    }
  }

  /**
   * Shutdown cache
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    const finalStats = this.getStats();
    this.clear();

    this.logger.info('Cache shutdown complete', { finalStats });
  }
}