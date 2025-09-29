import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
import winston from 'winston';

export interface SearchConsoleKeywordData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  device: 'desktop' | 'mobile' | 'tablet';
  country: string;
}

export interface CustomSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  position: number;
}

export interface SERPAnalysisResult {
  keyword: string;
  results: CustomSearchResult[];
  totalResults: number;
  searchTime: number;
  relatedSearches: string[];
  serpFeatures: string[];
}

export class GoogleKeywordAPI {
  private auth: GoogleAuth | null = null;
  private apiKey: string | null = null;
  private logger: winston.Logger;
  private searchConsoleBaseUrl = 'https://www.googleapis.com/webmasters/v3';
  private customSearchBaseUrl = 'https://www.googleapis.com/customsearch/v1';

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.initializeAuth();
  }

  private initializeAuth(): void {
    try {
      // Use the same API key as PageSpeed Insights
      this.apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || null;

      if (this.apiKey) {
        this.logger.info('Google Keyword API configured with existing API key');
      } else {
        this.logger.warn('Google API key not found - keyword intelligence will be limited');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Google Keyword API', { error });
    }
  }

  async getSearchConsoleKeywords(siteUrl: string, options: {
    startDate?: string;
    endDate?: string;
    dimensions?: string[];
    rowLimit?: number;
  } = {}): Promise<SearchConsoleKeywordData[]> {
    if (!this.apiKey) {
      throw new Error('Google API key required for Search Console data');
    }

    try {
      const {
        startDate = this.getDateString(-30), // Last 30 days
        endDate = this.getDateString(0),     // Today
        dimensions = ['query', 'device', 'country'],
        rowLimit = 1000
      } = options;

      const requestBody = {
        startDate,
        endDate,
        dimensions,
        rowLimit,
        dimensionFilterGroups: [{
          filters: [{
            dimension: 'searchAppearance',
            operator: 'equals',
            expression: 'web'
          }]
        }]
      };

      const response = await axios.post(
        `${this.searchConsoleBaseUrl}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query?key=${this.apiKey}`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const keywordData = response.data.rows?.map((row: any) => ({
        query: row.keys[0],
        device: row.keys[1] || 'desktop',
        country: row.keys[2] || 'usa',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: Math.round(row.position || 0)
      })) || [];

      this.logger.info('Search Console keyword data retrieved', {
        siteUrl,
        keywordsFound: keywordData.length,
        dateRange: `${startDate} to ${endDate}`
      });

      return keywordData;

    } catch (error: any) {
      this.logger.error('Search Console API request failed', {
        siteUrl,
        error: error.message,
        status: error.response?.status
      });

      if (error.response?.status === 403) {
        throw new Error('Search Console API access denied - verify website ownership in Google Search Console');
      } else if (error.response?.status === 404) {
        throw new Error('Website not found in Search Console - add and verify the website first');
      }

      throw new Error(`Search Console API error: ${error.message}`);
    }
  }

  async analyzeCustomSearch(keyword: string, options: {
    cx?: string; // Custom Search Engine ID
    gl?: string; // Geographic location
    lr?: string; // Language restriction
    num?: number; // Number of results
  } = {}): Promise<SERPAnalysisResult> {
    if (!this.apiKey) {
      throw new Error('Google API key required for Custom Search');
    }

    try {
      const {
        cx = process.env.GOOGLE_CUSTOM_SEARCH_CX || '',
        gl = 'us',
        lr = 'lang_en',
        num = 10
      } = options;

      if (!cx) {
        throw new Error('Google Custom Search Engine ID required - set GOOGLE_CUSTOM_SEARCH_CX environment variable');
      }

      const params = new URLSearchParams({
        key: this.apiKey,
        cx: cx,
        q: keyword,
        gl: gl,
        lr: lr,
        num: num.toString()
      });

      const response = await axios.get(`${this.customSearchBaseUrl}?${params.toString()}`);

      const results: CustomSearchResult[] = response.data.items?.map((item: any, index: number) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        displayLink: item.displayLink,
        position: index + 1
      })) || [];

      // Extract SERP features and related searches
      const serpFeatures: string[] = [];
      const relatedSearches: string[] = [];

      // Analyze for SERP features based on results
      if (results.some(r => r.snippet.includes('...'))) {
        serpFeatures.push('featured-snippet');
      }
      if (results.some(r => r.displayLink.includes('wikipedia'))) {
        serpFeatures.push('knowledge-panel');
      }

      const serpAnalysis: SERPAnalysisResult = {
        keyword,
        results,
        totalResults: parseInt(response.data.searchInformation?.totalResults || '0'),
        searchTime: parseFloat(response.data.searchInformation?.searchTime || '0'),
        relatedSearches,
        serpFeatures
      };

      this.logger.info('Custom Search analysis completed', {
        keyword,
        resultsFound: results.length,
        totalResults: serpAnalysis.totalResults,
        serpFeatures: serpFeatures.length
      });

      return serpAnalysis;

    } catch (error: any) {
      this.logger.error('Custom Search API request failed', {
        keyword,
        error: error.message,
        status: error.response?.status
      });

      if (error.response?.status === 403) {
        throw new Error('Custom Search API quota exceeded or access denied');
      }

      throw new Error(`Custom Search API error: ${error.message}`);
    }
  }

  async calculateKeywordDifficulty(keyword: string, serpData: SERPAnalysisResult): Promise<number> {
    // Algorithmic difficulty calculation based on SERP analysis
    let difficulty = 30; // Base difficulty

    // Analyze top ranking domains
    const topResults = serpData.results.slice(0, 10);
    const highAuthorityDomains = [
      'wikipedia.org', 'youtube.com', 'linkedin.com', 'amazon.com',
      'facebook.com', 'reddit.com', 'stackoverflow.com', 'github.com'
    ];

    let authorityCount = 0;
    let commercialCount = 0;

    topResults.forEach(result => {
      const domain = new URL(result.link).hostname;

      // Check for high authority domains
      if (highAuthorityDomains.some(auth => domain.includes(auth))) {
        authorityCount++;
      }

      // Check for commercial intent
      if (result.title.toLowerCase().includes('buy') ||
          result.title.toLowerCase().includes('price') ||
          result.title.toLowerCase().includes('shop')) {
        commercialCount++;
      }
    });

    // Adjust difficulty based on competition
    difficulty += (authorityCount * 8); // High authority domains increase difficulty
    difficulty += (commercialCount * 5); // Commercial results increase difficulty
    difficulty += Math.min(20, serpData.totalResults / 1000000); // Total results factor

    return Math.min(100, Math.max(10, difficulty));
  }

  async estimateSearchVolume(keyword: string, difficulty: number): Promise<number> {
    // Algorithmic volume estimation based on keyword characteristics
    const baseVolume = 1000;

    // Adjust based on keyword length (longer = more specific = lower volume)
    const wordCount = keyword.split(' ').length;
    let volumeMultiplier = 1;

    if (wordCount === 1) volumeMultiplier = 5;      // Single word = high volume
    else if (wordCount === 2) volumeMultiplier = 3; // Two words = medium volume
    else if (wordCount === 3) volumeMultiplier = 1; // Three words = lower volume
    else volumeMultiplier = 0.3;                    // Long tail = low volume

    // Adjust based on difficulty (higher difficulty often means higher volume)
    const difficultyMultiplier = 1 + (difficulty / 100);

    const estimatedVolume = Math.round(baseVolume * volumeMultiplier * difficultyMultiplier);

    return Math.max(100, estimatedVolume); // Minimum 100 monthly searches
  }

  private getDateString(daysFromToday: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    return date.toISOString().split('T')[0];
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getAPILimits(): { searchConsole: string; customSearch: string } {
    return {
      searchConsole: '25,000 requests/day (FREE)',
      customSearch: '100 requests/day (FREE), $5 per 1,000 additional'
    };
  }
}