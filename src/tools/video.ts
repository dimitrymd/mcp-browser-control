import { WebDriver } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import {
  CheckVideoPlayingParams,
  CheckVideoPlayingResult,
  AnalyzeVideoQualityParams,
  AnalyzeVideoQualityResult,
  VideoSyncTestParams,
  VideoSyncTestResult,
  ControlVideoPlaybackParams,
  ControlVideoPlaybackResult,
  MonitorVideoEventsParams,
  MonitorVideoEventsResult,
  DetectVideoIssuesParams,
  DetectVideoIssuesResult,
  ProfileVideoPerformanceParams,
  ProfileVideoPerformanceResult,
  VideoElement,
  VideoPlaybackState,
  MCPToolResult
} from '../types/index.js';
import {
  extractVideoElementInfo,
  isVideoActuallyPlaying,
  analyzeVideoQuality,
  testVideoAudioSync,
  detectVideoIssues,
  monitorVideoPerformance,
  generateVideoRecommendations,
  findVideoElements,
  checkVideoFormatSupport,
  calculateVideoQualityScore,
  getVideoCodecInfo,
  testVideoAccessibility
} from '../utils/video.js';
import { ValidationError, createErrorResponse } from '../utils/errors.js';
import { findElementWithRetry } from '../utils/elements.js';
import { normalizeSelector } from '../utils/selectors.js';
import winston from 'winston';

export class VideoTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async checkVideoPlaying(params: unknown, sessionId?: string): Promise<MCPToolResult<CheckVideoPlayingResult>> {
    const startTime = Date.now();
    this.logger.info('Executing check_video_playing tool', { params, sessionId });

    try {
      const validatedParams = this.validateCheckVideoPlayingParams(params);
      const {
        selector,
        checkInterval = 100,
        sampleDuration = 1000,
        frameRateThreshold = 10,
        qualityCheck = true
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Starting video playback check', {
        selector,
        checkInterval,
        sampleDuration,
        frameRateThreshold,
        qualityCheck,
        sessionId: actualSessionId
      });

      let videoElements: VideoElement[] = [];
      let elementsToCheck: Array<{ element: any; selector: string }> = [];

      if (selector) {
        // Check specific element
        const element = await findElementWithRetry(session.driver, selector, 3, this.logger);
        const tagName = await element.getTagName();

        if (tagName.toLowerCase() !== 'video') {
          throw new ValidationError(
            `Element with selector '${selector}' is not a video element (found: ${tagName})`,
            'selector',
            selector
          );
        }

        elementsToCheck.push({ element, selector });
      } else {
        // Find all video elements
        const foundElements = await findVideoElements(session.driver, false, false, this.logger);
        elementsToCheck = foundElements.map(({ element, selector }) => ({ element, selector }));
      }

      const qualityIssues: Array<{ element: string; issue: string; severity: 'low' | 'medium' | 'high' }> = [];

      // Extract detailed info for each element
      for (const { element, selector: elementSelector } of elementsToCheck) {
        const videoInfo = await extractVideoElementInfo(
          session.driver,
          element,
          elementSelector,
          this.logger
        );

        // Revolutionary video playback detection
        const playbackAnalysis = await isVideoActuallyPlaying(
          session.driver,
          element,
          sampleDuration,
          frameRateThreshold,
          this.logger
        );

        // Update playing state based on actual analysis
        videoInfo.paused = !playbackAnalysis.isPlaying;

        // Quality check if requested
        if (qualityCheck && playbackAnalysis.isPlaying) {
          if (playbackAnalysis.frameRate < frameRateThreshold) {
            qualityIssues.push({
              element: elementSelector,
              issue: `Low frame rate: ${playbackAnalysis.frameRate.toFixed(1)} FPS`,
              severity: playbackAnalysis.frameRate < 15 ? 'high' : 'medium'
            });
          }

          if (videoInfo.webkitDroppedFrameCount && videoInfo.webkitDecodedFrameCount) {
            const dropRate = videoInfo.webkitDroppedFrameCount / videoInfo.webkitDecodedFrameCount;
            if (dropRate > 0.05) {
              qualityIssues.push({
                element: elementSelector,
                issue: `High frame drop rate: ${(dropRate * 100).toFixed(1)}%`,
                severity: dropRate > 0.1 ? 'high' : 'medium'
              });
            }
          }
        }

        videoElements.push(videoInfo);
      }

