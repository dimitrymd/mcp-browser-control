import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import winston from 'winston';

export interface GooglePageSpeedResult {
  lighthouseResult: {
    categories: {
      performance: { score: number };
      accessibility: { score: number };
      'best-practices': { score: number };
      seo: { score: number };
    };
    audits: {
      [key: string]: {
        numericValue?: number;
        score?: number;
        displayValue?: string;
      };
    };
  };
  loadingExperience?: {
    metrics: {
      [key: string]: {
        percentile: number;
        distributions?: any[];
      };
    };
  };
}

export interface PageSpeedOptions {
  strategy?: 'mobile' | 'desktop';
  category?: string[];
  locale?: string;
  includeFieldData?: boolean;
}

export class GooglePageSpeedAPI {
  private auth: GoogleAuth | null = null;
  private apiKey: string | null = null;
  private logger: winston.Logger;
  private baseUrl = 'https://www.googleapis.com/pagespeedonline/v5';
  private requestCount = 0;
  private lastMinuteReset = Date.now();

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.initializeAuth();
  }

  private initializeAuth(): void {
    try {
      // Try API key first (simpler and more reliable)
      this.apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || null;

      if (this.apiKey) {
        this.logger.info('Google PageSpeed API key configured', {
          keyPrefix: this.apiKey.substring(0, 8) + '...'
        });
        return;
      }

      // Fallback to service account if available
      const credentialsPath = path.join(process.cwd(), 'config', 'google-service-account.json');

      if (fs.existsSync(credentialsPath)) {
        this.auth = new GoogleAuth({
          keyFile: credentialsPath,
          scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        this.logger.info('Google service account authentication initialized', { credentialsPath });
      } else {
        this.logger.warn('Google API authentication not configured', {
          apiKey: !!this.apiKey,
          serviceAccount: false
        });
      }
    } catch (error) {
      this.logger.error('Failed to initialize Google authentication', { error });
    }
  }

  async analyzePageSpeed(url: string, options: PageSpeedOptions = {}): Promise<GooglePageSpeedResult> {
    // Rate limiting check
    this.checkRateLimit();

    try {
      // Prepare API request parameters
      const params = new URLSearchParams({
        url: url,
        strategy: options.strategy || 'desktop',
        locale: options.locale || 'en'
      });

      // Add categories if specified
      if (options.category && options.category.length > 0) {
        options.category.forEach(cat => params.append('category', cat));
      } else {
        // Default categories for comprehensive analysis
        ['performance', 'accessibility', 'best-practices', 'seo'].forEach(cat =>
          params.append('category', cat)
        );
      }

      const apiUrl = `${this.baseUrl}/runPagespeed?${params.toString()}`;

      let response;

      // Use API key if available (preferred method)
      if (this.apiKey) {
        const apiUrlWithKey = `${apiUrl}&key=${this.apiKey}`;

        this.logger.info('Using Google API key for PageSpeed Insights');
        response = await axios.get(apiUrlWithKey, {
          headers: {
            'Accept': 'application/json'
          },
          timeout: 30000
        });
      }
      // Try service account authentication as fallback
      else if (this.auth) {
        try {
          const authClient = await this.auth.getClient();
          const accessToken = await authClient.getAccessToken();

          if (accessToken.token) {
            this.logger.info('Using service account authentication for Google API');
            response = await axios.get(apiUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Accept': 'application/json'
              },
              timeout: 30000
            });
          }
        } catch (authError) {
          this.logger.warn('Service account authentication failed', {
            error: authError instanceof Error ? authError.message : 'Unknown auth error'
          });
          throw new Error('Google API authentication failed - check credentials');
        }
      } else {
        throw new Error('Google API not configured - set GOOGLE_PAGESPEED_API_KEY environment variable');
      }

      this.recordRequest();
      this.logger.info('Google PageSpeed API request completed', {
        url,
        strategy: options.strategy,
        categories: options.category,
        authenticated: !!this.auth
      });

      return response.data as GooglePageSpeedResult;

    } catch (error: any) {
      this.logger.error('Google PageSpeed API request failed', {
        url,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      if (error.response?.status === 429) {
        throw new Error('Google API rate limit exceeded - please wait before retrying');
      } else if (error.response?.status === 403) {
        throw new Error('Google API access denied - check service account permissions');
      } else if (error.response?.status === 400) {
        throw new Error(`Invalid URL or parameters for Google API: ${url}`);
      }

      throw new Error(`Google PageSpeed API error: ${error.message}`);
    }
  }

  async batchAnalyzePageSpeed(urls: string[], options: PageSpeedOptions = {}): Promise<Map<string, GooglePageSpeedResult>> {
    const results = new Map<string, GooglePageSpeedResult>();

    for (const url of urls) {
      try {
        // Add delay between requests to respect rate limits
        if (results.size > 0) {
          await this.delay(250); // 4 requests per second max
        }

        const result = await this.analyzePageSpeed(url, options);
        results.set(url, result);

        this.logger.info('Batch analysis progress', {
          completed: results.size,
          total: urls.length,
          url
        });

      } catch (error) {
        this.logger.error('Batch analysis failed for URL', { url, error });
        // Continue with other URLs even if one fails
      }
    }

    return results;
  }

  private checkRateLimit(): void {
    const now = Date.now();

    // Reset counter every minute
    if (now - this.lastMinuteReset > 60000) {
      this.requestCount = 0;
      this.lastMinuteReset = now;
    }

    // Check if we're approaching rate limit (240 requests per minute)
    if (this.requestCount >= 230) { // Safety buffer
      throw new Error('Google API rate limit approaching - please wait before making more requests');
    }
  }

  private recordRequest(): void {
    this.requestCount++;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isConfigured(): boolean {
    return !!(this.apiKey || this.auth);
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      if (!this.auth) {
        return false;
      }

      // Test with a simple request
      await this.analyzePageSpeed('https://example.com', { strategy: 'desktop' });
      return true;
    } catch (error) {
      this.logger.error('Google API configuration validation failed', { error });
      return false;
    }
  }

  getUsageStats(): { requestsThisMinute: number; minutesUntilReset: number } {
    const minutesUntilReset = Math.ceil((60000 - (Date.now() - this.lastMinuteReset)) / 60000);
    return {
      requestsThisMinute: this.requestCount,
      minutesUntilReset: Math.max(0, minutesUntilReset)
    };
  }
}