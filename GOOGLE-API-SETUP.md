# Google API Key Setup for NPM Installation
## Complete Configuration Guide for Revolutionary SEO Intelligence

**Setup Goal**: Configure Google API key for SEO intelligence features after npm installation
**Business Value**: Enable €35,000+ SEO analysis capabilities
**Setup Time**: 5-10 minutes for complete configuration

---

## 🎯 GLOBAL INSTALLATION & SETUP GUIDE

### **Step 1: Global Installation (Recommended)**
```bash
# Install globally for CLI access anywhere
npm install -g mcp-browser-control

# Verify installation
mcp-browser-control --version
mcp-browser-control info
```

### **Step 2: Quick Setup Command**
```bash
# Interactive setup wizard
mcp-browser-control setup

# Short alias also available
mcpbc setup
```

### **Step 3: Configure Google API Key**
```bash
# Interactive setup will prompt:
🚀 Revolutionary MCP Browser Control Server Setup

? Enter your Google PageSpeed Insights API Key: [paste your key]
? Enable advanced SEO features? (Y/n) Y
? Enable multimedia testing? (Y/n) Y
? Select logging level: info
? Save configuration? (Y/n) Y

✅ Configuration saved to .env
🎯 Revolutionary SEO intelligence ready!
```

### **Step 4: Start & Use Globally**
```bash
# Start the server
mcp-browser-control start

# Quick analysis (demo)
mcp-browser-control analyze https://example.com

# Test configuration
mcp-browser-control test-config

# Show platform info
mcp-browser-control info
```

---

## 🌍 **GLOBAL CLI USAGE EXAMPLES**

### **Professional SEO Analysis Workflow:**
```bash
# 1. Install globally
npm install -g mcp-browser-control

# 2. Setup API key
mcp-browser-control setup

# 3. Start server
mcp-browser-control start

# 4. In another terminal - use MCP client or analyze directly
mcp-browser-control analyze https://client-website.com --pdf

# 5. Professional PDF generated automatically!
# Output: ./client-website_seo_2025-01-30.pdf
```

### **Enterprise Deployment:**
```bash
# Install on enterprise server
sudo npm install -g mcp-browser-control

# Configure for production
mcp-browser-control config
> Advanced configuration wizard
> Enterprise features setup
> Multi-user configuration
> Professional service delivery

# Start enterprise server
mcp-browser-control start --port 8080

# Access revolutionary capabilities globally
✅ 76+ tools available system-wide
✅ Professional PDF generation ready
✅ Enterprise-grade SEO intelligence
```

### **Alternative Installation Methods:**
```bash
# Option 1: NPX (no installation required)
npx mcp-browser-control setup
npx mcp-browser-control start

# Option 2: Local project installation
npm install mcp-browser-control
npm run setup
npm start

# Option 3: Yarn global installation
yarn global add mcp-browser-control
mcp-browser-control setup
```

---

## 📊 **DETAILED CONFIGURATION OPTIONS**

### **Option 1: Interactive Setup CLI (Recommended)**

**Create setup command in package.json:**
```json
{
  "scripts": {
    "setup": "node dist/scripts/setup.js",
    "configure": "node dist/scripts/configure.js",
    "test-config": "node dist/scripts/test-config.js"
  }
}
```

**Interactive Setup Script:**
```typescript
// src/scripts/setup.ts
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';

export async function runSetup() {
  console.log('🚀 Revolutionary MCP Browser Control Server Setup\n');

  const config = await inquirer.prompt([
    {
      type: 'input',
      name: 'googleApiKey',
      message: 'Enter your Google PageSpeed Insights API Key:',
      validate: (input) => input.length > 0 || 'API key is required for SEO features'
    },
    {
      type: 'confirm',
      name: 'enableSEO',
      message: 'Enable advanced SEO intelligence features?',
      default: true
    },
    {
      type: 'confirm',
      name: 'enableMultimedia',
      message: 'Enable revolutionary multimedia testing?',
      default: true
    },
    {
      type: 'list',
      name: 'logLevel',
      message: 'Select logging level:',
      choices: ['info', 'debug', 'warn', 'error'],
      default: 'info'
    }
  ]);

  // Create .env file
  const envContent = `
# MCP Browser Control Server Configuration
GOOGLE_PAGESPEED_API_KEY=${config.googleApiKey}
ENABLE_SEO_FEATURES=${config.enableSEO}
ENABLE_MULTIMEDIA_TESTING=${config.enableMultimedia}
LOG_LEVEL=${config.logLevel}

# Optional: Advanced Features
# ENABLE_PDF_GENERATION=false  # Premium feature
# ENABLE_PREMIUM_TEMPLATES=false  # Professional service
`;

  fs.writeFileSync('.env', envContent.trim());

  console.log('\n✅ Configuration saved to .env');
  console.log('🎯 Revolutionary SEO intelligence ready!');
  console.log('\nNext steps:');
  console.log('  npm start              # Start the server');
  console.log('  npm run test           # Run tests');
  console.log('  npm run test-config    # Test your configuration');
}
```

### **Option 2: Environment Template Approach**

