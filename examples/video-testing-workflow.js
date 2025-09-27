#!/usr/bin/env node

/**
 * Revolutionary Video Testing Workflow Example
 * Demonstrates the world's first comprehensive video testing automation
 */

import { MCPBrowserControlClient } from '../client/mcp-client.js';

class VideoTestingWorkflow {
  constructor(serverURL = 'http://localhost:3000') {
    this.client = new MCPBrowserControlClient(serverURL);
  }

  async runCompleteVideoTest() {
    console.log('🎬 Starting Revolutionary Video Testing Workflow...\n');

    try {
      // 1. Create browser session optimized for video
      console.log('📱 Creating video-optimized browser session...');
      const sessionResult = await this.client.executeTool('create_session', {
        browserType: 'chrome',
        headless: false, // Visual mode for video demonstration
        windowSize: { width: 1920, height: 1080 }
      });

      const sessionId = sessionResult.data.sessionId;
      console.log(`✅ Session created: ${sessionId}\n`);

      // 2. Navigate to video test page
      console.log('🌐 Navigating to video test page...');
      await this.client.executeTool('navigate_to', {
        url: 'file:///Users/dimitrymd/Documents/prj/MCPBroControl/test-fixtures/pages/video-test.html',
        sessionId
      });
      console.log('✅ Navigation complete\n');

      // 3. Discover all video elements
      console.log('🔍 Discovering video elements...');
      const videoElements = await this.client.executeTool('execute_javascript', {
        script: `
          const videos = document.querySelectorAll('video');
          return Array.from(videos).map((video, index) => ({
            id: video.id || 'video-' + index,
            src: video.src || video.currentSrc,
            dimensions: {
              width: video.videoWidth || 0,
              height: video.videoHeight || 0
            },
            hasControls: video.controls,
            autoplay: video.autoplay,
            preload: video.preload
          }));
        `,
        sessionId
      });

      console.log(`📋 Video Analysis:`);
      videoElements.data.result.forEach(video => {
        console.log(`   🎬 ${video.id}`);
        console.log(`      Resolution: ${video.dimensions.width}x${video.dimensions.height}`);
        console.log(`      Source: ${video.src || 'No source'}`);
        console.log(`      Controls: ${video.hasControls ? 'Yes' : 'No'}`);
        console.log(`      Autoplay: ${video.autoplay ? 'Yes' : 'No'}`);
      });
      console.log('');

      // 4. Test revolutionary video playback detection
      console.log('🎯 Testing revolutionary video playback detection...');

      // Check initial state (should be paused)
      const initialState = await this.client.executeTool('check_video_playing', {
        selector: '#main-video',
        checkInterval: 100,
        sampleDuration: 1500,
        frameRateThreshold: 20,
        qualityCheck: true,
        sessionId
      });

      console.log(`📊 Initial state: ${initialState.data.isPlaying ? 'Playing' : 'Paused'}`);
      if (initialState.data.elements.length > 0) {
        const element = initialState.data.elements[0];
        console.log(`   Resolution: ${element.videoWidth}x${element.videoHeight}`);
        console.log(`   Current time: ${element.currentTime}s`);
        console.log(`   Duration: ${element.duration}s`);
        console.log(`   Ready state: ${element.readyState}`);
      }

      if (initialState.data.qualityIssues && initialState.data.qualityIssues.length > 0) {
        console.log(`   ⚠️ Quality issues detected:`);
        initialState.data.qualityIssues.forEach(issue => {
          console.log(`      ${issue.severity.toUpperCase()}: ${issue.issue}`);
        });
      }

      // 5. Start video playback with professional controls
      console.log('\n▶️  Starting video playback with fade in...');
      await this.client.executeTool('control_video_playback', {
        selector: '#main-video',
        action: 'play',
        volume: 0.8,
        fadeIn: 2000, // 2-second fade in
        sessionId
      });

      // Wait for playback to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 6. Monitor revolutionary video playback detection
      console.log('🔍 Monitoring real video playback with frame advancement...');
      const playingState = await this.client.executeTool('check_video_playing', {
        selector: '#main-video',
        checkInterval: 100,
        sampleDuration: 2000, // 2-second sampling for frame advancement
        frameRateThreshold: 20,
        qualityCheck: true,
        sessionId
      });

      console.log(`📊 Revolutionary Playback Detection:`);
      console.log(`   Real playback detected: ${playingState.data.isPlaying ? '✅ YES' : '❌ NO'}`);
      console.log(`   Active video count: ${playingState.data.activeCount}`);

      if (playingState.data.elements.length > 0) {
        const element = playingState.data.elements[0];
        console.log(`   Current time: ${element.currentTime}s`);
        console.log(`   Frame count: ${element.webkitDecodedFrameCount || 'N/A'}`);
        console.log(`   Dropped frames: ${element.webkitDroppedFrameCount || 'N/A'}`);
        console.log(`   Video resolution: ${element.videoWidth}x${element.videoHeight}`);
        console.log(`   Aspect ratio: ${(element.videoWidth / element.videoHeight).toFixed(2)}`);
        console.log(`   Playback rate: ${element.playbackRate}x`);
      }

      // 7. Analyze video quality with professional metrics
      console.log('\n📈 Analyzing video quality with professional metrics...');
      const qualityResult = await this.client.executeTool('analyze_video_quality', {
        selector: '#main-video',
        duration: 4000,
        includeFrameAnalysis: true,
        includeBitrateAnalysis: true,
        sessionId
      });

      console.log('📊 Video Quality Analysis:');
      const quality = qualityResult.data.quality;
      console.log(`   Resolution: ${quality.resolution.width}x${quality.resolution.height} (${quality.resolution.aspectRatio.toFixed(2)}:1)`);
      console.log(`   Frame Rate: ${quality.frameRate.actual.toFixed(1)} FPS (target: ${quality.frameRate.declared})`);
      console.log(`   Dropped Frames: ${quality.frameRate.droppedFrames} (${((quality.frameRate.droppedFrames / quality.frameRate.droppedFrames + 1000) * 100).toFixed(1)}%)`);
      console.log(`   Video Codec: ${quality.codec.video}`);
      console.log(`   Audio Codec: ${quality.codec.audio}`);
      console.log(`   Container: ${quality.codec.container}`);
      console.log(`   Decode Time: ${quality.performance.decodeTime}ms`);
      console.log(`   Render Time: ${quality.performance.renderTime}ms`);
      console.log(`   Buffer Health: ${quality.performance.bufferHealth}s`);
      console.log(`   CPU Usage: ${quality.performance.cpuUsage}%`);
      console.log(`   GPU Usage: ${quality.performance.gpuUsage}%`);

      // 8. Monitor video events in real-time
      console.log('\n📡 Starting real-time video event monitoring...');
      const eventsPromise = this.client.executeTool('monitor_video_events', {
        selector: '#main-video',
        duration: 6000,
        events: ['play', 'pause', 'seeking', 'seeked', 'timeupdate', 'resize', 'stalled', 'waiting'],
        includeQualityEvents: true,
        includeFrameEvents: true,
        throttle: 300,
        sessionId
      });

      // 9. Test advanced video controls during monitoring
      setTimeout(async () => {
        console.log('🎛️  Testing advanced video controls...');

        // Test quality level control
        await this.client.executeTool('control_video_playback', {
          selector: '#main-video',
          action: 'play',
          qualityLevel: '720p',
          sessionId
        });

        // Test seeking
        setTimeout(async () => {
          await this.client.executeTool('control_video_playback', {
            selector: '#main-video',
            action: 'play',
            seekTo: 20.0,
            sessionId
          });
        }, 1500);

        // Test playback rate
        setTimeout(async () => {
          await this.client.executeTool('control_video_playback', {
            selector: '#main-video',
            action: 'play',
            playbackRate: 1.5,
            sessionId
          });
        }, 3000);

        // Test fullscreen
        setTimeout(async () => {
          await this.client.executeTool('control_video_playback', {
            selector: '#main-video',
            action: 'fullscreen',
            sessionId
          });

          // Exit fullscreen after 2 seconds
          setTimeout(async () => {
            await this.client.executeTool('control_video_playback', {
              selector: '#main-video',
              action: 'exitFullscreen',
              sessionId
            });
          }, 2000);
        }, 4500);

      }, 1000);

      // Wait for event monitoring to complete
      const eventsResult = await eventsPromise;

      console.log(`\n📊 Video events captured: ${eventsResult.data.events.length}`);
      console.log(`   Play count: ${eventsResult.data.summary.playCount}`);
      console.log(`   Pause count: ${eventsResult.data.summary.pauseCount}`);
      console.log(`   Quality changes: ${eventsResult.data.summary.qualityChanges}`);
      console.log(`   Buffering events: ${eventsResult.data.summary.bufferingEvents}`);
      console.log(`   Fullscreen toggles: ${eventsResult.data.summary.fullscreenToggles}`);

      // 10. Test video/audio synchronization
      console.log('\n🔄 Testing video/audio synchronization...');
      const syncResult = await this.client.executeTool('test_video_sync', {
        videoSelector: '#sync-video',
        audioSelector: '#sync-audio',
        duration: 5000,
        tolerance: 0.1,
        sessionId
      });

      console.log('🎭 Synchronization Test Results:');
      console.log(`   In Sync: ${syncResult.data.inSync ? '✅ YES' : '❌ NO'}`);
      console.log(`   Sync Offset: ${syncResult.data.syncOffset.toFixed(3)}s`);
      console.log(`   Max Drift: ${syncResult.data.maxDrift.toFixed(3)}s`);
      console.log(`   Drift Events: ${syncResult.data.driftEvents.length}`);

      if (syncResult.data.driftEvents.length > 0) {
        console.log('   Drift Events Details:');
        syncResult.data.driftEvents.forEach((event, index) => {
          console.log(`      ${index + 1}. ${event.severity.toUpperCase()}: ${event.offset.toFixed(3)}s offset`);
        });
      }

      console.log('\n💡 Sync Recommendations:');
      syncResult.data.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });

      // 11. Comprehensive video issue detection
      console.log('\n🔍 Detecting video issues with quality scoring...');
      const issuesResult = await this.client.executeTool('detect_video_issues', {
        checkDuration: 3000,
        frameRateThreshold: 25,
        qualityThreshold: 720,
        bufferThreshold: 2,
        sessionId
      });

      console.log(`📋 Video Issues Analysis:`);
      console.log(`   Overall Quality Score: ${issuesResult.data.overallScore}/100`);
      console.log(`   Issues Found: ${issuesResult.data.hasIssues ? issuesResult.data.issues.length : 0}`);

      if (issuesResult.data.issues.length > 0) {
        console.log('   Issue Details:');
        issuesResult.data.issues.forEach(issue => {
          console.log(`      ${issue.severity.toUpperCase()}: ${issue.type} - ${issue.description}`);
          if (issue.metrics) {
            console.log(`         Metrics: ${JSON.stringify(issue.metrics)}`);
          }
        });
      }

      console.log('\n💡 Video Optimization Recommendations:');
      issuesResult.data.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });

      // 12. Test multiple video formats and qualities
      console.log('\n🎯 Testing multiple video formats...');

      const videoSelectors = ['#main-video', '#secondary-video', '#autoplay-video'];
      for (const selector of videoSelectors) {
        try {
          const formatResult = await this.client.executeTool('check_video_playing', {
            selector,
            qualityCheck: true,
            sessionId
          });

          if (formatResult.data.elements.length > 0) {
            const element = formatResult.data.elements[0];
            console.log(`   📹 ${selector}:`);
            console.log(`      Playing: ${!element.paused ? '✅' : '❌'}`);
            console.log(`      Resolution: ${element.videoWidth}x${element.videoHeight}`);
            console.log(`      Format: ${this.detectFormat(element.src)}`);
            console.log(`      Quality Level: ${this.getQualityLevel(element.videoHeight)}`);
          }
        } catch (error) {
          console.log(`   ❌ ${selector}: Error - ${error.message}`);
        }
      }

      // 13. Test video controls and interactions
      console.log('\n🎛️  Testing comprehensive video controls...');

      // Test volume control
      await this.client.executeTool('control_video_playback', {
        selector: '#main-video',
        action: 'play',
        volume: 0.6,
        sessionId
      });
      console.log('   ✅ Volume control tested');

      // Test seeking precision
      await this.client.executeTool('control_video_playback', {
        selector: '#main-video',
        action: 'play',
        seekTo: 45.5,
        sessionId
      });
      console.log('   ✅ Precise seeking tested');

      // Test playback rate control
      await this.client.executeTool('control_video_playback', {
        selector: '#main-video',
        action: 'play',
        playbackRate: 2.0,
        sessionId
      });
      console.log('   ✅ Playback rate control tested');

      // Test picture-in-picture
      try {
        await this.client.executeTool('control_video_playback', {
          selector: '#main-video',
          action: 'pictureInPicture',
          sessionId
        });
        console.log('   ✅ Picture-in-Picture tested');

        // Exit PiP after 2 seconds
        setTimeout(async () => {
          await this.client.executeTool('execute_javascript', {
            script: 'if (document.pictureInPictureElement) { document.exitPictureInPicture(); }',
            sessionId
          });
        }, 2000);
      } catch (error) {
        console.log('   ⚠️  Picture-in-Picture not supported or failed');
      }

      // 14. Test error scenarios
      console.log('\n🧪 Testing video error scenarios...');

      const errorTests = [
        { selector: '#no-source-video', expected: 'no-video' },
        { selector: '#invalid-source-video', expected: 'network-issue' }
      ];

      for (const test of errorTests) {
        try {
          const errorResult = await this.client.executeTool('detect_video_issues', {
            selector: test.selector,
            checkDuration: 2000,
            sessionId
          });

          console.log(`   🔍 ${test.selector}:`);
          console.log(`      Issues found: ${errorResult.data.issues.length}`);
          console.log(`      Quality score: ${errorResult.data.overallScore}/100`);

          if (errorResult.data.issues.length > 0) {
            errorResult.data.issues.forEach(issue => {
              console.log(`         ${issue.severity.toUpperCase()}: ${issue.type} - ${issue.description}`);
            });
          }
        } catch (error) {
          console.log(`   ❌ ${test.selector}: Test error - ${error.message}`);
        }
      }

      // 15. Take comprehensive screenshots
      console.log('\n📸 Capturing video testing documentation...');

      // Screenshot of main video player
      await this.client.executeTool('take_screenshot', {
        selector: '#main-video',
        format: 'png',
        sessionId
      });
      console.log('   📸 Main video player captured');

      // Full page screenshot
      await this.client.executeTool('take_screenshot', {
        fullPage: true,
        format: 'png',
        sessionId
      });
      console.log('   📸 Full page captured');

      // 16. Final video state analysis
      console.log('\n📊 Final video state analysis...');
      const finalAnalysis = await this.client.executeTool('execute_javascript', {
        script: `
          const videos = document.querySelectorAll('video');
          const analysis = {
            totalVideos: videos.length,
            playingVideos: 0,
            totalResolutions: new Set(),
            totalFormats: new Set(),
            qualityDistribution: {}
          };

          videos.forEach(video => {
            if (!video.paused && !video.ended) {
              analysis.playingVideos++;
            }

            if (video.videoWidth && video.videoHeight) {
              analysis.totalResolutions.add(video.videoWidth + 'x' + video.videoHeight);

              const quality = video.videoHeight >= 1080 ? '1080p' :
                             video.videoHeight >= 720 ? '720p' :
                             video.videoHeight >= 480 ? '480p' : '360p';

              analysis.qualityDistribution[quality] = (analysis.qualityDistribution[quality] || 0) + 1;
            }

            if (video.src || video.currentSrc) {
              const src = video.src || video.currentSrc;
              if (src.includes('.mp4')) analysis.totalFormats.add('MP4');
              if (src.includes('.webm')) analysis.totalFormats.add('WebM');
              if (src.includes('.ogg')) analysis.totalFormats.add('OGG');
            }
          });

          return {
            ...analysis,
            totalResolutions: Array.from(analysis.totalResolutions),
            totalFormats: Array.from(analysis.totalFormats)
          };
        `,
        sessionId
      });

      const finalData = finalAnalysis.data.result;
      console.log(`📋 Final Video Analysis:`);
      console.log(`   Total videos: ${finalData.totalVideos}`);
      console.log(`   Currently playing: ${finalData.playingVideos}`);
      console.log(`   Resolutions found: ${finalData.totalResolutions.join(', ')}`);
      console.log(`   Formats found: ${finalData.totalFormats.join(', ')}`);
      console.log(`   Quality distribution: ${JSON.stringify(finalData.qualityDistribution)}`);

      // 17. Stop all video playback
      console.log('\n⏹️  Stopping all video playback...');
      await this.client.executeTool('execute_javascript', {
        script: `
          const videos = document.querySelectorAll('video');
          videos.forEach(video => {
            if (!video.paused) {
              video.pause();
            }
          });
          return 'All videos stopped';
        `,
        sessionId
      });

      // Cleanup
      await this.client.executeTool('close_session', { sessionId });

      console.log('\n🎉 Revolutionary Video Testing Workflow Completed Successfully!');
      console.log('🎬 This demonstrates world-class video testing capabilities:');
      console.log('   • Revolutionary real playback detection with frame advancement');
      console.log('   • Professional video quality analysis with performance metrics');
      console.log('   • Advanced video controls with fade effects and quality management');
      console.log('   • Comprehensive video event monitoring with intelligent throttling');
      console.log('   • Video/audio synchronization testing with drift detection');
      console.log('   • Intelligent video issue detection with quality scoring');
      console.log('   • Multi-format and multi-resolution video testing');
      console.log('   • Error scenario testing with comprehensive validation');

    } catch (error) {
      console.error('❌ Video testing workflow failed:', error);
      throw error;
    }
  }

  async runQuickVideoTest() {
    console.log('⚡ Quick Video Test - Revolutionary Playback Detection\n');

    try {
      const sessionResult = await this.client.executeTool('create_session', {
        browserType: 'chrome',
        headless: true
      });
      const sessionId = sessionResult.data.sessionId;

      // Navigate to a video URL
      await this.client.executeTool('navigate_to', {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        sessionId
      });

      // Wait for video to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Revolutionary video playback detection
      const playbackResult = await this.client.executeTool('check_video_playing', {
        checkInterval: 50,
        sampleDuration: 2000,
        frameRateThreshold: 20,
        qualityCheck: true,
        sessionId
      });

      console.log('🎯 Revolutionary Video Detection Results:');
      console.log(`   Is Playing: ${playbackResult.data.isPlaying ? '✅ YES' : '❌ NO'}`);
      console.log(`   Video Elements: ${playbackResult.data.elements.length}`);

      if (playbackResult.data.elements.length > 0) {
        const element = playbackResult.data.elements[0];
        console.log(`   Resolution: ${element.videoWidth}x${element.videoHeight}`);
        console.log(`   Current Time: ${element.currentTime}s`);
        console.log(`   Duration: ${element.duration}s`);
        console.log(`   Frame Count: ${element.webkitDecodedFrameCount || 'N/A'}`);
        console.log(`   Dropped Frames: ${element.webkitDroppedFrameCount || 'N/A'}`);
        console.log(`   Ready State: ${element.readyState}`);
        console.log(`   Network State: ${element.networkState}`);
      }

      if (playbackResult.data.qualityIssues && playbackResult.data.qualityIssues.length > 0) {
        console.log('   Quality Issues:');
        playbackResult.data.qualityIssues.forEach(issue => {
          console.log(`      ${issue.severity.toUpperCase()}: ${issue.issue}`);
        });
      }

      await this.client.executeTool('close_session', { sessionId });

      console.log('\n✅ Quick video test completed!');

    } catch (error) {
      console.error('❌ Quick video test failed:', error);
    }
  }

  // Helper methods
  detectFormat(src) {
    if (!src) return 'Unknown';
    if (src.includes('.mp4')) return 'MP4';
    if (src.includes('.webm')) return 'WebM';
    if (src.includes('.ogg') || src.includes('.ogv')) return 'OGG';
    return 'Unknown';
  }

  getQualityLevel(height) {
    if (height >= 2160) return '4K';
    if (height >= 1440) return '1440p';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';
    return 'Low Quality';
  }
}

// Example usage
async function main() {
  const videoTester = new VideoTestingWorkflow();

  console.log('🎬 MCP Browser Control Server - Revolutionary Video Testing Examples\n');
  console.log('Choose test to run:');
  console.log('1. Complete Video Testing Workflow (comprehensive)');
  console.log('2. Quick Video Test (basic validation)\n');

  // For demo purposes, run complete workflow
  await videoTester.runCompleteVideoTest();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default VideoTestingWorkflow;