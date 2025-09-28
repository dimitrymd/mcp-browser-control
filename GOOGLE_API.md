# Google API Integration Guide for SEO Performance Tools
## Complete Setup Guide for PageSpeed Insights API

**Purpose**: Enable professional SEO analysis capabilities in MCP Browser Control Server
**Required APIs**: Google PageSpeed Insights API (Free)
**Usage Limits**: 25,000 requests/day, 240 requests/minute (Free tier)
**Prepared by**: Funway Interactive SRL

---

## Why Google API Integration is Essential

### **🎯 Professional SEO Analysis Benefits**
- **Official Google Metrics**: Real Lighthouse scores and Core Web Vitals data
- **Industry Standards**: Google's official performance and SEO scoring
- **Field Data Access**: Real user metrics from Chrome User Experience Report
- **Mobile/Desktop Analysis**: Comprehensive mobile and desktop performance insights
- **Competitive Advantage**: Professional-grade analysis rivaling expensive SEO tools

### **🚀 Business Value**
- **Replace SEO Tools**: Competitor to SEMrush, Ahrefs, Moz ($100-$400/month)
- **Enterprise Features**: Professional reporting and analysis capabilities
- **Market Differentiation**: Only MCP platform with Google-powered SEO analysis
- **Revenue Opportunity**: Premium SEO intelligence features for enterprise customers

## Step-by-Step API Key Setup

### **📋 Step 1: Google Cloud Console Access**
1. **Navigate to Google Cloud Console**: https://console.cloud.google.com/
2. **Sign in**: Use your Google account (personal or business)
3. **Account Requirements**: Any Google account works (no special requirements)

### **🏗️ Step 2: Create or Select Project**
1. **Create New Project**:
   - Click "+ Create Project" button
   - **Project Name**: "MCP-Browser-Control-SEO" (or your preferred name)
   - **Organization**: Leave default or select your organization
   - **Location**: Leave default

2. **Select Existing Project**:
   - Use dropdown to select existing project
   - Ensure you have proper permissions (Editor or Owner role)

### **⚡ Step 3: Enable PageSpeed Insights API**
1. **Navigate to APIs & Services**:
   - Click on "APIs & Services" in left sidebar
   - Click on "+ Enable APIs and Services"

2. **Search and Enable**:
   - Search for: **"PageSpeed Insights API"**
   - Click on the first result
   - Click **"Enable"** button
   - Wait for activation (usually instant)

### **🔑 Step 4: Create API Key**
1. **Navigate to Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click **"+ Create Credentials"**
   - Select **"API Key"**

