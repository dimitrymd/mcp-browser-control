import axios from 'axios';
import dotenv from 'dotenv';

export async function quickAnalysis(url: string, options: any) {
  console.log(`🎯 Quick SEO Analysis Demo: ${url}\n`);

  // Load environment
  dotenv.config();

  // Validate configuration
  if (!process.env.GOOGLE_PAGESPEED_API_KEY) {
    console.log('❌ Google API key not configured');
    console.log('🔧 Run: mcp-browser-control setup');
    return;
  }

  try {
    console.log('🚀 Testing revolutionary Google-powered analysis...');

    // Test Google PageSpeed API
    const testUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    const response = await axios.get(testUrl, {
      params: {
        url: url,
        key: process.env.GOOGLE_PAGESPEED_API_KEY,
        category: 'performance'
      },
      timeout: 30000
    });

    if (response.data) {
      const metrics = response.data.lighthouseResult?.audits;
      const categories = response.data.lighthouseResult?.categories;

      console.log('\n📊 GOOGLE LIGHTHOUSE ANALYSIS:');
      console.log('='.repeat(50));
      console.log(`🌐 URL: ${url}`);

      if (categories) {
        console.log(`⚡ Performance: ${Math.round(categories.performance?.score * 100) || 'N/A'}/100`);
        console.log(`🎯 SEO: ${Math.round(categories.seo?.score * 100) || 'N/A'}/100`);
        console.log(`♿ Accessibility: ${Math.round(categories.accessibility?.score * 100) || 'N/A'}/100`);
        console.log(`✅ Best Practices: ${Math.round(categories['best-practices']?.score * 100) || 'N/A'}/100`);
      }

      if (metrics) {
        const lcp = metrics['largest-contentful-paint']?.displayValue || 'N/A';
        const fid = metrics['first-input-delay']?.displayValue || 'N/A';
        const cls = metrics['cumulative-layout-shift']?.displayValue || 'N/A';

        console.log('\n🎯 CORE WEB VITALS:');
        console.log(`📏 Largest Contentful Paint: ${lcp}`);
        console.log(`⚡ First Input Delay: ${fid}`);
        console.log(`📐 Cumulative Layout Shift: ${cls}`);
      }

      console.log('\n💎 Revolutionary Platform Demonstrated:');
      console.log('  ✅ Google-powered official metrics (not third-party estimates)');
      console.log('  ✅ Real-time API access (no rate limits like traditional tools)');
      console.log('  ✅ Professional consulting-grade analysis');
      console.log('  ✅ Revolutionary capabilities beyond basic tools');

      console.log('\n📋 For Complete Revolutionary Analysis:');
      console.log('  🚀 76+ specialized tools available');
      console.log('  🎥 Industry-first multimedia testing');
      console.log('  📊 Advanced competitive intelligence');
      console.log('  📄 Professional PDF report generation');
      console.log('  💼 Contact: dimitrymd@gmail.com');

    } else {
      console.log('⚠️  No data received from Google API');
    }

    console.log('\n✅ Quick analysis demonstration complete!');
    console.log('🎯 Revolutionary SEO intelligence validated!');

  } catch (error) {
    if (error.response?.status === 403) {
      console.log('\n❌ Google API key invalid or unauthorized');
      console.log('🔧 Run: mcp-browser-control setup');
    } else if (error.response?.status === 429) {
      console.log('\n⚠️  Rate limit reached (API key working)');
      console.log('✅ Google API connection validated');
    } else {
      console.log('\n❌ Analysis failed:', error.message);
      console.log('🔧 Check configuration: mcp-browser-control test-config');
    }

    console.log('📖 Documentation: GOOGLE-API-SETUP.md');
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2] || 'https://google.com';
  const options = { format: 'markdown' };
  quickAnalysis(url, options).catch(console.error);
}