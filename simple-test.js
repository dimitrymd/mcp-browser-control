#!/usr/bin/env node

import { spawn } from 'child_process';
import { EOL } from 'os';

// Simple MCP client to test the browser control server
class SimpleMCPClient {
  constructor() {
    // Disable server logs by setting LOG_LEVEL=error
    this.serverProcess = spawn('node', ['dist/server.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LOG_LEVEL: 'error' }
    });

    this.messageId = 0;
    this.responseBuffer = '';
    this.pendingRequests = new Map();

    this.serverProcess.stdout.on('data', (data) => {
      this.responseBuffer += data.toString();
      this.processBufferedResponses();
    });

    this.serverProcess.stderr.on('data', (data) => {
      // Ignore stderr (logs)
    });
  }

  processBufferedResponses() {
    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          if (response.id && this.pendingRequests.has(response.id)) {
            const resolve = this.pendingRequests.get(response.id);
            this.pendingRequests.delete(response.id);
            resolve(response);
          }
        } catch (error) {
          // Ignore parsing errors (likely log messages)
        }
      }
    }
  }

  async sendRequest(method, params = {}) {
    const id = ++this.messageId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, resolve);

      this.serverProcess.stdin.write(JSON.stringify(request) + '\n');

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  close() {
    this.serverProcess.kill();
  }
}

async function testFunwayInteractive() {
  console.log('🚀 Testing MCP Browser Control with funwayinteractive.com\n');

  const client = new SimpleMCPClient();

  try {
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('1️⃣ Creating browser session...');
    const sessionResponse = await client.sendRequest('tools/call', {
      name: 'create_session',
      arguments: {
        browserType: 'chrome',
        headless: true,
        windowSize: { width: 1920, height: 1080 }
      }
    });

    const sessionResult = JSON.parse(sessionResponse.result.content[0].text);
    const sessionId = sessionResult.data.sessionId;
    console.log(`✅ Session created: ${sessionId}\n`);

    console.log('2️⃣ Navigating to funwayinteractive.com...');
    const navResponse = await client.sendRequest('tools/call', {
      name: 'navigate_to',
      arguments: {
        url: 'https://funwayinteractive.com',
        sessionId: sessionId,
        waitUntil: 'load',
        timeout: 15000
      }
    });

    const navResult = JSON.parse(navResponse.result.content[0].text);
    console.log(`✅ Navigation completed`);
    console.log(`   URL: ${navResult.data.url}`);
    console.log(`   Title: ${navResult.data.title}`);
    console.log(`   Load time: ${navResult.data.loadTime}ms\n`);

    console.log('3️⃣ Extracting text content...');
    const textResponse = await client.sendRequest('tools/call', {
      name: 'get_page_content',
      arguments: {
        format: 'text',
        sessionId: sessionId,
        includeHidden: false
      }
    });

    const textResult = JSON.parse(textResponse.result.content[0].text);
    console.log(`✅ Text extracted: ${textResult.data.metadata.length} characters\n`);

    console.log('📖 WEBSITE CONTENT:');
    console.log('=' .repeat(80));
    console.log(textResult.data.content);
    console.log('=' .repeat(80));
    console.log();

    console.log('4️⃣ Taking screenshot...');
    const screenshotResponse = await client.sendRequest('tools/call', {
      name: 'take_screenshot',
      arguments: {
        fullPage: true,
        format: 'png',
        sessionId: sessionId
      }
    });

    const screenshotResult = JSON.parse(screenshotResponse.result.content[0].text);
    console.log(`✅ Screenshot captured: ${screenshotResult.data.dimensions.width}x${screenshotResult.data.dimensions.height}\n`);

    console.log('5️⃣ Extracting links...');
    const linksResponse = await client.sendRequest('tools/call', {
      name: 'extract_links',
      arguments: {
        internal: true,
        external: true,
        sessionId: sessionId
      }
    });

    const linksResult = JSON.parse(linksResponse.result.content[0].text);
    const stats = linksResult.data.statistics;
    console.log(`✅ Links found: ${stats.total} total (${stats.internal} internal, ${stats.external} external)\n`);

    if (linksResult.data.links.length > 0) {
      console.log('🔗 Sample links:');
      linksResult.data.links.slice(0, 5).forEach((link, i) => {
        console.log(`   ${i + 1}. ${link.text || '[No text]'} → ${link.href}`);
      });
      console.log();
    }

    console.log('6️⃣ Checking for media elements...');
    const mediaResponse = await client.sendRequest('tools/call', {
      name: 'extract_media_info',
      arguments: {
        mediaType: 'all',
        sessionId: sessionId
      }
    });

    const mediaResult = JSON.parse(mediaResponse.result.content[0].text);
    console.log(`✅ Media found: ${mediaResult.data.total} elements`);
    if (mediaResult.data.byType) {
      Object.entries(mediaResult.data.byType).forEach(([type, count]) => {
        if (count > 0) console.log(`   ${type}: ${count}`);
      });
    }
    console.log();

    console.log('7️⃣ Closing session...');
    await client.sendRequest('tools/call', {
      name: 'close_session',
      arguments: { sessionId: sessionId }
    });
    console.log('✅ Session closed\n');

    console.log('🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    client.close();
  }
}

testFunwayInteractive();