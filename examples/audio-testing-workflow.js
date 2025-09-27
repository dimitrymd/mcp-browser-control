#!/usr/bin/env node

/**
 * Complete Audio Testing Workflow Example
 * Demonstrates the revolutionary audio testing capabilities
 *
 * NOTE: This is a conceptual example showing MCP tool usage patterns.
 * To actually run this workflow, you need to:
 * 1. Connect to the MCP server using an MCP client (e.g., Claude Desktop)
 * 2. Use the MCP protocol to call these tools
 * 3. See the GUIDE.md for proper setup instructions
 */

// This is a conceptual class showing how the workflow would be structured
// In reality, you would call these tools through MCP protocol messages
class AudioTestingWorkflow {
  constructor() {
    // No direct client needed - tools are called via MCP protocol
    console.log('Audio Testing Workflow initialized');
  }

  async runCompleteAudioTest() {
    console.log('🎵 Starting Complete Audio Testing Workflow...\n');

    // NOTE: 'mcpClient' represents your MCP client connection
    // In practice, this would be your configured MCP client instance
    const mcpClient = this; // Placeholder for actual MCP client

    try {
      // 1. Create browser session
      console.log('📱 Creating browser session...');
      // MCP Tool Call: create_session
      const sessionResult = await mcpClient.callTool('create_session', {
        browserType: 'chrome',
        headless: false, // Visual mode for demonstration
        windowSize: { width: 1920, height: 1080 }
      });

      const sessionId = sessionResult.data.sessionId;
      console.log(`✅ Session created: ${sessionId}\n`);

      // 2. Navigate to audio test page
      console.log('🌐 Navigating to audio test page...');
      await mcpClient.callTool('navigate_to', {
        url: 'file:///Users/dimitrymd/Documents/prj/MCPBroControl/test-fixtures/pages/audio-test.html',
        sessionId
      });
      console.log('✅ Navigation complete\n');

      // 3. Discover all audio elements
      console.log('🔍 Discovering audio elements...');
      const elementsResult = await mcpClient.callTool('get_audio_elements', {
        includeIframes: true,
        onlyWithSource: true,
        sessionId
      });

      console.log(`✅ Found ${elementsResult.data.total} audio elements:`);
      elementsResult.data.elements.forEach(element => {
        console.log(`   🎵 ${element.tagName}: ${element.selector}`);
        console.log(`      Source: ${element.sources[0]?.src || 'No source'}`);
        console.log(`      Controls: ${element.controls ? 'Yes' : 'No'}`);
        console.log(`      Autoplay: ${element.autoplay ? 'Yes' : 'No'}`);
      });
      console.log('');

      // 4. Test audio playback detection (Revolutionary Feature)
      console.log('🎯 Testing real audio playback detection...');

      // Check initial state (should be paused)
      const initialState = await mcpClient.callTool('check_audio_playing', {
        selector: '#audio1',
        checkInterval: 100,
        sampleDuration: 1000,
        sessionId
      });

      console.log(`📊 Initial state: ${initialState.data.isPlaying ? 'Playing' : 'Paused'}`);
      console.log(`   Active elements: ${initialState.data.activeCount}`);
      console.log(`   Current time: ${initialState.data.elements[0].currentTime}s`);

      // 5. Start audio playback with professional controls
      console.log('\n▶️  Starting audio playback with fade in...');
      await mcpClient.callTool('control_audio_playback', {
        selector: '#audio1',
        action: 'play',
        volume: 0.8,
        fadeIn: 2000, // 2-second fade in
        sessionId
      });

      // Wait for playback to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 6. Monitor real playback detection
      console.log('🔍 Monitoring real audio playback...');
      const playingState = await mcpClient.callTool('check_audio_playing', {
        selector: '#audio1',
        checkInterval: 100,
        sampleDuration: 2000, // 2-second sampling
        sessionId
      });

      console.log(`📊 Playback detected: ${playingState.data.isPlaying ? '✅ YES' : '❌ NO'}`);
      console.log(`   Current time: ${playingState.data.elements[0].currentTime}s`);
      console.log(`   Duration: ${playingState.data.elements[0].duration}s`);
      console.log(`   Volume: ${playingState.data.elements[0].volume}`);
      console.log(`   Playback rate: ${playingState.data.elements[0].playbackRate}x`);

      // 7. Monitor audio events in real-time
      console.log('\n📡 Starting real-time audio event monitoring...');
      const eventsPromise = mcpClient.callTool('monitor_audio_events', {
        selector: '#audio1',
        duration: 5000,
        events: ['play', 'pause', 'timeupdate', 'ended', 'stalled', 'waiting'],
        includeTimeUpdates: true,
        throttle: 500,
        sessionId
      });

      // 8. Test advanced audio controls during monitoring
      setTimeout(async () => {
        console.log('🎛️  Testing advanced audio controls...');

        // Test volume control
        await mcpClient.callTool('control_audio_playback', {
          selector: '#audio1',
          action: 'play',
          volume: 0.5,
          sessionId
        });

        // Test seeking
        setTimeout(async () => {
          await mcpClient.callTool('control_audio_playback', {
            selector: '#audio1',
            action: 'play',
            seekTo: 10.0,
            sessionId
          });
        }, 1500);

        // Test playback rate
        setTimeout(async () => {
          await mcpClient.callTool('control_audio_playback', {
            selector: '#audio1',
            action: 'play',
            playbackRate: 1.5,
            sessionId
          });
        }, 3000);

      }, 1000);

      // Wait for event monitoring to complete
      const eventsResult = await eventsPromise;

      console.log(`\n📊 Audio events captured: ${eventsResult.data.events.length}`);
      console.log(`   Play count: ${eventsResult.data.summary.playCount}`);
      console.log(`   Pause count: ${eventsResult.data.summary.pauseCount}`);
      console.log(`   Total play time: ${eventsResult.data.summary.totalPlayTime}s`);
      console.log(`   Buffering events: ${eventsResult.data.summary.bufferingEvents}`);

      // 9. Analyze audio performance
      console.log('\n⚡ Analyzing audio performance...');
      const performanceResult = await mcpClient.callTool('analyze_audio_performance', {
        selector: '#audio1',
        duration: 3000,
        metrics: ['bufferingTime', 'stutterEvents', 'bufferRatio'],
        sessionId
      });

      console.log('📈 Performance Analysis:');
      console.log(`   Buffering time: ${performanceResult.data.performance.bufferingTime}ms`);
      console.log(`   Stutter events: ${performanceResult.data.performance.stutterEvents}`);
      console.log(`   Buffer ratio: ${performanceResult.data.performance.bufferRatio.toFixed(2)}`);
      console.log(`   Timeline samples: ${performanceResult.data.timeline.length}`);

      // 10. Detect audio issues
      console.log('\n🔍 Detecting audio issues...');
      const issuesResult = await mcpClient.callTool('detect_audio_issues', {
        selector: '#audio1',
        checkDuration: 2000,
        sessionId
      });

      console.log(`📋 Issues found: ${issuesResult.data.hasIssues ? 'YES' : 'NO'}`);
      issuesResult.data.issues.forEach(issue => {
        console.log(`   ⚠️  ${issue.type} (${issue.severity}): ${issue.description}`);
      });

      console.log('\n💡 Recommendations:');
      issuesResult.data.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });

      // 11. Test fade out and stop
      console.log('\n⏹️  Stopping audio with fade out...');
      await mcpClient.callTool('control_audio_playback', {
        selector: '#audio1',
        action: 'pause',
        fadeOut: 1500, // 1.5-second fade out
        sessionId
      });

      // 12. Final state check
      setTimeout(async () => {
        const finalState = await mcpClient.callTool('check_audio_playing', {
          selector: '#audio1',
          sampleDuration: 1000,
          sessionId
        });

        console.log(`\n📊 Final state: ${finalState.data.isPlaying ? 'Playing' : 'Stopped'}`);
        console.log(`   Final time: ${finalState.data.elements[0].currentTime}s`);

        // 13. Take screenshot for documentation
        await mcpClient.callTool('take_screenshot', {
          fullPage: true,
          format: 'png',
          sessionId
        });

        console.log('\n🎉 Audio testing workflow completed successfully!');
        console.log('📸 Screenshot captured for documentation');

        // Cleanup
        await mcpClient.callTool('close_session', { sessionId });
        console.log('🧹 Session cleaned up');

      }, 2000);

    } catch (error) {
      console.error('❌ Audio testing workflow failed:', error);
      throw error;
    }
  }

  async runQuickAudioTest() {
    console.log('⚡ Quick Audio Test - Real Playback Detection\n');

    // NOTE: 'mcpClient' represents your MCP client connection
    const mcpClient = this; // Placeholder for actual MCP client

    try {
      const sessionResult = await mcpClient.callTool('create_session', {
        browserType: 'chrome',
        headless: true
      });
      const sessionId = sessionResult.data.sessionId;

      // Navigate to test page
      await mcpClient.callTool('navigate_to', {
        url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
        sessionId
      });

      // Wait for audio to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if audio is actually playing (revolutionary detection)
      const playbackResult = await mcpClient.callTool('check_audio_playing', {
        checkInterval: 50,
        sampleDuration: 1500,
        sessionId
      });

      console.log('🎯 Real Playback Detection Results:');
      console.log(`   Is Playing: ${playbackResult.data.isPlaying ? '✅ YES' : '❌ NO'}`);
      console.log(`   Elements: ${playbackResult.data.elements.length}`);

      if (playbackResult.data.elements.length > 0) {
        const element = playbackResult.data.elements[0];
        console.log(`   Current Time: ${element.currentTime}s`);
        console.log(`   Duration: ${element.duration}s`);
        console.log(`   Paused: ${element.paused}`);
        console.log(`   Muted: ${element.muted}`);
        console.log(`   Volume: ${element.volume}`);
        console.log(`   Ready State: ${element.readyState}`);
      }

      await mcpClient.callTool('close_session', { sessionId });

      console.log('\n✅ Quick audio test completed!');

    } catch (error) {
      console.error('❌ Quick audio test failed:', error);
    }
  }
}

// Example usage
async function main() {
  const audioTester = new AudioTestingWorkflow();

  console.log('🎵 MCP Browser Control Server - Audio Testing Examples\n');
  console.log('Choose test to run:');
  console.log('1. Complete Audio Testing Workflow (comprehensive)');
  console.log('2. Quick Audio Test (basic validation)\n');

  // For demo purposes, run complete workflow
  await audioTester.runCompleteAudioTest();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default AudioTestingWorkflow;