#!/usr/bin/env node

import { spawn } from 'child_process';

// MCP client for visible browser testing
class VisibleBrowserClient {
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testVisibleBrowser() {
  console.log('🚀 Testing MCP Browser Control with VISIBLE BROWSER\n');
  console.log('👀 Watch as the browser window opens and navigates automatically!\n');

  const client = new VisibleBrowserClient();

  try {
    // Wait for server to start
    await sleep(3000);

    console.log('1️⃣ Creating visible browser session...');
    const sessionResponse = await client.sendRequest('tools/call', {
      name: 'create_session',
      arguments: {
        browserType: 'chrome',
        headless: false,  // 🎯 This makes the browser VISIBLE!
        windowSize: { width: 1400, height: 1000 }
      }
    });

    const sessionResult = JSON.parse(sessionResponse.result.content[0].text);
    const sessionId = sessionResult.data.sessionId;
    console.log(`✅ Visible browser session created: ${sessionId}`);
    console.log('👀 You should see a Chrome window opening now!\n');

    await sleep(2000); // Give user time to see the browser open

    console.log('2️⃣ Navigating to funwayinteractive.com...');
    console.log('👀 Watch the browser navigate to your website!');

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
    console.log(`✅ Navigation completed - watch the page load!`);
    console.log(`   URL: ${navResult.data.url}`);
    console.log(`   Title: ${navResult.data.title}\n`);

    await sleep(3000); // Let user see the loaded page

    console.log('3️⃣ Demonstrating interactions...');
    console.log('👀 Watch the browser scroll and interact with elements!');

    // Scroll to demonstrate visual interaction
    await client.sendRequest('tools/call', {
      name: 'execute_javascript',
      arguments: {
        script: 'window.scrollTo({top: 500, behavior: "smooth"});',
        sessionId: sessionId
      }
    });
    console.log('✅ Scrolled down smoothly');

    await sleep(2000);

    await client.sendRequest('tools/call', {
      name: 'execute_javascript',
      arguments: {
        script: 'window.scrollTo({top: 1000, behavior: "smooth"});',
        sessionId: sessionId
      }
    });
    console.log('✅ Scrolled further down');

    await sleep(2000);

    await client.sendRequest('tools/call', {
      name: 'execute_javascript',
      arguments: {
        script: 'window.scrollTo({top: 0, behavior: "smooth"});',
        sessionId: sessionId
      }
    });
    console.log('✅ Scrolled back to top');

    await sleep(2000);

    console.log('\n4️⃣ Extracting content while you watch...');
    const textResponse = await client.sendRequest('tools/call', {
      name: 'get_page_content',
      arguments: {
        format: 'text',
        sessionId: sessionId,
        includeHidden: false
      }
    });

    const textResult = JSON.parse(textResponse.result.content[0].text);
    console.log(`✅ Extracted ${textResult.data.metadata.length} characters of content\n`);

    console.log('5️⃣ Highlighting elements...');
    console.log('👀 Watch elements get highlighted!');

    // Highlight different sections visually
    await client.sendRequest('tools/call', {
      name: 'execute_javascript',
      arguments: {
        script: `
          // Add some visual flair
          const style = document.createElement('style');
          style.textContent = \`
            .mcp-highlight {
              border: 3px solid #ff6b6b !important;
              box-shadow: 0 0 20px rgba(255, 107, 107, 0.5) !important;
              transition: all 0.5s ease !important;
            }
          \`;
          document.head.appendChild(style);

          // Highlight elements one by one
          const elements = document.querySelectorAll('h1, h2, h3');
          elements.forEach((el, i) => {
            setTimeout(() => {
              el.classList.add('mcp-highlight');
              setTimeout(() => el.classList.remove('mcp-highlight'), 1000);
            }, i * 500);
          });
        `,
        sessionId: sessionId
      }
    });
    console.log('✅ Elements highlighted with animation');

    await sleep(5000); // Let animations complete

    console.log('\n6️⃣ Taking a screenshot...');
    const screenshotResponse = await client.sendRequest('tools/call', {
      name: 'take_screenshot',
      arguments: {
        fullPage: true,
        format: 'png',
        sessionId: sessionId
      }
    });

    const screenshotResult = JSON.parse(screenshotResponse.result.content[0].text);
    console.log(`✅ Screenshot captured: ${screenshotResult.data.dimensions.width}x${screenshotResult.data.dimensions.height}`);

    console.log('\n7️⃣ Testing navigation...');
    console.log('👀 Watch the browser navigate to different sites!');

    // Navigate to a few different sites to show the browser in action
    await client.sendRequest('tools/call', {
      name: 'navigate_to',
      arguments: {
        url: 'https://example.com',
        sessionId: sessionId,
        waitUntil: 'load'
      }
    });
    console.log('✅ Navigated to example.com');

    await sleep(2000);

    // Navigate back to the original site
    await client.sendRequest('tools/call', {
      name: 'navigate_to',
      arguments: {
        url: 'https://funwayinteractive.com',
        sessionId: sessionId,
        waitUntil: 'load'
      }
    });
    console.log('✅ Navigated back to funwayinteractive.com');

    await sleep(3000);

    console.log('\n🎉 Demo complete! The browser will close in 5 seconds...');
    console.log('👀 Watch the browser close automatically!\n');

    await sleep(5000);

    console.log('8️⃣ Closing visible browser session...');
    await client.sendRequest('tools/call', {
      name: 'close_session',
      arguments: { sessionId: sessionId }
    });
    console.log('✅ Visible browser session closed');

    console.log('\n🎉 Visible Browser Test completed successfully!');
    console.log('🚀 The MCP Browser Control server can run browsers both visible and headless!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    client.close();
  }
}

testVisibleBrowser();