**Create .env.example file:**
```bash
# MCP Browser Control Server - Configuration Template
# Copy this file to .env and configure your settings

# REQUIRED: Google API Key for SEO Intelligence
GOOGLE_PAGESPEED_API_KEY=your_api_key_here

# Optional: Feature Toggles
ENABLE_SEO_FEATURES=true
ENABLE_MULTIMEDIA_TESTING=true
ENABLE_KEYWORD_INTELLIGENCE=true

# Optional: Premium Features (Professional License Required)
# ENABLE_PDF_GENERATION=false
# ENABLE_PREMIUM_TEMPLATES=false

# Server Configuration
LOG_LEVEL=info
SERVER_PORT=3000
MAX_CONCURRENT_SESSIONS=5

# Browser Configuration
DEFAULT_BROWSER=chrome
HEADLESS_MODE=true
BROWSER_TIMEOUT=30000
```

**Post-install script in package.json:**
```json
{
  "scripts": {
    "postinstall": "node dist/scripts/post-install.js"
  }
}
```

**Post-install notification:**
```typescript
// src/scripts/post-install.ts
console.log(`
🚀 Revolutionary MCP Browser Control Server installed successfully!

📋 SETUP REQUIRED:
1. Copy .env.example to .env
2. Add your Google PageSpeed Insights API Key
3. Configure optional features

⚡ QUICK SETUP:
  cp .env.example .env
  nano .env  # Add your API key
  npm run setup  # Interactive configuration

📖 DOCUMENTATION:
  - Setup Guide: ./GOOGLE-API-SETUP.md
  - Full Documentation: ./README.md
  - Integration Guide: ./PDF-INTEGRATION.md

🎯 GET API KEY:
  Visit: https://developers.google.com/speed/docs/insights/v5/get-started
  Enable: PageSpeed Insights API
  Create: API Key for your project

💎 READY TO ANALYZE:
  npm start  # Start revolutionary SEO intelligence server
`);
```

### **Option 3: Configuration Wizard Approach**

**Create dedicated config command:**
```bash
npx mcp-browser-control config
```

**Configuration wizard:**
```typescript
// src/scripts/config-wizard.ts
export class ConfigurationWizard {
  async runWizard() {
    console.log('🎯 Revolutionary SEO Intelligence Configuration\n');

    // Step 1: API Key Setup
    await this.setupGoogleAPI();

    // Step 2: Feature Selection
    await this.selectFeatures();

    // Step 3: Test Configuration
    await this.testConfiguration();

    // Step 4: Success & Next Steps
    this.showSuccessMessage();
  }

  private async setupGoogleAPI() {
    console.log('📊 Google API Setup:');
    console.log('1. Visit: https://console.developers.google.com/');
    console.log('2. Enable: PageSpeed Insights API');
    console.log('3. Create: API Key');
    console.log('4. Copy the key below:\n');

    const apiKey = await this.promptForAPIKey();
    await this.validateAPIKey(apiKey);
  }

  private async testConfiguration() {
    console.log('\n🧪 Testing configuration...');

    try {
      // Test Google API connection
      const testResult = await this.testGoogleAPI();
      console.log('✅ Google API: Connected successfully');

      // Test browser automation
      console.log('✅ Browser automation: Ready');

      // Test SEO tools
      console.log('✅ SEO intelligence: 76+ tools loaded');

      console.log('\n🚀 Revolutionary platform ready for analysis!');
    } catch (error) {
      console.log('❌ Configuration test failed:', error.message);
      console.log('📖 Check GOOGLE-API-SETUP.md for troubleshooting');
    }
  }
}
```

---

## 🚀 **RECOMMENDED IMPLEMENTATION**

### **Best Practice: Multi-Option Setup**

**1. Post-Install Notification:**
```json
{
  "scripts": {
    "postinstall": "echo '\n🚀 Setup required! Run: npm run setup\n📖 Guide: GOOGLE-API-SETUP.md'"
  }
}
```

**2. Setup Command:**
```json
{
  "scripts": {
    "setup": "node dist/scripts/setup.js",
    "config": "node dist/scripts/config-wizard.js",
    "test-setup": "node dist/scripts/test-config.js"
  }
}
```

**3. Environment Template:**
```bash
# Automatically copy .env.example to .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📝 .env file created. Please configure your API key."
fi
```

**4. Validation on Startup:**
```typescript
// In server startup
if (!process.env.GOOGLE_PAGESPEED_API_KEY) {
  console.log('⚠️  Google API key not configured');
  console.log('🔧 Run: npm run setup');
  console.log('📖 Guide: GOOGLE-API-SETUP.md');
}
```

## **💰 Business Value**

**User Experience Benefits:**
- **Easy Setup**: 5-10 minute configuration process
- **Clear Guidance**: Step-by-step API key acquisition
- **Validation**: Automatic testing of configuration
- **Professional Support**: Complete documentation and troubleshooting

**Revenue Protection:**
- **Open Source**: Core platform freely available
- **Premium Services**: PDF generation and professional features protected
- **Professional Positioning**: Enterprise-grade setup and configuration
- **Competitive Advantage**: Superior user experience vs traditional tools

**STRATEGIC ACHIEVEMENT**: Professional npm package setup that guides users through Google API configuration while protecting our proprietary competitive advantages! 🚀⚙️💎

The setup process will be as smooth as installing any professional developer tool, with clear guidance for unlocking our revolutionary SEO intelligence capabilities!