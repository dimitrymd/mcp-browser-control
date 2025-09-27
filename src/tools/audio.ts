import { WebDriver } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import {
  CheckAudioPlayingParams,
  CheckAudioPlayingResult,
  GetAudioElementsParams,
  GetAudioElementsResult,
  ControlAudioPlaybackParams,
  ControlAudioPlaybackResult,
  MonitorAudioEventsParams,
  MonitorAudioEventsResult,
  AnalyzeAudioPerformanceParams,
  AnalyzeAudioPerformanceResult,
  DetectAudioIssuesParams,
  DetectAudioIssuesResult,
  AudioElement,
  AudioState,
  AudioEvent,
  AudioElementInfo,
  MCPToolResult
} from '../types/index.js';
import {
  extractAudioElementInfo,
  isAudioActuallyPlaying,
  getAudioState,
  detectAudioIssues,
  findAudioElements,
  generateAudioRecommendations,
  monitorAudioPerformance
} from '../utils/audio.js';
import { ValidationError, createErrorResponse } from '../utils/errors.js';
import { findElementWithRetry } from '../utils/elements.js';
import { normalizeSelector } from '../utils/selectors.js';
import winston from 'winston';

export class AudioTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async checkAudioPlaying(params: unknown, sessionId?: string): Promise<MCPToolResult<CheckAudioPlayingResult>> {
    const startTime = Date.now();
    this.logger.info('Executing check_audio_playing tool', { params, sessionId });