2. **Copy API Key**:
   - Google generates your key instantly
   - **Copy the API key** (you'll need this for configuration)
   - Click "Close" to dismiss the popup

### **🔒 Step 5: Secure Your API Key (CRITICAL)**
1. **Restrict API Key** (Highly Recommended):
   - Click on your new API key in the credentials list
   - Click "Edit API key" (pencil icon)

2. **Set API Restrictions**:
   - **API Restrictions**: Select "Restrict key"
   - **Select APIs**: Choose "PageSpeed Insights API"
   - Click **"Save"**

3. **Application Restrictions** (Optional but Recommended):
   - **IP addresses**: Add your server IPs if known
   - **HTTP referrers**: Add your domains if web-based
   - **Android/iOS apps**: Not applicable for our use case

### **⚙️ Step 6: Environment Configuration**

#### **Option 1: Environment Variable (Recommended)**
```bash
# Add to your .env file
GOOGLE_PAGESPEED_API_KEY=your_api_key_here

# For production deployment
export GOOGLE_PAGESPEED_API_KEY=your_api_key_here
```

#### **Option 2: Configuration File**
```json
// config/google-api.json (DO NOT commit to version control)
{
  "pageSpeedInsights": {
    "apiKey": "your_api_key_here",
    "baseUrl": "https://www.googleapis.com/pagespeedonline/v5",
    "quotas": {
      "requestsPerDay": 25000,
      "requestsPerMinute": 240
    }
  }
}
```

#### **Option 3: MCP Server Configuration**
```json
// In your MCP configuration
{
  "mcpServers": {
    "browser-control": {
      "command": "node",
      "args": ["dist/server.js"],
      "env": {
        "GOOGLE_PAGESPEED_API_KEY": "your_api_key_here",
        "LOG_LEVEL": "info",
        "HEADLESS": "true"
      }
    }
  }
}
```

## API Usage and Limits

### **📊 Free Tier Specifications**
- **Daily Quota**: 25,000 requests per day
- **Rate Limit**: 240 requests per minute (4 requests per second)
- **Cost**: **100% FREE** (Google doesn't even offer paid tiers)
- **Geographic Restrictions**: None (global availability)

### **💡 Usage Optimization Strategies**

#### **Smart Caching Strategy**
```typescript
// Implementation approach for our SEO tools
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const MAX_REQUESTS_PER_MINUTE = 200; // Leave buffer under 240 limit

// Cache results to avoid unnecessary API calls
if (lastAnalysis && (Date.now() - lastAnalysis.timestamp < CACHE_DURATION)) {
  return cachedResult;
}
```

#### **Rate Limiting Implementation**
```typescript
// Rate limiting to stay within Google's limits
class APIRateLimiter {
  private requestQueue: Array<() => Promise<any>> = [];
  private requestCount = 0;
  private lastMinute = Date.now();

  async makeRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    // Implement intelligent request queuing
    return this.executeWithRateLimit(requestFn);
  }
}
```

### **🔍 API Endpoints and Capabilities**

#### **Primary Endpoint**
```
GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed
```

#### **Parameters**
- **url**: The URL to analyze (required)
- **key**: Your API key (required)
- **category**: performance, accessibility, best-practices, seo, pwa
- **strategy**: mobile, desktop
- **locale**: Language/locale for analysis (en, es, de, etc.)

#### **Example Request**
```bash
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&key=YOUR_API_KEY&category=performance&strategy=desktop"
```

#### **Response Data Structure**
```json
{
  "lighthouseResult": {
    "categories": {
      "performance": { "score": 0.85 },
      "accessibility": { "score": 0.92 },
      "best-practices": { "score": 0.88 },
      "seo": { "score": 0.95 }
    },
    "audits": {
      "largest-contentful-paint": { "numericValue": 2400 },
      "first-input-delay": { "numericValue": 120 },
      "cumulative-layout-shift": { "numericValue": 0.08 }
    }
  },
  "loadingExperience": {
    "metrics": {
      "LARGEST_CONTENTFUL_PAINT_MS": { "percentile": 2100 },
      "FIRST_INPUT_DELAY_MS": { "percentile": 95 }
    }
  }
}
```

## Security Best Practices

### **🔒 API Key Security**

#### **DO NOT**:
- ❌ Commit API keys to version control (use .env files)
- ❌ Include API keys in client-side code
- ❌ Share API keys in public documentation or screenshots
- ❌ Use API keys without restrictions

#### **DO**:
- ✅ Use environment variables for API key storage
- ✅ Restrict API key to specific APIs and applications
- ✅ Monitor API key usage in Google Cloud Console
- ✅ Rotate API keys periodically for security
- ✅ Use different API keys for development and production

### **🛡️ Environment Variable Security**
```bash
# .env file (add to .gitignore)
GOOGLE_PAGESPEED_API_KEY=AIzaSyBOTI22WRH3gCjroqP2OYpYh_jISe0B6d0

# .gitignore entry
.env
config/google-api.json
secrets/
*.key
```

### **🔍 API Key Validation**
```typescript
// Validate API key before making requests
const validateGoogleAPIKey = (apiKey: string): boolean => {
  if (!apiKey || apiKey.length < 30) {
    throw new Error('Invalid Google API key - check your configuration');
  }
  if (!apiKey.startsWith('AIza')) {
    throw new Error('Invalid Google API key format - should start with "AIza"');
  }
  return true;
};
```

## Implementation Integration

### **📦 Required Dependencies**
```bash
# Install HTTP client for API requests
npm install axios

# Install rate limiting utility
npm install bottleneck

# Install result caching
npm install node-cache
```

### **🔧 Implementation Pattern**
```typescript
// src/utils/google-api.ts
export class GooglePageSpeedAPI {
  private apiKey: string;
  private rateLimiter: Bottleneck;
  private cache: NodeCache;

  constructor() {
    this.apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || '';
    this.validateAPIKey();
    this.setupRateLimiting();
    this.setupCaching();
  }

  async analyzePageSpeed(url: string, options: PageSpeedOptions): Promise<PageSpeedData> {
    // Implementation with rate limiting and caching
    return this.rateLimiter.schedule(() => this.makeAPIRequest(url, options));
  }
}
```

### **🎯 Integration with SEO Tools**
```typescript
// Enhanced implementation for our SEO tools
async analyzePageSpeed(params: unknown, sessionId?: string): Promise<MCPToolResult<PageSpeedResult>> {
  try {
    const currentUrl = await session.driver.getCurrentUrl();

    // Use Google API if available, fallback to browser analysis
    if (process.env.GOOGLE_PAGESPEED_API_KEY) {
      const googleData = await this.googleAPI.analyzePageSpeed(currentUrl, options);
      return this.formatGoogleResults(googleData);
    } else {
      // Fallback to browser-based analysis
      return this.browserBasedAnalysis(session);
    }
  } catch (error) {
    // Graceful fallback to browser analysis if API fails
    return this.browserBasedAnalysis(session);
  }
}
```

## Troubleshooting

### **🚨 Common Issues and Solutions**

#### **API Key Not Working**
- **Check**: API key copied correctly (no extra spaces)
- **Verify**: PageSpeed Insights API is enabled in your project
- **Confirm**: API key restrictions allow your application
- **Test**: Try API key in browser: `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&key=YOUR_KEY`

#### **Rate Limiting Errors**
- **Error**: "Quota exceeded" or "Rate limit exceeded"
- **Solution**: Implement request queuing and rate limiting
- **Prevention**: Cache results for 24 hours minimum
- **Monitoring**: Track API usage in Google Cloud Console

#### **CORS Issues (If Using Client-Side)**
- **Not Applicable**: We're using server-side API calls
- **Server Implementation**: No CORS restrictions for server-to-server calls
- **Security**: Keep API key server-side only

#### **API Response Errors**
```typescript
// Error handling implementation
const handleGoogleAPIError = (error: any): string => {
  switch (error.response?.status) {
    case 400: return 'Invalid URL or parameters';
    case 403: return 'API key invalid or quota exceeded';
    case 429: return 'Rate limit exceeded - try again later';
    case 500: return 'Google API temporarily unavailable';
    default: return 'Google API request failed';
  }
};
```

## Configuration Examples

### **🔧 Complete Environment Setup**
```bash
# .env file for MCP Browser Control Server
NODE_ENV=production
GOOGLE_PAGESPEED_API_KEY=AIzaSyBOTI22WRH3gCjroqP2OYpYh_jISe0B6d0
BROWSER_TYPE=chrome
HEADLESS=true
MAX_SESSIONS=5
SESSION_TIMEOUT=600000
LOG_LEVEL=info

# SEO-specific settings
SEO_CACHE_DURATION=86400000  # 24 hours in milliseconds
SEO_RATE_LIMIT=200           # Requests per minute (buffer under 240)
SEO_ENABLE_FIELD_DATA=true   # Include real user metrics
```

### **📊 Usage Monitoring Setup**
```typescript
// Monitor API usage to avoid quota issues
class APIUsageMonitor {
  private dailyCount = 0;
  private minuteCount = 0;
  private lastReset = Date.now();

  canMakeRequest(): boolean {
    this.resetCountersIfNeeded();
    return this.dailyCount < 24000 && this.minuteCount < 230; // Safety buffer
  }

  recordRequest(): void {
    this.dailyCount++;
    this.minuteCount++;
  }
}
```

## Testing Your API Key

### **🧪 Validation Commands**

#### **Quick API Test**
```bash
# Test your API key directly
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&key=YOUR_API_KEY"

# Expected response: JSON with lighthouse results
```

#### **MCP Integration Test**
```typescript
// Test within our SEO tools
const testGoogleAPI = async () => {
  const seoTools = new SEOPerformanceTools(sessionManager, logger);
  const result = await seoTools.analyzePageSpeed({}, sessionId);

  if (result.status === 'success') {
    console.log('✅ Google API integration working');
    console.log('Performance Score:', result.data?.performanceScore);
  } else {
    console.log('❌ API integration failed:', result.error);
  }
};
```

### **📈 Performance Validation**
```typescript
// Validate API performance and caching
const validateAPIPerformance = async () => {
  const startTime = Date.now();

  // First request (should call Google API)
  const result1 = await seoTools.analyzePageSpeed({ url: 'https://example.com' });
  const firstRequestTime = Date.now() - startTime;

  // Second request (should use cache)
  const result2 = await seoTools.analyzePageSpeed({ url: 'https://example.com' });
  const secondRequestTime = Date.now() - startTime - firstRequestTime;

  console.log('First request (API):', firstRequestTime + 'ms');
  console.log('Second request (cache):', secondRequestTime + 'ms');
  console.log('Caching working:', secondRequestTime < firstRequestTime / 2);
};
```

## Production Deployment Considerations

### **🏢 Enterprise Setup**

#### **Multiple Environment Support**
```bash
# Development
GOOGLE_PAGESPEED_API_KEY_DEV=your_dev_key_here

# Staging
GOOGLE_PAGESPEED_API_KEY_STAGING=your_staging_key_here

# Production
GOOGLE_PAGESPEED_API_KEY_PROD=your_prod_key_here
```

#### **Kubernetes/Docker Configuration**
```yaml
# kubernetes-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: google-api-credentials
type: Opaque
data:
  pagespeed-api-key: <base64-encoded-api-key>
```

```dockerfile
# Dockerfile environment setup
ENV GOOGLE_PAGESPEED_API_KEY=""
```

### **📊 Monitoring and Alerting**
```typescript
// Production monitoring implementation
class APIMonitoring {
  async checkAPIHealth(): Promise<boolean> {
    try {
      const testResult = await this.makeTestRequest();
      this.recordSuccessMetric();
      return true;
    } catch (error) {
      this.recordFailureMetric();
      this.alertOnAPIFailure(error);
      return false;
    }
  }

  private alertOnAPIFailure(error: any): void {
    if (error.response?.status === 403) {
      this.sendAlert('CRITICAL: Google API quota exceeded or key invalid');
    } else if (error.response?.status === 429) {
      this.sendAlert('WARNING: Google API rate limit reached');
    }
  }
}
```

## Cost Management and Optimization

### **💰 Cost Optimization (Free Tier)**
- **Caching Strategy**: 24-hour cache minimum for repeated URLs
- **Batch Analysis**: Analyze multiple metrics in single request
- **Smart Scheduling**: Distribute requests throughout the day
- **Selective Analysis**: Only analyze when needed, not on every page visit

### **📈 Usage Projections**
```
Daily Usage Examples:
- Small Project: 10-50 requests/day (0.2% of quota)
- Medium Project: 100-500 requests/day (2% of quota)
- Large Enterprise: 1000-5000 requests/day (20% of quota)
- Maximum Usage: 25,000 requests/day (100% of free quota)

Realistic Capacity:
- Single Website Analysis: 1-5 requests
- Competitive Analysis (10 sites): 10-50 requests
- Continuous Monitoring: 100-1000 requests/day
- Enterprise Dashboard: 1000+ requests/day
```

## Alternative and Backup Strategies

### **🔄 Fallback Implementation**
Our SEO tools are designed with **graceful degradation**:

1. **Primary**: Google PageSpeed Insights API (professional results)
2. **Fallback**: Browser-based analysis (functional results)
3. **Offline**: Cached previous results (historical data)

### **🎯 Browser-Only Mode**
Even without Google API, our tools provide:
- ✅ **Core Web Vitals**: Browser API measurement
- ✅ **Performance Analysis**: Navigation and Resource Timing APIs
- ✅ **SEO Basics**: Meta tag analysis, content optimization
- ✅ **Issue Detection**: Performance problem identification
- ✅ **Benchmarking**: Industry comparison using built-in data

## Conclusion

### **🚀 Implementation Benefits**
- **Professional Analysis**: Google-powered SEO intelligence
- **Free Integration**: No additional costs for comprehensive analysis
- **Competitive Advantage**: Only MCP platform with Google API integration
- **Enterprise Ready**: Production-grade API management and monitoring

### **✅ Setup Checklist**
- [ ] Google Cloud Console account created
- [ ] Project created/selected
- [ ] PageSpeed Insights API enabled
- [ ] API key generated and copied
- [ ] API key restrictions configured
- [ ] Environment variables configured
- [ ] API key validated with test request
- [ ] Rate limiting and caching implemented
- [ ] Production monitoring configured

### **🎯 Next Steps**
1. **Obtain API Key**: Follow this guide to get your Google API key
2. **Configure Environment**: Set up environment variables
3. **Test Integration**: Validate API key with test requests
4. **Enable SEO Tools**: Activate professional SEO analysis capabilities

**With Google API integration, our MCP Browser Control Server becomes the most powerful website analysis platform in the entire MCP ecosystem!** 🎯✨

---

**Contact**: dimitrymd@gmail.com | Funway Interactive SRL | funwayinteractive.com
**API Documentation**: https://developers.google.com/speed/docs/insights/v5/get-started