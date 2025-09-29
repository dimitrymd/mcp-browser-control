import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeywordIntelligenceTools } from '../src/tools/keyword-intelligence.js';
import { SessionManager } from '../src/drivers/session.js';
import winston from 'winston';

// Mock dependencies
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
} as unknown as winston.Logger;

const mockDriver = {
  getCurrentUrl: vi.fn(),
  getTitle: vi.fn(),
  executeScript: vi.fn(),
  get: vi.fn(),
  sleep: vi.fn()
};

const mockSession = {
  id: 'test-session-123',
  driver: mockDriver,
  createdAt: Date.now(),
  lastUsed: Date.now(),
  url: 'https://example.com/test',
  title: 'Test Page',
  isReady: true,
  browserType: 'chrome' as const,
  activeElement: undefined,
  scrollPosition: { x: 0, y: 0 },
  actionHistory: [],
  performanceMetrics: {
    totalActions: 0,
    successfulActions: 0,
    averageActionTime: 0
  }
};

const mockSessionManager = {
  createSession: vi.fn(),
  getSession: vi.fn().mockReturnValue(mockSession),
  listSessions: vi.fn().mockReturnValue([mockSession]),
  closeSession: vi.fn(),
  cleanupExpiredSessions: vi.fn()
} as unknown as SessionManager;