    try {
      const validatedParams = this.validateCheckAudioPlayingParams(params);
      const { selector, checkInterval = 100, sampleDuration = 500 } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Starting audio playback check', {
        selector,
        checkInterval,
        sampleDuration,
        sessionId: actualSessionId
      });

      let audioElements: AudioElement[] = [];
      let elementsToCheck: Array<{ element: any; selector: string }> = [];

      if (selector) {
        // Check specific element
        const element = await findElementWithRetry(session.driver, selector, 3, this.logger);
        const tagName = await element.getTagName();

        if (!['audio', 'video'].includes(tagName.toLowerCase())) {
          throw new ValidationError(
            `Element with selector '${selector}' is not an audio or video element (found: ${tagName})`,
            'selector',
            selector
          );
        }

        elementsToCheck.push({ element, selector });
      } else {
        // Find all audio/video elements
        elementsToCheck = await findAudioElements(session.driver, false, false, this.logger);
      }

      // Extract detailed info for each element
      for (const { element, selector: elementSelector } of elementsToCheck) {
        const audioInfo = await extractAudioElementInfo(
          session.driver,
          element,
          elementSelector,
          this.logger
        );

        // Check if actually playing
        const isPlaying = await isAudioActuallyPlaying(
          session.driver,
          element,
          sampleDuration,
          checkInterval,
          this.logger
        );

        // Update the paused state based on actual playback
        audioInfo.paused = !isPlaying;
        audioElements.push(audioInfo);
      }

      // Count actively playing elements
      const activeCount = audioElements.filter(el => !el.paused && !el.ended).length;
      const isPlaying = activeCount > 0;

      const result: CheckAudioPlayingResult = {
        isPlaying,
        elements: audioElements,
        activeCount
      };

      this.logger.info('Audio playback check completed', {
        ...result,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'checkAudioPlaying', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Audio playback check failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'checkAudioPlaying', (params as any)?.selector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Audio playback check failed'));
    }
  }

  async getAudioElements(params: unknown, sessionId?: string): Promise<MCPToolResult<GetAudioElementsResult>> {
    const startTime = Date.now();
    this.logger.info('Executing get_audio_elements tool', { params, sessionId });

    try {
      const validatedParams = this.validateGetAudioElementsParams(params);
      const { includeIframes = false, onlyWithSource = false } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Finding audio elements', {
        includeIframes,
        onlyWithSource,
        sessionId: actualSessionId
      });

      // Find all audio elements
      const foundElements = await findAudioElements(session.driver, includeIframes, onlyWithSource, this.logger);

      // Extract detailed information for each element
      const elements: AudioElementInfo[] = [];
      let audioCount = 0;
      let videoCount = 0;

      for (const { element, selector } of foundElements) {
        try {
          const elementInfo = await session.driver.executeScript(`
            const el = arguments[0];

            // Get sources
            const sources = [];
            if (el.src) {
              sources.push({ src: el.src, type: el.type || '' });
            }

            const sourceElements = el.querySelectorAll('source');
            sourceElements.forEach(source => {
              sources.push({
                src: source.src || '',
                type: source.type || ''
              });
            });

            return {
              tagName: el.tagName.toLowerCase(),
              hasSource: !!(el.src || el.currentSrc || sources.length > 0),
              sources: sources,
              autoplay: el.autoplay === true,
              controls: el.controls === true,
              loop: el.loop === true,
              preload: el.preload || 'metadata',
              crossOrigin: el.crossOrigin,
              mediaGroup: el.mediaGroup || '',
              defaultMuted: el.defaultMuted === true,
              defaultPlaybackRate: el.defaultPlaybackRate || 1
            };
          `, element);

          const info: AudioElementInfo = {
            selector,
            ...(elementInfo as any)
          };

          elements.push(info);

          // Count by type
          if (info.tagName === 'audio') {
            audioCount++;
          } else if (info.tagName === 'video') {
            videoCount++;
          }

        } catch (error) {
          this.logger.warn('Failed to extract info for audio element', { selector, error });
        }
      }

      const result: GetAudioElementsResult = {
        elements,
        total: elements.length,
        byType: { audio: audioCount, video: videoCount }
      };

      this.logger.info('Audio elements retrieval completed', {
        ...result,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'getAudioElements', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Get audio elements failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'getAudioElements', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Get audio elements failed'));
    }
  }

  async controlAudioPlayback(params: unknown, sessionId?: string): Promise<MCPToolResult<ControlAudioPlaybackResult>> {
    const startTime = Date.now();
    this.logger.info('Executing control_audio_playback tool', { params, sessionId });

    try {
      const validatedParams = this.validateControlAudioPlaybackParams(params);
      const { selector, action, volume, seekTo, playbackRate, fadeIn, fadeOut } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Controlling audio playback', {
        selector,
        action,
        volume,
        seekTo,
        playbackRate,
        sessionId: actualSessionId
      });

      // Find the audio element
      const element = await findElementWithRetry(session.driver, selector, 3, this.logger);
      const tagName = await element.getTagName();

      if (!['audio', 'video'].includes(tagName.toLowerCase())) {
        throw new ValidationError(
          `Element with selector '${selector}' is not an audio or video element (found: ${tagName})`,
          'selector',
          selector
        );
      }

      // Get previous state
      const previousState = await getAudioState(session.driver, element, this.logger);

      // Execute the requested action
      await session.driver.executeScript(`
        const el = arguments[0];
        const action = arguments[1];
        const options = arguments[2];

        switch (action) {
          case 'play':
            if (options.fadeIn) {
              // Implement fade in
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
              // Implement fade out
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
      `, element, action, { volume, seekTo, playbackRate, fadeIn, fadeOut });

      // Wait a moment for the action to take effect
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get current state
      const currentState = await getAudioState(session.driver, element, this.logger);

      const result: ControlAudioPlaybackResult = {
        success: true,
        previousState,
        currentState
      };

      this.logger.info('Audio playback control completed', {
        selector,
        action,
        previousState,
        currentState,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'controlAudioPlayback', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Audio playback control failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'controlAudioPlayback', (params as any)?.selector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Audio playback control failed'));
    }
  }

  async monitorAudioEvents(params: unknown, sessionId?: string): Promise<MCPToolResult<MonitorAudioEventsResult>> {
    const startTime = Date.now();
    this.logger.info('Executing monitor_audio_events tool', { params, sessionId });

    try {
      const validatedParams = this.validateMonitorAudioEventsParams(params);
      const {
        selector,
        duration,
        events = ['play', 'pause', 'ended', 'loadstart', 'canplay', 'canplaythrough', 'stalled', 'waiting'],
        includeTimeUpdates = false,
        throttle = 1000
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Starting audio event monitoring', {
        selector,
        duration,
        events,
        includeTimeUpdates,
        throttle,
        sessionId: actualSessionId
      });

      // Set up event monitoring
      const monitoringResult = await session.driver.executeScript(`
        const selector = arguments[0];
        const duration = arguments[1];
        const eventTypes = arguments[2];
        const includeTimeUpdates = arguments[3];
        const throttle = arguments[4];

        return new Promise((resolve) => {
          const capturedEvents = [];
          const summary = {
            playCount: 0,
            pauseCount: 0,
            totalPlayTime: 0,
            bufferingEvents: 0,
            errors: []
          };

          let elements = [];

          // Find elements to monitor
          if (selector) {
            const element = document.querySelector(selector);
            if (element && (element.tagName === 'AUDIO' || element.tagName === 'VIDEO')) {
              elements = [{ element, selector }];
            }
          } else {
            const audioElements = document.querySelectorAll('audio, video');
            elements = Array.from(audioElements).map((el, index) => ({
              element: el,
              selector: el.id ? '#' + el.id : el.tagName.toLowerCase() + ':nth-of-type(' + (index + 1) + ')'
            }));
          }

          if (elements.length === 0) {
            resolve({ events: capturedEvents, summary });
            return;
          }

          const startTime = Date.now();
          let lastTimeUpdate = 0;

          elements.forEach(({ element, selector: elSelector }) => {
            // Add event listeners
            eventTypes.forEach(eventType => {
              element.addEventListener(eventType, (event) => {
                const eventData = {
                  timestamp: Date.now(),
                  type: event.type,
                  target: elSelector,
                  data: {
                    currentTime: element.currentTime,
                    duration: element.duration,
                    paused: element.paused,
                    volume: element.volume,
                    readyState: element.readyState
                  }
                };

                capturedEvents.push(eventData);

                // Update summary
                if (event.type === 'play') summary.playCount++;
                if (event.type === 'pause') summary.pauseCount++;
                if (['stalled', 'waiting'].includes(event.type)) summary.bufferingEvents++;
              });
            });

            // Handle timeupdate events with throttling
            if (includeTimeUpdates) {
              element.addEventListener('timeupdate', (event) => {
                const now = Date.now();
                if (now - lastTimeUpdate >= throttle) {
                  lastTimeUpdate = now;

                  const eventData = {
                    timestamp: now,
                    type: 'timeupdate',
                    target: elSelector,
                    data: {
                      currentTime: element.currentTime,
                      duration: element.duration
                    }
                  };

                  capturedEvents.push(eventData);
                }
              });
            }

            // Handle errors
            element.addEventListener('error', (event) => {
              const errorData = {
                type: 'playback_error',
                message: 'Audio/video error occurred'
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
            // Calculate total play time (simplified)
            elements.forEach(({ element }) => {
              if (!element.paused && element.currentTime > 0) {
                summary.totalPlayTime += element.currentTime;
              }
            });

            resolve({ events: capturedEvents, summary });
          }, duration);
        });
      `, selector, duration, events, includeTimeUpdates, throttle);

      const result = monitoringResult as MonitorAudioEventsResult;

      this.logger.info('Audio event monitoring completed', {
        selector,
        eventsCount: result.events.length,
        summary: result.summary,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'monitorAudioEvents', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Audio event monitoring failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'monitorAudioEvents', (params as any)?.selector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Audio event monitoring failed'));
    }
  }

  async analyzeAudioPerformance(params: unknown, sessionId?: string): Promise<MCPToolResult<AnalyzeAudioPerformanceResult>> {
    const startTime = Date.now();
    this.logger.info('Executing analyze_audio_performance tool', { params, sessionId });

    try {
      const validatedParams = this.validateAnalyzeAudioPerformanceParams(params);
      const { selector, duration, metrics } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      // Find the audio element
      const element = await findElementWithRetry(session.driver, selector, 3, this.logger);

      this.logger.debug('Starting audio performance analysis', {
        selector,
        duration,
        metrics,
        sessionId: actualSessionId
      });

      // Monitor performance
      const { samples, issues } = await monitorAudioPerformance(session.driver, element, duration, this.logger);

      // Calculate performance metrics
      const performance = this.calculatePerformanceMetrics(samples);
      const timeline = samples.map((sample, index) => ({
        time: index * 100, // 100ms intervals
        metric: 'currentTime',
        value: sample.currentTime
      }));

      const result: AnalyzeAudioPerformanceResult = {
        performance,
        timeline
      };

      this.logger.info('Audio performance analysis completed', {
        selector,
        performance,
        issuesCount: issues.length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'analyzeAudioPerformance', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Audio performance analysis failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'analyzeAudioPerformance', (params as any)?.selector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Audio performance analysis failed'));
    }
  }

  async detectAudioIssues(params: unknown, sessionId?: string): Promise<MCPToolResult<DetectAudioIssuesResult>> {
    const startTime = Date.now();
    this.logger.info('Executing detect_audio_issues tool', { params, sessionId });

    try {
      const validatedParams = this.validateDetectAudioIssuesParams(params);
      const { selector, checkDuration = 5000 } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Detecting audio issues', {
        selector,
        checkDuration,
        sessionId: actualSessionId
      });

      // Get audio elements to analyze
      let audioElements: AudioElement[] = [];

      if (selector) {
        const element = await findElementWithRetry(session.driver, selector, 3, this.logger);
        const audioInfo = await extractAudioElementInfo(session.driver, element, selector, this.logger);
        audioElements = [audioInfo];
      } else {
        const foundElements = await findAudioElements(session.driver, false, false, this.logger);
        for (const { element, selector: elementSelector } of foundElements) {
          const audioInfo = await extractAudioElementInfo(session.driver, element, elementSelector, this.logger);
          audioElements.push(audioInfo);
        }
      }

      // Detect issues
      const issues = await detectAudioIssues(session.driver, audioElements, checkDuration, this.logger);

      // Generate recommendations
      const recommendations = generateAudioRecommendations(issues);

      const result: DetectAudioIssuesResult = {
        hasIssues: issues.length > 0,
        issues,
        recommendations
      };

      this.logger.info('Audio issue detection completed', {
        selector,
        issuesFound: issues.length,
        recommendations: recommendations.length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'detectAudioIssues', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Audio issue detection failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'detectAudioIssues', (params as any)?.selector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Audio issue detection failed'));
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

  private calculatePerformanceMetrics(samples: Array<{ timestamp: number; currentTime: number; buffered: number }>): any {
    if (samples.length < 2) {
      return {
        bufferingTime: 0,
        playbackTime: 0,
        bufferRatio: 0,
        averageBitrate: 0,
        droppedFrames: 0,
        decodedFrames: 0,
        audioLatency: 0,
        stutterEvents: 0
      };
    }

    const totalDuration = samples[samples.length - 1].timestamp - samples[0].timestamp;
    const playbackDuration = samples[samples.length - 1].currentTime - samples[0].currentTime;

    let stutterEvents = 0;
    let bufferingTime = 0;

    // Analyze samples for performance issues
    for (let i = 1; i < samples.length; i++) {
      const current = samples[i];
      const previous = samples[i - 1];

      const timeDiff = current.timestamp - previous.timestamp;
      const playbackDiff = current.currentTime - previous.currentTime;

      // Detect stuttering
      if (timeDiff > 150 && playbackDiff < timeDiff / 1000 * 0.8) {
        stutterEvents++;
      }

      // Detect buffering
      if (current.buffered < current.currentTime + 1) {
        bufferingTime += timeDiff;
      }
    }

    return {
      bufferingTime,
      playbackTime: playbackDuration * 1000,
      bufferRatio: samples.length > 0 ? samples[samples.length - 1].buffered / samples[samples.length - 1].currentTime : 0,
      averageBitrate: 0, // Would require more sophisticated analysis
      droppedFrames: 0, // Video-specific metric
      decodedFrames: 0, // Video-specific metric
      audioLatency: 0, // Would require Web Audio API analysis
      stutterEvents
    };
  }

  // Validation methods

  private validateCheckAudioPlayingParams(params: unknown): CheckAudioPlayingParams {
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

    return {
      selector: p.selector ? normalizeSelector(p.selector) : undefined,
      checkInterval: p.checkInterval,
      sampleDuration: p.sampleDuration
    };
  }

  private validateGetAudioElementsParams(params: unknown): GetAudioElementsParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;
    return {
      includeIframes: p.includeIframes,
      onlyWithSource: p.onlyWithSource
    };
  }

  private validateControlAudioPlaybackParams(params: unknown): ControlAudioPlaybackParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!p.selector || typeof p.selector !== 'string') {
      throw new ValidationError('selector is required and must be a string', 'selector', p.selector);
    }

    const validActions = ['play', 'pause', 'stop', 'mute', 'unmute', 'toggle'];
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
      fadeIn: p.fadeIn,
      fadeOut: p.fadeOut
    };
  }

  private validateMonitorAudioEventsParams(params: unknown): MonitorAudioEventsParams {
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
      includeTimeUpdates: p.includeTimeUpdates,
      throttle: p.throttle
    };
  }

  private validateAnalyzeAudioPerformanceParams(params: unknown): AnalyzeAudioPerformanceParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!p.selector || typeof p.selector !== 'string') {
      throw new ValidationError('selector is required and must be a string', 'selector', p.selector);
    }

    if (typeof p.duration !== 'number' || p.duration < 500) {
      throw new ValidationError('duration is required and must be a number >= 500ms', 'duration', p.duration);
    }

    return {
      selector: normalizeSelector(p.selector),
      duration: p.duration,
      metrics: p.metrics
    };
  }

  private validateDetectAudioIssuesParams(params: unknown): DetectAudioIssuesParams {
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
      checkDuration: p.checkDuration
    };
  }

  // Additional audio testing methods that were in the original specification

  async getAudioElementsDetailed(params: unknown, sessionId?: string): Promise<MCPToolResult<GetAudioElementsResult>> {
    // This is an alias for getAudioElements with more detailed extraction
    return this.getAudioElements(params, sessionId);
  }

  async getCurrentAudioState(params: unknown, sessionId?: string): Promise<MCPToolResult<{ state: AudioState }>> {
    const startTime = Date.now();
    this.logger.info('Executing get_current_audio_state tool', { params, sessionId });

    try {
      const { selector } = this.validateBasicSelectorParams(params);

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      const element = await findElementWithRetry(session.driver, selector, 3, this.logger);
      const state = await getAudioState(session.driver, element, this.logger);

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'getCurrentAudioState', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: { state }
      };

    } catch (error) {
      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'getCurrentAudioState', (params as any)?.selector, false, Date.now() - startTime);
      }
      return createErrorResponse(error instanceof Error ? error : new Error('Get current audio state failed'));
    }
  }

  private validateBasicSelectorParams(params: unknown): { selector: string } {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;
    if (!p.selector || typeof p.selector !== 'string') {
      throw new ValidationError('selector is required and must be a string', 'selector', p.selector);
    }

    return { selector: normalizeSelector(p.selector) };
  }
}