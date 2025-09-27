#!/usr/bin/env node

/**
 * Multi-Window Testing Example
 * Demonstrates advanced window management and coordination
 *
 * NOTE: This is a conceptual example showing MCP tool usage patterns.
 * To actually run this workflow, you need to:
 * 1. Connect to the MCP server using an MCP client (e.g., Claude Desktop)
 * 2. Use the MCP protocol to call these tools
 * 3. See the GUIDE.md for proper setup instructions
 */

class MultiWindowTestingExample {
  constructor() {
    console.log('Multi-Window Testing Example initialized');
  }

  async runMultiWindowWorkflow() {
    console.log('🪟 Multi-Window Testing Workflow - Enterprise Features\n');

    // NOTE: 'mcpClient' represents your MCP client connection
    const mcpClient = this; // Placeholder for actual MCP client

    try {
      // 1. Create main session
      const sessionResult = await mcpClient.callTool('create_session', {
        browserType: 'chrome',
        headless: false, // Visual mode for demonstration
        windowSize: { width: 1200, height: 800 }
      });
      const sessionId = sessionResult.data.sessionId;
      console.log(`✅ Main session created: ${sessionId}`);

      // 2. Navigate to starting page
      console.log('\n🌐 Navigating to starting page...');
      await mcpClient.callTool('navigate_to', {
        url: 'https://google.com',
        sessionId
      });

      // 3. Get initial window information
      const initialWindows = await mcpClient.callTool('get_windows', { sessionId });
      console.log(`📊 Initial windows: ${initialWindows.data.count}`);
      console.log(`   Current window: ${initialWindows.data.current}`);

      // 4. Open multiple windows for testing
      console.log('\n🆕 Opening additional windows...');

      // Window 1: Search page
      const window1 = await mcpClient.callTool('open_new_window', {
        url: 'https://duckduckgo.com',
        type: 'window',
        focus: false,
        position: { x: 100, y: 100 },
        size: { width: 800, height: 600 },
        sessionId
      });
      console.log(`   ✅ Search window: ${window1.data.handle}`);

      // Window 2: Documentation
      const window2 = await mcpClient.callTool('open_new_window', {
        url: 'https://developer.mozilla.org',
        type: 'window',
        focus: false,
        position: { x: 300, y: 150 },
        size: { width: 900, height: 700 },
        sessionId
      });
      console.log(`   ✅ Documentation window: ${window2.data.handle}`);

      // Window 3: Testing tools
      const window3 = await mcpClient.callTool('open_new_window', {
        url: 'https://httpbin.org',
        type: 'window',
        focus: false,
        position: { x: 500, y: 200 },
        size: { width: 1000, height: 800 },
        sessionId
      });
      console.log(`   ✅ Testing window: ${window3.data.handle}`);

      // 5. List all windows
      console.log('\n📋 Current window inventory:');
      const allWindows = await mcpClient.callTool('get_windows', { sessionId });

      allWindows.data.windows.forEach((window, index) => {
        const active = window.isActive ? '🎯 Active' : '  Inactive';
        console.log(`   ${index + 1}. ${active} - ${window.title}`);
        console.log(`      URL: ${window.url}`);
        console.log(`      Position: (${window.position?.x || 0}, ${window.position?.y || 0})`);
        console.log(`      Size: ${window.size?.width || 0}x${window.size?.height || 0}`);
        console.log(`      Handle: ${window.handle}`);
      });

      // 6. Test window arrangement - Cascade Layout
      console.log('\n🎨 Arranging windows in cascade layout...');
      await mcpClient.callTool('arrange_windows', {
        layout: 'cascade',
        sessionId
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 7. Test window arrangement - Tile Layout
      console.log('🎨 Arranging windows in tile layout...');
      await mcpClient.callTool('arrange_windows', {
        layout: 'tile',
        sessionId
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 8. Test custom window arrangement
      console.log('🎨 Applying custom window arrangement...');
      const customWindows = allWindows.data.windows;
      const customLayout = customWindows.map((window, index) => ({
        handle: window.handle,
        position: { x: index * 50, y: index * 50 },
        size: { width: 800, height: 600 }
      }));

      await mcpClient.callTool('arrange_windows', {
        layout: 'custom',
        customLayout,
        sessionId
      });

      // 9. Switch between windows and perform actions
      console.log('\n🔄 Testing window switching and interaction...');

      for (let i = 0; i < allWindows.data.windows.length; i++) {
        const window = allWindows.data.windows[i];

        console.log(`\n   Switching to window ${i + 1}: ${window.title}`);
        await mcpClient.callTool('switch_window', {
          target: window.handle,
          sessionId
        });

        // Get page title and URL
        const currentUrl = await mcpClient.callTool('get_current_url', { sessionId });
        console.log(`   📍 Current: ${currentUrl.data.title} - ${currentUrl.data.url}`);

        // Take a screenshot of each window
        await mcpClient.callTool('take_screenshot', {
          format: 'png',
          sessionId
        });
        console.log(`   📸 Screenshot captured`);

        // Extract some content
        const pageContent = await mcpClient.callTool('get_page_content', {
          format: 'text',
          selector: 'h1, title',
          sessionId
        });

        if (pageContent.data.content) {
          console.log(`   📄 Main heading: ${pageContent.data.content.substring(0, 50)}...`);
        }

        // Small delay between windows
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 10. Test window coordination with iframe navigation
      console.log('\n🖼️  Testing iframe coordination...');

      // Navigate to page with iframes
      await mcpClient.callTool('navigate_to', {
        url: 'https://www.w3schools.com/html/html_iframe.asp',
        sessionId
      });

      // Discover frames
      const framesResult = await mcpClient.callTool('get_frames', { sessionId });
      console.log(`   🔍 Found ${framesResult.data.count} iframes`);

      if (framesResult.data.frames.length > 0) {
        const frame = framesResult.data.frames[0];
        console.log(`   🎯 Testing frame: ${frame.selector}`);

        // Switch to frame
        await mcpClient.callTool('switch_to_frame', {
          target: frame.index,
          waitForLoad: true,
          sessionId
        });

        // Execute code in frame
        const frameResult = await mcpClient.callTool('execute_in_frame', {
          frame: frame.index,
          script: 'return document.title || "No title";',
          sessionId
        });

        console.log(`   📜 Frame content: ${frameResult.data.result}`);

        // Switch back to parent
        await mcpClient.callTool('switch_to_parent_frame', { sessionId });
      }

      // 11. Test performance across multiple windows
      console.log('\n⚡ Testing performance across windows...');

      for (const window of allWindows.data.windows.slice(0, 2)) {
        await mcpClient.callTool('switch_window', {
          target: window.handle,
          sessionId
        });

        const perfMetrics = await mcpClient.callTool('get_performance_metrics', { sessionId });

        console.log(`   📊 ${window.title} performance:`);
        console.log(`      Load time: ${perfMetrics.data.metrics.navigation.loadTime}ms`);
        console.log(`      Resources: ${perfMetrics.data.metrics.resources.count}`);
        console.log(`      Memory: ${Math.round(perfMetrics.data.metrics.memory?.usedJSHeapSize / 1024 / 1024 || 0)}MB`);
      }

      // 12. Close windows systematically
      console.log('\n🧹 Cleaning up windows...');

      // Close all but the main window
      const windowsToClose = allWindows.data.windows.slice(1); // Skip first window

      for (const window of windowsToClose) {
        await mcpClient.callTool('close_window', {
          handle: window.handle,
          force: false,
          sessionId
        });
        console.log(`   ✅ Closed: ${window.title}`);
      }

      // Final window status
      const finalWindows = await mcpClient.callTool('get_windows', { sessionId });
      console.log(`\n📊 Final windows: ${finalWindows.data.count}`);

      // 13. Take final screenshot
      await mcpClient.callTool('take_screenshot', {
        fullPage: true,
        format: 'png',
        sessionId
      });

      // Cleanup session
      await mcpClient.callTool('close_session', { sessionId });

      console.log('\n🎉 Multi-window testing workflow completed successfully!');
      console.log('🏢 This demonstrates enterprise-grade window management:');
      console.log('   • Multiple window creation and positioning');
      console.log('   • Professional layout algorithms (cascade, tile, custom)');
      console.log('   • Window switching and coordination');
      console.log('   • iframe navigation within windows');
      console.log('   • Performance monitoring across windows');
      console.log('   • Safe window cleanup and management');

    } catch (error) {
      console.error('❌ Multi-window testing failed:', error);
      throw error;
    }
  }

  async runQuickWindowTest() {
    console.log('⚡ Quick Window Test - Basic Operations\n');

    // NOTE: 'mcpClient' represents your MCP client connection
    const mcpClient = this; // Placeholder for actual MCP client

    try {
      const sessionResult = await mcpClient.callTool('create_session', {
        browserType: 'chrome',
        headless: true
      });
      const sessionId = sessionResult.data.sessionId;

      // Open a new tab
      await mcpClient.callTool('open_new_window', {
        url: 'https://example.com',
        type: 'tab',
        focus: true,
        sessionId
      });

      // List windows
      const windows = await mcpClient.callTool('get_windows', { sessionId });
      console.log(`✅ Total windows: ${windows.data.count}`);

      // Switch between windows
      await mcpClient.callTool('switch_window', {
        target: 0,
        sessionId
      });

      console.log('✅ Window switching successful');

      await mcpClient.callTool('close_session', { sessionId });

    } catch (error) {
      console.error('❌ Quick window test failed:', error);
    }
  }
}

// Example usage
async function main() {
  const windowTester = new MultiWindowTestingExample();

  console.log('🪟 MCP Browser Control Server - Multi-Window Examples\n');

  // Run complete workflow
  await windowTester.runMultiWindowWorkflow();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default MultiWindowTestingExample;