describe('KeywordIntelligenceTools', () => {
  let keywordTools: KeywordIntelligenceTools;
  const sessionId = 'test-session-123';

  beforeEach(() => {
    keywordTools = new KeywordIntelligenceTools(mockSessionManager, mockLogger);
    vi.clearAllMocks();

    // Setup default mocks
    mockDriver.getCurrentUrl.mockResolvedValue('https://example.com/test');
    mockDriver.getTitle.mockResolvedValue('Test Page');
    mockDriver.get.mockResolvedValue(undefined);
    mockDriver.sleep.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('researchKeywords', () => {
    it('should research keywords with default parameters', async () => {
      const params = {
        seedKeywords: ['test keyword', 'seo analysis']
      };

      const result = await keywordTools.researchKeywords(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.keywords).toBeDefined();
      expect(result.data?.keywords.length).toBe(2);
      expect(result.data?.analysis).toBeDefined();
      expect(result.data?.analysis.totalVolume).toBeGreaterThan(0);
      expect(result.data?.analysis.averageDifficulty).toBeGreaterThanOrEqual(0);
      expect(result.data?.analysis.averageDifficulty).toBeLessThanOrEqual(100);
    });

    it('should include related keywords when requested', async () => {
      const params = {
        seedKeywords: ['web development'],
        includeRelated: true,
        maxResults: 10
      };

      const result = await keywordTools.researchKeywords(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.relatedKeywords).toBeDefined();
      expect(Array.isArray(result.data?.relatedKeywords)).toBe(true);
      expect(result.data?.keywords.length).toBeLessThanOrEqual(10);
    });

    it('should identify keyword opportunities', async () => {
      const params = {
        seedKeywords: ['easy keyword', 'competitive keyword']
      };

      const result = await keywordTools.researchKeywords(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.opportunities).toBeDefined();
      expect(Array.isArray(result.data?.opportunities)).toBe(true);

      if (result.data?.opportunities.length > 0) {
        const opportunity = result.data.opportunities[0];
        expect(opportunity).toHaveProperty('keyword');
        expect(opportunity).toHaveProperty('priority');
        expect(opportunity).toHaveProperty('recommendation');
      }
    });

    it('should validate keyword difficulty scoring', async () => {
      const params = {
        seedKeywords: ['single', 'two words', 'three word phrase', 'very long tail keyword phrase']
      };

      const result = await keywordTools.researchKeywords(params, sessionId);

      expect(result.status).toBe('success');

      const keywords = result.data?.keywords || [];
      expect(keywords.length).toBe(4);

      // Single word should have higher difficulty
      const singleWord = keywords.find(k => k.keyword === 'single');
      const longTail = keywords.find(k => k.keyword === 'very long tail keyword phrase');

      if (singleWord && longTail) {
        expect(singleWord.difficulty).toBeGreaterThan(longTail.difficulty);
      }
    });

    it('should estimate search volume based on keyword characteristics', async () => {
      const params = {
        seedKeywords: ['popular', 'specific technical term', 'very specific long tail phrase']
      };

      const result = await keywordTools.researchKeywords(params, sessionId);

      expect(result.status).toBe('success');

      const keywords = result.data?.keywords || [];
      expect(keywords.length).toBe(3);

      // Single word should have higher volume
      const popular = keywords.find(k => k.keyword === 'popular');
      const longTail = keywords.find(k => k.keyword === 'very specific long tail phrase');

      if (popular && longTail) {
        expect(popular.volume).toBeGreaterThan(longTail.volume);
      }
    });

    it('should handle empty seed keywords array', async () => {
      const params = {
        seedKeywords: []
      };

      const result = await keywordTools.researchKeywords(params, sessionId);

      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('seedKeywords must be a non-empty array');
    });

    it('should handle invalid parameters', async () => {
      const result = await keywordTools.researchKeywords(null, sessionId);

      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('Parameters must be an object');
    });
  });

  describe('analyzeKeywordRankings', () => {
    it('should analyze keyword rankings with basic parameters', async () => {
      const params = {
        targetKeywords: ['test keyword', 'ranking analysis'],
        targetUrl: 'https://example.com'
      };

      const result = await keywordTools.analyzeKeywordRankings(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.rankings).toBeDefined();
      expect(result.data?.rankings.length).toBe(2);
      expect(result.data?.summary).toBeDefined();
      expect(result.data?.summary.visibilityScore).toBeGreaterThanOrEqual(0);
      expect(result.data?.summary.visibilityScore).toBeLessThanOrEqual(100);
    });

    it('should include competitor analysis when requested', async () => {
      const params = {
        targetKeywords: ['competitive keyword'],
        targetUrl: 'https://example.com',
        includeCompetitors: true
      };

      const result = await keywordTools.analyzeKeywordRankings(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.competitors).toBeDefined();
      expect(Array.isArray(result.data?.competitors)).toBe(true);
    });

    it('should calculate visibility score correctly', async () => {
      const params = {
        targetKeywords: ['keyword1', 'keyword2', 'keyword3', 'keyword4'],
        targetUrl: 'https://example.com'
      };

      const result = await keywordTools.analyzeKeywordRankings(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.summary.visibilityScore).toBeGreaterThanOrEqual(0);
      expect(result.data?.summary.visibilityScore).toBeLessThanOrEqual(100);

      // Visibility score should be percentage of keywords ranking in top 10
      const topTenCount = result.data?.summary.topTenCount || 0;
      const expectedVisibility = Math.round((topTenCount / 4) * 100);
      expect(result.data?.summary.visibilityScore).toBe(expectedVisibility);
    });

    it('should identify ranking opportunities', async () => {
      const params = {
        targetKeywords: ['ranking opportunity'],
        targetUrl: 'https://example.com'
      };

      const result = await keywordTools.analyzeKeywordRankings(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.opportunities).toBeDefined();
      expect(Array.isArray(result.data?.opportunities)).toBe(true);

      if (result.data?.opportunities.length > 0) {
        const opportunity = result.data.opportunities[0];
        expect(opportunity).toHaveProperty('keyword');
        expect(opportunity).toHaveProperty('currentPosition');
        expect(opportunity).toHaveProperty('opportunityType');
        expect(opportunity).toHaveProperty('priority');
      }
    });

    it('should handle different device types', async () => {
      const mobileParams = {
        targetKeywords: ['mobile keyword'],
        targetUrl: 'https://example.com',
        device: 'mobile' as const
      };

      const result = await keywordTools.analyzeKeywordRankings(mobileParams, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.rankings).toBeDefined();
    });

    it('should handle different geographic locations', async () => {
      const params = {
        targetKeywords: ['location keyword'],
        targetUrl: 'https://example.com',
        location: 'UK'
      };

      const result = await keywordTools.analyzeKeywordRankings(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.rankings).toBeDefined();
    });

    it('should validate required parameters', async () => {
      const paramsWithoutKeywords = {
        targetUrl: 'https://example.com'
      };

      const result1 = await keywordTools.analyzeKeywordRankings(paramsWithoutKeywords, sessionId);
      expect(result1.status).toBe('error');

      const paramsWithoutUrl = {
        targetKeywords: ['test']
      };

      const result2 = await keywordTools.analyzeKeywordRankings(paramsWithoutUrl, sessionId);
      expect(result2.status).toBe('error');
    });
  });

  describe('Helper Methods', () => {
    it('should estimate volume correctly for different keyword types', async () => {
      const singleWord = await keywordTools['estimateVolume']('seo');
      const twoWords = await keywordTools['estimateVolume']('seo tools');
      const longTail = await keywordTools['estimateVolume']('best seo tools for small business');

      expect(singleWord).toBeGreaterThan(twoWords);
      expect(twoWords).toBeGreaterThan(longTail);
      expect(longTail).toBeGreaterThanOrEqual(100); // Minimum volume
    });

    it('should calculate difficulty based on keyword length', async () => {
      const singleWord = await keywordTools['calculateDifficulty']('marketing');
      const twoWords = await keywordTools['calculateDifficulty']('digital marketing');
      const longTail = await keywordTools['calculateDifficulty']('best digital marketing strategies for startups');

      expect(singleWord).toBeGreaterThan(twoWords);
      expect(twoWords).toBeGreaterThan(longTail);
      expect(singleWord).toBeLessThanOrEqual(100);
      expect(longTail).toBeGreaterThanOrEqual(10);
    });

    it('should assess competition levels correctly', async () => {
      const lowComp = await keywordTools['assessCompetition']('very specific niche term');
      const highComp = await keywordTools['assessCompetition']('marketing');

      expect(['low', 'medium', 'high']).toContain(lowComp);
      expect(['low', 'medium', 'high']).toContain(highComp);
    });

    it('should estimate CPC based on commercial intent', async () => {
      const commercialKeyword = await keywordTools['estimateCPC']('buy seo tools');
      const informationalKeyword = await keywordTools['estimateCPC']('what is seo');

      expect(commercialKeyword).toBeGreaterThan(informationalKeyword);
      expect(commercialKeyword).toBeGreaterThanOrEqual(0);
    });

    it('should generate related keywords', async () => {
      const relatedKeywords = await keywordTools['generateRelatedKeywords']('seo');

      expect(Array.isArray(relatedKeywords)).toBe(true);
      expect(relatedKeywords.length).toBeGreaterThan(0);
      expect(relatedKeywords.length).toBeLessThanOrEqual(10);
      expect(relatedKeywords.every(keyword => typeof keyword === 'string')).toBe(true);
    });

    it('should detect SERP features based on keyword type', async () => {
      const howToFeatures = await keywordTools['detectSERPFeatures']('how to do seo');
      const whatIsFeatures = await keywordTools['detectSERPFeatures']('what is seo');
      const bestFeatures = await keywordTools['detectSERPFeatures']('best seo tools');

      expect(Array.isArray(howToFeatures)).toBe(true);
      expect(Array.isArray(whatIsFeatures)).toBe(true);
      expect(Array.isArray(bestFeatures)).toBe(true);

      expect(howToFeatures).toContain('featured-snippet');
      expect(whatIsFeatures).toContain('knowledge-panel');
      expect(bestFeatures).toContain('shopping-results');
    });
  });

  describe('Session Management', () => {
    it('should use provided session ID correctly', async () => {
      const params = {
        seedKeywords: ['test keyword']
      };

      const result = await keywordTools.researchKeywords(params, sessionId);

      expect(result.status).toBe('success');
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(sessionId);
    });

    it('should handle session validation', async () => {
      const params = {
        seedKeywords: ['test keyword']
      };

      // Test with valid session ID
      const result = await keywordTools.researchKeywords(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.keywords).toBeDefined();
    });
  });

  describe('Parameter Validation', () => {
    it('should validate keyword research parameters correctly', async () => {
      const validParams = {
        seedKeywords: ['valid keyword'],
        location: 'US',
        language: 'en',
        includeVolume: true,
        maxResults: 25
      };

      const result = await keywordTools.researchKeywords(validParams, sessionId);

      expect(result.status).toBe('success');
    });

    it('should validate keyword rankings parameters correctly', async () => {
      const validParams = {
        targetKeywords: ['test keyword'],
        targetUrl: 'https://valid-url.com',
        location: 'UK',
        device: 'mobile' as const,
        includeCompetitors: false
      };

      const result = await keywordTools.analyzeKeywordRankings(validParams, sessionId);

      expect(result.status).toBe('success');
    });

    it('should reject invalid keyword research parameters', async () => {
      const invalidParams = {
        seedKeywords: 'not an array'
      };

      const result = await keywordTools.researchKeywords(invalidParams, sessionId);

      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('seedKeywords must be a non-empty array');
    });

    it('should reject invalid ranking parameters', async () => {
      const paramsWithoutUrl = {
        targetKeywords: ['test']
      };

      const result = await keywordTools.analyzeKeywordRankings(paramsWithoutUrl, sessionId);

      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('targetUrl is required');
    });
  });

  describe('Logging and Monitoring', () => {
    it('should log keyword research completion', async () => {
      const params = {
        seedKeywords: ['test keyword']
      };

      await keywordTools.researchKeywords(params, sessionId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Keyword research completed successfully',
        expect.objectContaining({
          keywordsAnalyzed: expect.any(Number),
          opportunitiesFound: expect.any(Number)
        })
      );
    });

    it('should log ranking analysis completion', async () => {
      const params = {
        targetKeywords: ['test keyword'],
        targetUrl: 'https://example.com'
      };

      await keywordTools.analyzeKeywordRankings(params, sessionId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Keyword ranking analysis completed',
        expect.objectContaining({
          keywordsTracked: expect.any(Number),
          averagePosition: expect.any(Number),
          visibilityScore: expect.any(Number)
        })
      );
    });
  });

  describe('Algorithm Quality', () => {
    it('should provide consistent difficulty scoring', async () => {
      const params = {
        seedKeywords: ['consistent keyword']
      };

      const result1 = await keywordTools.researchKeywords(params, sessionId);
      const result2 = await keywordTools.researchKeywords(params, sessionId);

      expect(result1.status).toBe('success');
      expect(result2.status).toBe('success');

      if (result1.data?.keywords[0] && result2.data?.keywords[0]) {
        expect(result1.data.keywords[0].difficulty).toBe(result2.data.keywords[0].difficulty);
        expect(result1.data.keywords[0].volume).toBe(result2.data.keywords[0].volume);
      }
    });

    it('should provide reasonable keyword metrics', async () => {
      const params = {
        seedKeywords: ['reasonable keyword']
      };

      const result = await keywordTools.researchKeywords(params, sessionId);

      expect(result.status).toBe('success');

      const keyword = result.data?.keywords[0];
      if (keyword) {
        expect(keyword.volume).toBeGreaterThanOrEqual(100);
        expect(keyword.volume).toBeLessThanOrEqual(50000);
        expect(keyword.difficulty).toBeGreaterThanOrEqual(10);
        expect(keyword.difficulty).toBeLessThanOrEqual(100);
        expect(keyword.cpc).toBeGreaterThan(0);
        expect(['low', 'medium', 'high']).toContain(keyword.competition);
        expect(['rising', 'stable', 'declining']).toContain(keyword.trend);
      }
    });
  });

  describe('findKeywordOpportunities', () => {
    it('should find keyword opportunities with competitor analysis', async () => {
      const params = {
        competitorUrls: ['https://competitor1.com', 'https://competitor2.com'],
        currentKeywords: ['existing keyword'],
        industry: 'technology'
      };

      const result = await keywordTools.findKeywordOpportunities(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.contentGaps).toBeDefined();
      expect(result.data?.questionKeywords).toBeDefined();
      expect(result.data?.longTailOpportunities).toBeDefined();
      expect(result.data?.strategicRecommendations).toBeDefined();
      expect(Array.isArray(result.data?.strategicRecommendations)).toBe(true);
    });

    it('should provide strategic recommendations', async () => {
      const params = {
        competitorUrls: ['https://example.com']
      };

      const result = await keywordTools.findKeywordOpportunities(params, sessionId);

      expect(result.status).toBe('success');
      if (result.data?.strategicRecommendations.length > 0) {
        const recommendation = result.data.strategicRecommendations[0];
        expect(recommendation).toHaveProperty('priority');
        expect(recommendation).toHaveProperty('action');
        expect(recommendation).toHaveProperty('timeline');
      }
    });
  });

  describe('trackSerpPositions', () => {
    it('should track SERP positions and changes', async () => {
      const params = {
        keywords: ['test keyword', 'ranking keyword'],
        targetDomain: 'example.com',
        trackingFrequency: 'daily'
      };

      const result = await keywordTools.trackSerpPositions(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.serpData).toBeDefined();
      expect(result.data?.rankings).toBeDefined();
      expect(result.data?.competitorMovement).toBeDefined();
      expect(result.data?.alerts).toBeDefined();
      expect(Array.isArray(result.data?.serpData)).toBe(true);
      expect(Array.isArray(result.data?.rankings)).toBe(true);
    });

    it('should identify SERP features', async () => {
      const params = {
        keywords: ['featured snippet keyword'],
        targetDomain: 'example.com'
      };

      const result = await keywordTools.trackSerpPositions(params, sessionId);

      expect(result.status).toBe('success');
      if (result.data?.serpData.length > 0) {
        const serpResult = result.data.serpData[0];
        expect(serpResult).toHaveProperty('featuredSnippet');
        expect(serpResult.results[0]).toHaveProperty('serpFeatures');
      }
    });
  });

  describe('analyzeKeywordCompetition', () => {
    it('should analyze keyword competition matrix', async () => {
      const params = {
        targetKeywords: ['competitive keyword', 'market keyword'],
        competitorUrls: ['https://competitor1.com', 'https://competitor2.com'],
        analysisDepth: 'comprehensive'
      };

      const result = await keywordTools.analyzeKeywordCompetition(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.competitiveMatrix).toBeDefined();
      expect(result.data?.strategicInsights).toBeDefined();
      expect(result.data?.actionPlan).toBeDefined();
      expect(Array.isArray(result.data?.competitiveMatrix)).toBe(true);
      expect(Array.isArray(result.data?.actionPlan)).toBe(true);
    });

    it('should provide strategic insights', async () => {
      const params = {
        targetKeywords: ['insight keyword'],
        competitorUrls: ['https://example.com']
      };

      const result = await keywordTools.analyzeKeywordCompetition(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.strategicInsights).toHaveProperty('weakCompetitors');
      expect(result.data?.strategicInsights).toHaveProperty('contentGaps');
      expect(result.data?.strategicInsights).toHaveProperty('rankingOpportunities');
      expect(result.data?.strategicInsights).toHaveProperty('competitiveThreats');
    });
  });

  describe('analyzeBacklinks', () => {
    it('should analyze backlink profile', async () => {
      const params = {
        targetUrl: 'https://example.com'
      };

      const result = await keywordTools.analyzeBacklinks(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.totalBacklinks).toBeGreaterThan(0);
      expect(result.data?.uniqueDomains).toBeGreaterThan(0);
      expect(result.data?.domainAuthority).toBeGreaterThanOrEqual(0);
      expect(result.data?.domainAuthority).toBeLessThanOrEqual(100);
      expect(result.data?.linkQuality).toBeDefined();
      expect(result.data?.topReferrers).toBeDefined();
      expect(Array.isArray(result.data?.topReferrers)).toBe(true);
    });

    it('should provide link opportunities', async () => {
      const params = {
        targetUrl: 'https://example.com'
      };

      const result = await keywordTools.analyzeBacklinks(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.linkOpportunities).toBeDefined();
      expect(Array.isArray(result.data?.linkOpportunities)).toBe(true);
      expect(result.data?.recommendations).toBeDefined();
      expect(Array.isArray(result.data?.recommendations)).toBe(true);
    });

    it('should assess link quality distribution', async () => {
      const params = {
        targetUrl: 'https://example.com'
      };

      const result = await keywordTools.analyzeBacklinks(params, sessionId);

      expect(result.status).toBe('success');
      const linkQuality = result.data?.linkQuality;
      if (linkQuality) {
        const total = linkQuality.excellent + linkQuality.good + linkQuality.average + linkQuality.poor;
        expect(total).toBe(100); // Should be percentages adding to 100
      }
    });
  });

  describe('generateComprehensiveSEOReport', () => {
    it('should generate comprehensive SEO report', async () => {
      const params = {
        websiteUrl: 'https://example.com',
        reportType: 'comprehensive'
      };

      const result = await keywordTools.generateComprehensiveSEOReport(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.reportPath).toBeDefined();
      expect(result.data?.reportPath).toMatch(/browser-control\/reports\/.*\.md$/);
      expect(result.data?.executiveSummary).toBeDefined();
      expect(result.data?.executiveSummary.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.data?.executiveSummary.overallScore).toBeLessThanOrEqual(100);
    });

    it('should include all analysis components', async () => {
      const params = {
        websiteUrl: 'https://example.com',
        reportType: 'technical'
      };

      const result = await keywordTools.generateComprehensiveSEOReport(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.performanceAnalysis).toBeDefined();
      expect(result.data?.keywordAnalysis).toBeDefined();
      expect(result.data?.competitiveAnalysis).toBeDefined();
      expect(result.data?.actionPlan).toBeDefined();
      expect(result.data?.actionPlan.quickWins).toBeDefined();
      expect(result.data?.actionPlan.mediumTerm).toBeDefined();
      expect(result.data?.actionPlan.longTerm).toBeDefined();
    });

    it('should save report to browser-control directory', async () => {
      const params = {
        websiteUrl: 'https://test-site.com'
      };

      const result = await keywordTools.generateComprehensiveSEOReport(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.reportPath).toContain('browser-control/reports/');
      expect(result.data?.reportPath).toContain('seo-report-');
      expect(result.data?.reportPath).toMatch(/\.md$/);
    });
  });

  describe('monitorSearchVisibility', () => {
    it('should monitor search visibility metrics', async () => {
      const params = {
        websiteUrl: 'https://example.com'
      };

      const result = await keywordTools.monitorSearchVisibility(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.overallVisibility).toBeGreaterThanOrEqual(0);
      expect(result.data?.overallVisibility).toBeLessThanOrEqual(100);
      expect(result.data?.keywordVisibility).toBeDefined();
      expect(result.data?.trendAnalysis).toBeDefined();
      expect(result.data?.competitorComparison).toBeDefined();
    });

    it('should provide trend analysis', async () => {
      const params = {
        websiteUrl: 'https://example.com'
      };

      const result = await keywordTools.monitorSearchVisibility(params, sessionId);

      expect(result.status).toBe('success');
      const trends = result.data?.trendAnalysis;
      if (trends) {
        expect(trends).toHaveProperty('thirtyDayChange');
        expect(trends).toHaveProperty('ninetyDayChange');
        expect(trends).toHaveProperty('yearOverYear');
        expect(['improving', 'stable', 'declining']).toContain(trends.trend);
      }
    });

    it('should compare with competitors', async () => {
      const params = {
        websiteUrl: 'https://example.com'
      };

      const result = await keywordTools.monitorSearchVisibility(params, sessionId);

      expect(result.status).toBe('success');
      const comparison = result.data?.competitorComparison;
      if (comparison) {
        expect(comparison.betterThan + comparison.worseThan).toBe(100);
        expect(['above-average', 'average', 'below-average']).toContain(comparison.marketPosition);
      }
    });

    it('should provide actionable recommendations', async () => {
      const params = {
        websiteUrl: 'https://example.com'
      };

      const result = await keywordTools.monitorSearchVisibility(params, sessionId);

      expect(result.status).toBe('success');
      expect(result.data?.recommendations).toBeDefined();
      expect(Array.isArray(result.data?.recommendations)).toBe(true);
      expect(result.data?.recommendations.length).toBeGreaterThan(0);
    });
  });
});