#!/usr/bin/env node

import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

class MCPClient {
  constructor(serverPath) {
    this.serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'inherit']
    });
    this.messageId = 0;
    this.pendingRequests = new Map();

    this.serverProcess.stdout.on('data', (data) => {
      this.handleServerMessage(data.toString());
    });

    this.serverProcess.on('error', (error) => {
      console.error('Server process error:', error);
    });
  }

  handleServerMessage(data) {
    try {
      const lines = data.trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          const message = JSON.parse(line);
          if (message.id && this.pendingRequests.has(message.id)) {
            const resolve = this.pendingRequests.get(message.id);
            this.pendingRequests.delete(message.id);
            resolve(message);
          }
        }
      }
    } catch (error) {
      console.error('Error parsing server message:', error, 'Data:', data);
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

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async listTools() {
    return await this.sendRequest('tools/list');
  }

  async callTool(name, args) {
    return await this.sendRequest('tools/call', { name, arguments: args });
  }

  close() {
    this.serverProcess.kill();
  }
}

async function testWebsiteExtraction() {
  console.log('🚀 Testing MCP Browser Control Server with funwayinteractive.com');

  const client = new MCPClient('./dist/server.js');

  try {
    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📋 Listing available tools...');
    const toolsResponse = await client.listTools();
    console.log(`✅ Found ${toolsResponse.result?.tools?.length || 0} tools available`);

    console.log('\n🖥️  Creating browser session...');
    const sessionResponse = await client.callTool('create_session', {
      browserType: 'chrome',
      headless: true,
      windowSize: { width: 1920, height: 1080 }
    });

    const sessionResult = JSON.parse(sessionResponse.result.content[0].text);
    const sessionId = sessionResult.data.sessionId;
    console.log(`✅ Created session: ${sessionId}`);

    console.log('\n🌐 Navigating to funwayinteractive.com...');
    const navResponse = await client.callTool('navigate_to', {
      url: 'https://funwayinteractive.com',
      sessionId: sessionId,
      waitUntil: 'load',
      timeout: 15000
    });

    const navResult = JSON.parse(navResponse.result.content[0].text);
    console.log(`✅ Navigation completed: ${navResult.data.url}`);
    console.log(`📄 Page title: ${navResult.data.title}`);

    console.log('\n📝 Extracting page text content...');
    const textResponse = await client.callTool('get_page_content', {
      format: 'text',
      sessionId: sessionId,
      includeHidden: false
    });

    const textResult = JSON.parse(textResponse.result.content[0].text);
    console.log(`✅ Extracted ${textResult.data.metadata.length} characters of text`);
    console.log('\n📖 Website Text Content:');
    console.log('=' .repeat(80));
    console.log(textResult.data.content);
    console.log('=' .repeat(80));

    console.log('\n📸 Taking a screenshot...');
    const screenshotResponse = await client.callTool('take_screenshot', {
      fullPage: true,
      format: 'base64',
      sessionId: sessionId
    });

    const screenshotResult = JSON.parse(screenshotResponse.result.content[0].text);
    console.log(`✅ Screenshot captured: ${screenshotResult.data.dimensions.width}x${screenshotResult.data.dimensions.height}`);

    console.log('\n🔗 Extracting links...');
    const linksResponse = await client.callTool('extract_links', {
      internal: true,
      external: true,
      sessionId: sessionId
    });

    const linksResult = JSON.parse(linksResponse.result.content[0].text);
    console.log(`✅ Found ${linksResult.data.statistics.total} links (${linksResult.data.statistics.internal} internal, ${linksResult.data.statistics.external} external)`);

    console.log('\n📊 Session information...');
    const sessionInfoResponse = await client.callTool('get_session_info', {
      sessionId: sessionId
    });

    const sessionInfo = JSON.parse(sessionInfoResponse.result.content[0].text);
    console.log(`✅ Session active for ${Date.now() - sessionInfo.data.createdAt}ms`);

    console.log('\n🧹 Closing session...');
    await client.callTool('close_session', { sessionId: sessionId });
    console.log('✅ Session closed successfully');

    console.log('\n🎉 MCP Browser Control Server test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.close();
  }
}

// Run the test
testWebsiteExtraction().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});