      // Count actively playing elements
      const activeCount = videoElements.filter(el => !el.paused && !el.ended).length;
      const isPlaying = activeCount > 0;

      const result: CheckVideoPlayingResult = {
        isPlaying,
        elements: videoElements,
        activeCount,
        qualityIssues: qualityIssues.length > 0 ? qualityIssues : undefined
      };

      this.logger.info('Video playback check completed', {
        ...result,
        qualityIssuesCount: qualityIssues.length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'checkVideoPlaying', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Video playback check failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'checkVideoPlaying', (params as any)?.selector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Video playback check failed'));
    }
  }

  async analyzeVideoQuality(params: unknown, sessionId?: string): Promise<MCPToolResult<AnalyzeVideoQualityResult>> {
    const startTime = Date.now();
    this.logger.info('Executing analyze_video_quality tool', { params, sessionId });

    try {
      const validatedParams = this.validateAnalyzeVideoQualityParams(params);
      const {
        selector,
        duration,
        sampleInterval = 200,
        includeFrameAnalysis = true,
        includeBitrateAnalysis = true
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Starting video quality analysis', {
        selector,
        duration,
        sampleInterval,
        includeFrameAnalysis,
        includeBitrateAnalysis,
        sessionId: actualSessionId
      });

      // Find the video element
      const element = await findElementWithRetry(session.driver, selector, 3, this.logger);

      // Analyze video quality
      const qualityMetrics = await analyzeVideoQuality(
        session.driver,
        element,
        duration,
        { includeFrameStats: includeFrameAnalysis, includeBitrateAnalysis },
        this.logger
      );

      // Monitor performance over time
      const { samples, issues, performance } = await monitorVideoPerformance(
        session.driver,
        element,
        duration,
        sampleInterval,
        this.logger
      );

      // Create timeline from samples
      const timeline = samples.map(sample => ({
        timestamp: sample.timestamp,
        frameRate: sample.frameCount, // Simplified
        bufferLevel: sample.bufferLevel,
        qualityLevel: sample.qualityLevel
      }));

      // Generate recommendations
      const recommendations = issues.length > 0 ? [
        'Consider optimizing video encoding settings',
        'Check network connectivity for streaming',
        'Monitor system resources during playback'
      ] : [
        'Video quality appears to be excellent',
        'Performance metrics are within optimal ranges'
      ];

      const result: AnalyzeVideoQualityResult = {
        quality: qualityMetrics,
        timeline,
        recommendations
      };

      this.logger.info('Video quality analysis completed', {
        selector,
        frameRate: qualityMetrics.frameRate.actual,
        droppedFrames: qualityMetrics.frameRate.droppedFrames,
        resolution: `${qualityMetrics.resolution.width}x${qualityMetrics.resolution.height}`,
        issuesCount: issues.length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'analyzeVideoQuality', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Video quality analysis failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'analyzeVideoQuality', (params as any)?.selector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Video quality analysis failed'));
    }
  }

  async testVideoSync(params: unknown, sessionId?: string): Promise<MCPToolResult<VideoSyncTestResult>> {
    const startTime = Date.now();
    this.logger.info('Executing test_video_sync tool', { params, sessionId });

    try {
      const validatedParams = this.validateVideoSyncTestParams(params);
      const {
        videoSelector,
        audioSelector,
        duration,
        tolerance = 0.1
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Starting video/audio sync test', {
        videoSelector,
        audioSelector,
        duration,
        tolerance,
        sessionId: actualSessionId
      });

      // Find video element
      const videoElement = await findElementWithRetry(session.driver, videoSelector, 3, this.logger);

      // Find audio element if specified
      let audioElement = null;
      if (audioSelector) {
        audioElement = await findElementWithRetry(session.driver, audioSelector, 3, this.logger);
      }

      // Test synchronization
      const syncResult = await testVideoAudioSync(
        session.driver,
        videoElement,
        audioElement,
        duration,
        tolerance,
        this.logger
      );

      // Generate recommendations based on sync results
      const recommendations: string[] = [];
      if (!syncResult.inSync) {
        recommendations.push('Audio/video synchronization issues detected');
        recommendations.push('Check encoding frame rate and audio sample rate compatibility');
        recommendations.push('Consider re-encoding with proper sync metadata');

        if (syncResult.maxDrift > tolerance * 2) {
          recommendations.push('Significant sync drift detected - check encoding tools');
        }
      } else {
        recommendations.push('Audio/video synchronization is within acceptable limits');
      }

      const result: VideoSyncTestResult = {
        ...syncResult,
        recommendations
      };

      this.logger.info('Video sync test completed', {
        videoSelector,
        audioSelector,
        inSync: result.inSync,
        syncOffset: result.syncOffset,
        maxDrift: result.maxDrift,
        driftEventsCount: result.driftEvents.length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'testVideoSync', videoSelector, result.inSync, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Video sync test failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'testVideoSync', (params as any)?.videoSelector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Video sync test failed'));
    }
  }

  async controlVideoPlayback(params: unknown, sessionId?: string): Promise<MCPToolResult<ControlVideoPlaybackResult>> {
    const startTime = Date.now();
    this.logger.info('Executing control_video_playback tool', { params, sessionId });

    try {
      const validatedParams = this.validateControlVideoPlaybackParams(params);
      const {
        selector,
        action,
        volume,
        seekTo,
        playbackRate,
        qualityLevel,
        fadeIn,
        fadeOut
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Controlling video playback', {
        selector,
        action,
        volume,
        seekTo,
        playbackRate,
        qualityLevel,
        sessionId: actualSessionId
      });

      // Find the video element
      const element = await findElementWithRetry(session.driver, selector, 3, this.logger);
      const tagName = await element.getTagName();

      if (tagName.toLowerCase() !== 'video') {
        throw new ValidationError(
          `Element with selector '${selector}' is not a video element (found: ${tagName})`,
          'selector',
          selector
        );
      }

      // Get previous state
      const previousStateInfo = await extractVideoElementInfo(session.driver, element, selector, this.logger);
      const previousState: VideoPlaybackState = {
        currentTime: previousStateInfo.currentTime,
        duration: previousStateInfo.duration,
        paused: previousStateInfo.paused,
        muted: previousStateInfo.muted,
        volume: previousStateInfo.volume,
        playbackRate: previousStateInfo.playbackRate,
        ended: previousStateInfo.ended,
        readyState: previousStateInfo.readyState,
        videoWidth: previousStateInfo.videoWidth,
        videoHeight: previousStateInfo.videoHeight,
        fullscreen: false, // Would detect from document.fullscreenElement
        pictureInPicture: false // Would detect from document.pictureInPictureElement
      };

      // Execute the requested action
      let qualityChanged = false;

      await session.driver.executeScript(`
        const el = arguments[0];
        const action = arguments[1];
        const options = arguments[2];

        switch (action) {
          case 'play':
            if (options.fadeIn) {
              // Implement video fade in (affects volume)
              const originalVolume = el.volume;
              el.volume = 0;
              el.play();

              const fadeSteps = 20;
              const stepDuration = options.fadeIn / fadeSteps;
              const volumeStep = originalVolume / fadeSteps;

              for (let i = 1; i <= fadeSteps; i++) {
                setTimeout(() => {
                  el.volume = Math.min(volumeStep * i, originalVolume);
                }, stepDuration * i);
              }
            } else {
              el.play();
            }
            break;

          case 'pause':
            if (options.fadeOut) {
              // Implement video fade out
              const originalVolume = el.volume;
              const fadeSteps = 20;
              const stepDuration = options.fadeOut / fadeSteps;
              const volumeStep = originalVolume / fadeSteps;

              for (let i = 1; i <= fadeSteps; i++) {
                setTimeout(() => {
                  el.volume = Math.max(originalVolume - (volumeStep * i), 0);
                  if (i === fadeSteps) {
                    el.pause();
                    el.volume = originalVolume;
                  }
                }, stepDuration * i);
              }
            } else {
              el.pause();
            }
            break;

          case 'stop':
            el.pause();
            el.currentTime = 0;
            break;

          case 'mute':
            el.muted = true;
            break;

          case 'unmute':
            el.muted = false;
            break;

          case 'toggle':
            if (el.paused) {
              el.play();
            } else {
              el.pause();
            }
            break;

          case 'fullscreen':
            if (el.requestFullscreen) {
              el.requestFullscreen();
            }
            break;

          case 'exitFullscreen':
            if (document.exitFullscreen) {
              document.exitFullscreen();
            }
            break;

          case 'pictureInPicture':
            if (el.requestPictureInPicture) {
              el.requestPictureInPicture();
            }
            break;
        }

        // Apply additional parameters
        if (options.volume !== undefined) {
          el.volume = Math.max(0, Math.min(1, options.volume));
        }

        if (options.seekTo !== undefined) {
          el.currentTime = Math.max(0, Math.min(options.seekTo, el.duration || 0));
        }

        if (options.playbackRate !== undefined) {
          el.playbackRate = Math.max(0.25, Math.min(4, options.playbackRate));
        }

        // Quality level changes would require MediaSource API integration
        if (options.qualityLevel !== undefined) {
          // This would require integration with adaptive streaming
          console.log('Quality level change requested:', options.qualityLevel);
        }
      `, element, action, { volume, seekTo, playbackRate, qualityLevel, fadeIn, fadeOut });

      // Wait for action to take effect
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get current state
      const currentStateInfo = await extractVideoElementInfo(session.driver, element, selector, this.logger);
      const currentState: VideoPlaybackState = {
        currentTime: currentStateInfo.currentTime,
        duration: currentStateInfo.duration,
        paused: currentStateInfo.paused,
        muted: currentStateInfo.muted,
        volume: currentStateInfo.volume,
        playbackRate: currentStateInfo.playbackRate,
        ended: currentStateInfo.ended,
        readyState: currentStateInfo.readyState,
        videoWidth: currentStateInfo.videoWidth,
        videoHeight: currentStateInfo.videoHeight,
        fullscreen: false, // Would detect actual fullscreen state
        pictureInPicture: false
      };

      const result: ControlVideoPlaybackResult = {
        success: true,
        previousState,
        currentState,
        qualityChanged
      };

      this.logger.info('Video playback control completed', {
        selector,
        action,
        previousTime: previousState.currentTime,
        currentTime: currentState.currentTime,
        qualityChanged,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'controlVideoPlayback', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Video playback control failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'controlVideoPlayback', (params as any)?.selector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Video playback control failed'));
    }
  }

  async monitorVideoEvents(params: unknown, sessionId?: string): Promise<MCPToolResult<MonitorVideoEventsResult>> {
    const startTime = Date.now();
    this.logger.info('Executing monitor_video_events tool', { params, sessionId });

    try {
      const validatedParams = this.validateMonitorVideoEventsParams(params);
      const {
        selector,
        duration,
        events = ['play', 'pause', 'ended', 'loadstart', 'canplay', 'stalled', 'waiting', 'seeking', 'seeked'],
        includeQualityEvents = true,
        includeFrameEvents = false,
        throttle = 500
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Starting video event monitoring', {
        selector,
        duration,
        events,
        includeQualityEvents,
        includeFrameEvents,
        throttle,
        sessionId: actualSessionId
      });

      // Set up video event monitoring
      const monitoringResult = await session.driver.executeScript(`
        const selector = arguments[0];
        const duration = arguments[1];
        const eventTypes = arguments[2];
        const includeQualityEvents = arguments[3];
        const includeFrameEvents = arguments[4];
        const throttle = arguments[5];

        return new Promise((resolve) => {
          const capturedEvents = [];
          const summary = {
            playCount: 0,
            pauseCount: 0,
            qualityChanges: 0,
            bufferingEvents: 0,
            fullscreenToggles: 0,
            errors: []
          };

          let elements = [];

          // Find elements to monitor
          if (selector) {
            const element = document.querySelector(selector);
            if (element && element.tagName === 'VIDEO') {
              elements = [{ element, selector }];
            }
          } else {
            const videoElements = document.querySelectorAll('video');
            elements = Array.from(videoElements).map((el, index) => ({
              element: el,
              selector: el.id ? '#' + el.id : 'video:nth-of-type(' + (index + 1) + ')'
            }));
          }

          if (elements.length === 0) {
            resolve({ events: capturedEvents, summary });
            return;
          }

          const startTime = Date.now();
          let lastQualityUpdate = 0;
          let lastFrameUpdate = 0;

          elements.forEach(({ element, selector: elSelector }) => {
            // Add standard event listeners
            eventTypes.forEach(eventType => {
              element.addEventListener(eventType, (event) => {
                const eventData = {
                  timestamp: Date.now(),
                  type: event.type,
                  target: elSelector,
                  data: {
                    currentTime: element.currentTime,
                    videoWidth: element.videoWidth,
                    videoHeight: element.videoHeight,
                    readyState: element.readyState,
                    networkState: element.networkState,
                    frameRate: 0, // Would calculate from frame updates
                    droppedFrames: element.webkitDroppedFrameCount || 0
                  }
                };

                capturedEvents.push(eventData);

                // Update summary
                if (event.type === 'play') summary.playCount++;
                if (event.type === 'pause') summary.pauseCount++;
                if (['stalled', 'waiting'].includes(event.type)) summary.bufferingEvents++;
              });
            });

            // Monitor quality changes
            if (includeQualityEvents) {
              element.addEventListener('resize', () => {
                const now = Date.now();
                if (now - lastQualityUpdate >= throttle) {
                  lastQualityUpdate = now;

                  summary.qualityChanges++;

                  capturedEvents.push({
                    timestamp: now,
                    type: 'qualitychange',
                    target: elSelector,
                    data: {
                      videoWidth: element.videoWidth,
                      videoHeight: element.videoHeight,
                      qualityLevel: element.videoHeight >= 1080 ? '1080p' :
                                   element.videoHeight >= 720 ? '720p' :
                                   element.videoHeight >= 480 ? '480p' : '360p'
                    }
                  });
                }
              });
            }

            // Monitor frame events
            if (includeFrameEvents) {
              const monitorFrames = () => {
                const now = Date.now();
                if (now - lastFrameUpdate >= throttle) {
                  lastFrameUpdate = now;

                  if (element.webkitDecodedFrameCount !== undefined) {
                    capturedEvents.push({
                      timestamp: now,
                      type: 'frameupdate',
                      target: elSelector,
                      data: {
                        frameCount: element.webkitDecodedFrameCount,
                        droppedFrames: element.webkitDroppedFrameCount || 0
                      }
                    });
                  }
                }

                if (Date.now() - startTime < duration) {
                  requestAnimationFrame(monitorFrames);
                }
              };

              requestAnimationFrame(monitorFrames);
            }

            // Monitor fullscreen changes
            document.addEventListener('fullscreenchange', () => {
              summary.fullscreenToggles++;
              capturedEvents.push({
                timestamp: Date.now(),
                type: 'fullscreenchange',
                target: elSelector,
                data: {
                  fullscreen: document.fullscreenElement === element
                }
              });
            });

            // Handle errors
            element.addEventListener('error', (event) => {
              const errorData = {
                type: 'video_error',
                message: 'Video error occurred'
              };

              summary.errors.push(errorData);

              capturedEvents.push({
                timestamp: Date.now(),
                type: 'error',
                target: elSelector,
                data: errorData
              });
            });
          });

          // Stop monitoring after specified duration
          setTimeout(() => {
            resolve({ events: capturedEvents, summary });
          }, duration);
        });
      `, selector, duration, events, includeQualityEvents, includeFrameEvents, throttle);

      const result = monitoringResult as MonitorVideoEventsResult;

      this.logger.info('Video event monitoring completed', {
        selector,
        eventsCount: result.events.length,
        summary: result.summary,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'monitorVideoEvents', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Video event monitoring failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'monitorVideoEvents', (params as any)?.selector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Video event monitoring failed'));
    }
  }

  async detectVideoIssues(params: unknown, sessionId?: string): Promise<MCPToolResult<DetectVideoIssuesResult>> {
    const startTime = Date.now();
    this.logger.info('Executing detect_video_issues tool', { params, sessionId });

    try {
      const validatedParams = this.validateDetectVideoIssuesParams(params);
      const {
        selector,
        checkDuration = 5000,
        frameRateThreshold = 24,
        qualityThreshold = 720,
        bufferThreshold = 2
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Detecting video issues', {
        selector,
        checkDuration,
        frameRateThreshold,
        qualityThreshold,
        bufferThreshold,
        sessionId: actualSessionId
      });

      // Get video elements to analyze
      let videoElements: VideoElement[] = [];

      if (selector) {
        const element = await findElementWithRetry(session.driver, selector, 3, this.logger);
        const videoInfo = await extractVideoElementInfo(session.driver, element, selector, this.logger);
        videoElements = [videoInfo];
      } else {
        const foundElements = await findVideoElements(session.driver, false, false, this.logger);
        for (const { element, selector: elementSelector } of foundElements) {
          const videoInfo = await extractVideoElementInfo(session.driver, element, elementSelector, this.logger);
          videoElements.push(videoInfo);
        }
      }

      // Detect issues
      const issues = await detectVideoIssues(session.driver, videoElements, checkDuration, this.logger);

      // Calculate overall quality score
      const overallScore = issues.length === 0 ? 95 :
        Math.max(0, 100 - (issues.length * 10) -
        (issues.filter(i => i.severity === 'high').length * 20) -
        (issues.filter(i => i.severity === 'critical').length * 40));

      // Generate recommendations
      const recommendations = generateVideoRecommendations(issues);

      const result: DetectVideoIssuesResult = {
        hasIssues: issues.length > 0,
        issues,
        recommendations,
        overallScore
      };

      this.logger.info('Video issue detection completed', {
        selector,
        issuesFound: issues.length,
        overallScore,
        recommendations: recommendations.length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'detectVideoIssues', selector, !result.hasIssues, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Video issue detection failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'detectVideoIssues', (params as any)?.selector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Video issue detection failed'));
    }
  }

  // Private helper methods

  private async getDefaultSession(): Promise<string> {
    const sessions = this.sessionManager.listSessions();
    if (sessions.length > 0) {
      return sessions[0].id;
    }
    throw new Error('No session ID provided and no active sessions available. Create a session first.');
  }

  // Validation methods

  private validateCheckVideoPlayingParams(params: unknown): CheckVideoPlayingParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (p.selector && typeof p.selector !== 'string') {
      throw new ValidationError('selector must be a string', 'selector', p.selector);
    }

    if (p.checkInterval && (typeof p.checkInterval !== 'number' || p.checkInterval < 10)) {
      throw new ValidationError('checkInterval must be a number >= 10ms', 'checkInterval', p.checkInterval);
    }

    if (p.sampleDuration && (typeof p.sampleDuration !== 'number' || p.sampleDuration < 100)) {
      throw new ValidationError('sampleDuration must be a number >= 100ms', 'sampleDuration', p.sampleDuration);
    }

    if (p.frameRateThreshold && (typeof p.frameRateThreshold !== 'number' || p.frameRateThreshold < 1)) {
      throw new ValidationError('frameRateThreshold must be a number >= 1', 'frameRateThreshold', p.frameRateThreshold);
    }

    return {
      selector: p.selector ? normalizeSelector(p.selector) : undefined,
      checkInterval: p.checkInterval,
      sampleDuration: p.sampleDuration,
      frameRateThreshold: p.frameRateThreshold,
      qualityCheck: p.qualityCheck
    };
  }

  private validateAnalyzeVideoQualityParams(params: unknown): AnalyzeVideoQualityParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!p.selector || typeof p.selector !== 'string') {
      throw new ValidationError('selector is required and must be a string', 'selector', p.selector);
    }

    if (typeof p.duration !== 'number' || p.duration < 1000) {
      throw new ValidationError('duration is required and must be a number >= 1000ms', 'duration', p.duration);
    }

    return {
      selector: normalizeSelector(p.selector),
      duration: p.duration,
      sampleInterval: p.sampleInterval,
      includeFrameAnalysis: p.includeFrameAnalysis,
      includeBitrateAnalysis: p.includeBitrateAnalysis
    };
  }

  private validateVideoSyncTestParams(params: unknown): VideoSyncTestParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!p.videoSelector || typeof p.videoSelector !== 'string') {
      throw new ValidationError('videoSelector is required and must be a string', 'videoSelector', p.videoSelector);
    }

    if (typeof p.duration !== 'number' || p.duration < 1000) {
      throw new ValidationError('duration is required and must be a number >= 1000ms', 'duration', p.duration);
    }

    if (p.audioSelector && typeof p.audioSelector !== 'string') {
      throw new ValidationError('audioSelector must be a string', 'audioSelector', p.audioSelector);
    }

    if (p.tolerance && (typeof p.tolerance !== 'number' || p.tolerance < 0)) {
      throw new ValidationError('tolerance must be a non-negative number', 'tolerance', p.tolerance);
    }

    return {
      videoSelector: normalizeSelector(p.videoSelector),
      audioSelector: p.audioSelector ? normalizeSelector(p.audioSelector) : undefined,
      duration: p.duration,
      tolerance: p.tolerance
    };
  }

  private validateControlVideoPlaybackParams(params: unknown): ControlVideoPlaybackParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!p.selector || typeof p.selector !== 'string') {
      throw new ValidationError('selector is required and must be a string', 'selector', p.selector);
    }

    const validActions = ['play', 'pause', 'stop', 'mute', 'unmute', 'toggle', 'fullscreen', 'exitFullscreen', 'pictureInPicture'];
    if (!p.action || !validActions.includes(p.action)) {
      throw new ValidationError(
        `action must be one of: ${validActions.join(', ')}`,
        'action',
        p.action
      );
    }

    if (p.volume !== undefined && (typeof p.volume !== 'number' || p.volume < 0 || p.volume > 1)) {
      throw new ValidationError('volume must be a number between 0 and 1', 'volume', p.volume);
    }

    if (p.seekTo !== undefined && (typeof p.seekTo !== 'number' || p.seekTo < 0)) {
      throw new ValidationError('seekTo must be a non-negative number', 'seekTo', p.seekTo);
    }

    if (p.playbackRate !== undefined && (typeof p.playbackRate !== 'number' || p.playbackRate < 0.25 || p.playbackRate > 4)) {
      throw new ValidationError('playbackRate must be a number between 0.25 and 4', 'playbackRate', p.playbackRate);
    }

    return {
      selector: normalizeSelector(p.selector),
      action: p.action,
      volume: p.volume,
      seekTo: p.seekTo,
      playbackRate: p.playbackRate,
      qualityLevel: p.qualityLevel,
      fadeIn: p.fadeIn,
      fadeOut: p.fadeOut
    };
  }

  private validateMonitorVideoEventsParams(params: unknown): MonitorVideoEventsParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (typeof p.duration !== 'number' || p.duration < 100) {
      throw new ValidationError('duration is required and must be a number >= 100ms', 'duration', p.duration);
    }

    if (p.events && !Array.isArray(p.events)) {
      throw new ValidationError('events must be an array of strings', 'events', p.events);
    }

    if (p.throttle && (typeof p.throttle !== 'number' || p.throttle < 10)) {
      throw new ValidationError('throttle must be a number >= 10ms', 'throttle', p.throttle);
    }

    return {
      selector: p.selector ? normalizeSelector(p.selector) : undefined,
      duration: p.duration,
      events: p.events,
      includeQualityEvents: p.includeQualityEvents,
      includeFrameEvents: p.includeFrameEvents,
      throttle: p.throttle
    };
  }

  private validateDetectVideoIssuesParams(params: unknown): DetectVideoIssuesParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (p.selector && typeof p.selector !== 'string') {
      throw new ValidationError('selector must be a string', 'selector', p.selector);
    }

    if (p.checkDuration && (typeof p.checkDuration !== 'number' || p.checkDuration < 1000)) {
      throw new ValidationError('checkDuration must be a number >= 1000ms', 'checkDuration', p.checkDuration);
    }

    return {
      selector: p.selector ? normalizeSelector(p.selector) : undefined,
      checkDuration: p.checkDuration,
      frameRateThreshold: p.frameRateThreshold,
      qualityThreshold: p.qualityThreshold,
      bufferThreshold: p.bufferThreshold
    };
  }
}