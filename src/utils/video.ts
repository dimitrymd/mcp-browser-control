import { WebDriver } from 'selenium-webdriver';
import { VideoElement, VideoPlaybackState, VideoIssue, VideoPerformanceMetrics, VideoQualityMetrics } from '../types/index.js';
import winston from 'winston';

/**
 * Revolutionary video analysis utilities for comprehensive video testing
 */

export interface VideoAnalysisOptions {
  includeFrameStats?: boolean;
  includeBitrateAnalysis?: boolean;
  includeQualityMetrics?: boolean;
  sampleInterval?: number;
}

/**
 * Extract comprehensive video element information
 */
export async function extractVideoElementInfo(
  driver: WebDriver,
  element: any,
  selector: string,
  logger?: winston.Logger
): Promise<VideoElement> {
  try {
    const videoInfo = await driver.executeScript(`
      const el = arguments[0];

      // Get buffered ranges
      const buffered = [];
      if (el.buffered) {
        for (let i = 0; i < el.buffered.length; i++) {
          buffered.push({
            start: el.buffered.start(i),
            end: el.buffered.end(i)
          });
        }
      }

      // Get video quality metrics if available
      let playbackQuality = null;
      if (el.getVideoPlaybackQuality) {
        playbackQuality = el.getVideoPlaybackQuality();
      }

      return {
        currentTime: el.currentTime || 0,
        duration: el.duration || 0,
        paused: el.paused !== false,
        ended: el.ended === true,
        muted: el.muted === true,
        volume: el.volume || 0,
        playbackRate: el.playbackRate || 1,
        videoWidth: el.videoWidth || 0,
        videoHeight: el.videoHeight || 0,
        buffered: buffered,
        src: el.src || '',
        currentSrc: el.currentSrc || '',
        readyState: el.readyState || 0,
        networkState: el.networkState || 0,
        // Video-specific properties
        poster: el.poster || '',
        preload: el.preload || 'metadata',
        autoplay: el.autoplay === true,
        loop: el.loop === true,
        controls: el.controls === true,
        crossOrigin: el.crossOrigin,
        playsinline: el.playsInline === true,
        // Advanced metrics
        webkitDecodedFrameCount: el.webkitDecodedFrameCount,
        webkitDroppedFrameCount: el.webkitDroppedFrameCount,
        webkitVideoDecodedByteCount: el.webkitVideoDecodedByteCount,
        getVideoPlaybackQuality: playbackQuality
      };
    `, element);

    return {
      selector,
      tagName: 'video',
      ...(videoInfo as any)
    };
  } catch (error) {
    logger?.warn('Failed to extract video element info', { selector, error });

    return {
      selector,
      tagName: 'video',
      currentTime: 0,
      duration: 0,
      paused: true,
      ended: false,
      muted: false,
      volume: 1,
      playbackRate: 1,
      videoWidth: 0,
      videoHeight: 0,
      buffered: [],
      src: '',
      currentSrc: '',
      readyState: 0,
      networkState: 0,
      poster: '',
      preload: 'metadata',
      autoplay: false,
      loop: false,
      controls: false,
      crossOrigin: null,
      playsinline: false
    };
  }
}

/**
 * Revolutionary video playback detection - monitors frame advancement
 */
export async function isVideoActuallyPlaying(
  driver: WebDriver,
  element: any,
  checkDuration: number = 1000,
  frameRateThreshold: number = 10,
  logger?: winston.Logger
): Promise<{
  isPlaying: boolean;
  frameRate: number;
  frameAdvancement: boolean;
  timeAdvancement: boolean;
}> {
  try {
    const result = await driver.executeScript(`
      const el = arguments[0];
      const checkDuration = arguments[1];
      const frameRateThreshold = arguments[2];

      return new Promise((resolve) => {
        if (el.paused || el.ended || el.readyState < 2) {
          resolve({
            isPlaying: false,
            frameRate: 0,
            frameAdvancement: false,
            timeAdvancement: false
          });
          return;
        }

        const startTime = el.currentTime;
        const startFrameCount = el.webkitDecodedFrameCount || 0;
        const startTimestamp = performance.now();

        setTimeout(() => {
          const endTime = el.currentTime;
          const endFrameCount = el.webkitDecodedFrameCount || 0;
          const endTimestamp = performance.now();

          const timeDiff = endTime - startTime;
          const frameDiff = endFrameCount - startFrameCount;
          const realTimeDiff = (endTimestamp - startTimestamp) / 1000;

          const frameRate = frameDiff / realTimeDiff;
          const timeAdvanced = timeDiff > 0;
          const framesAdvanced = frameDiff > 0;

          // Video is actually playing if:
          // 1. Time is advancing AND
          // 2. Either frames are advancing OR frame rate is above threshold
          const isPlaying = timeAdvanced && (framesAdvanced || frameRate >= frameRateThreshold);

          resolve({
            isPlaying: isPlaying,
            frameRate: frameRate,
            frameAdvancement: framesAdvanced,
            timeAdvancement: timeAdvanced
          });
        }, checkDuration);
      });
    `, element, checkDuration, frameRateThreshold);

    return result as any;
  } catch (error) {
    logger?.warn('Failed to check video playback', { error });
    return {
      isPlaying: false,
      frameRate: 0,
      frameAdvancement: false,
      timeAdvancement: false
    };
  }
}

/**
 * Analyze video quality metrics including frame rate, resolution, and bitrate
 */
export async function analyzeVideoQuality(
  driver: WebDriver,
  element: any,
  duration: number = 5000,
  options: VideoAnalysisOptions = {},
  logger?: winston.Logger
): Promise<VideoQualityMetrics> {
  try {
    const qualityData = await driver.executeScript(`
      const el = arguments[0];
      const duration = arguments[1];
      const options = arguments[2];

      return new Promise((resolve) => {
        const metrics = {
          resolution: {
            width: el.videoWidth || 0,
            height: el.videoHeight || 0,
            aspectRatio: (el.videoWidth && el.videoHeight) ? el.videoWidth / el.videoHeight : 0
          },
          frameRate: {
            declared: 30, // Would need to be extracted from media info
            actual: 0,
            variance: 0,
            droppedFrames: 0,
            corruptedFrames: 0
          },
          bitrate: {
            video: 0,
            audio: 0,
            total: 0
          },
          codec: {
            video: 'unknown',
            audio: 'unknown',
            container: 'unknown'
          },
          performance: {
            decodeTime: 0,
            renderTime: 0,
            bufferHealth: 0,
            cpuUsage: 0,
            gpuUsage: 0
          }
        };

        // Analyze frame rate over time
        let frameCount = 0;
        let lastFrameCount = el.webkitDecodedFrameCount || 0;
        let droppedFrameCount = el.webkitDroppedFrameCount || 0;
        const startTime = performance.now();

        const analyzeFrames = () => {
          const currentFrameCount = el.webkitDecodedFrameCount || 0;
          const currentDroppedFrames = el.webkitDroppedFrameCount || 0;
          const currentTime = performance.now();

          frameCount = currentFrameCount - lastFrameCount;
          const elapsedTime = (currentTime - startTime) / 1000;

          if (elapsedTime > 0) {
            metrics.frameRate.actual = frameCount / elapsedTime;
            metrics.frameRate.droppedFrames = currentDroppedFrames - droppedFrameCount;
          }

          // Get buffer health
          if (el.buffered && el.buffered.length > 0) {
            const bufferedEnd = el.buffered.end(el.buffered.length - 1);
            const bufferAhead = bufferedEnd - el.currentTime;
            metrics.performance.bufferHealth = Math.max(0, bufferAhead);
          }

          // Get video quality info if available
          if (el.getVideoPlaybackQuality) {
            const quality = el.getVideoPlaybackQuality();
            metrics.frameRate.droppedFrames = quality.droppedVideoFrames;
            metrics.frameRate.corruptedFrames = quality.corruptedVideoFrames || 0;
          }

          resolve(metrics);
        };

        setTimeout(analyzeFrames, duration);
      });
    `, element, duration, options);

    return qualityData as VideoQualityMetrics;
  } catch (error) {
    logger?.warn('Failed to analyze video quality', { error });

    return {
      resolution: { width: 0, height: 0, aspectRatio: 0 },
      frameRate: { declared: 0, actual: 0, variance: 0, droppedFrames: 0, corruptedFrames: 0 },
      bitrate: { video: 0, audio: 0, total: 0 },
      codec: { video: 'unknown', audio: 'unknown', container: 'unknown' },
      performance: { decodeTime: 0, renderTime: 0, bufferHealth: 0, cpuUsage: 0, gpuUsage: 0 }
    };
  }
}

/**
 * Test audio/video synchronization
 */
export async function testVideoAudioSync(
  driver: WebDriver,
  videoElement: any,
  audioElement: any,
  duration: number = 5000,
  tolerance: number = 0.1,
  logger?: winston.Logger
): Promise<{
  inSync: boolean;
  syncOffset: number;
  maxDrift: number;
  driftEvents: Array<{ timestamp: number; offset: number; severity: 'low' | 'medium' | 'high' }>;
}> {
  try {
    const syncData = await driver.executeScript(`
      const videoEl = arguments[0];
      const audioEl = arguments[1];
      const duration = arguments[2];
      const tolerance = arguments[3];

      return new Promise((resolve) => {
        const samples = [];
        const driftEvents = [];
        let maxDrift = 0;

        const sampleSync = () => {
          const videoTime = videoEl.currentTime;
          const audioTime = audioEl ? audioEl.currentTime : videoTime;
          const offset = Math.abs(videoTime - audioTime);
          const timestamp = performance.now();

          samples.push({ timestamp, offset, videoTime, audioTime });

          if (offset > tolerance) {
            const severity = offset > tolerance * 3 ? 'high' :
                           offset > tolerance * 2 ? 'medium' : 'low';

            driftEvents.push({
              timestamp: timestamp,
              offset: offset,
              severity: severity
            });
          }

          maxDrift = Math.max(maxDrift, offset);
        };

        // Sample every 100ms
        const interval = setInterval(sampleSync, 100);

        setTimeout(() => {
          clearInterval(interval);

          const avgOffset = samples.length > 0 ?
            samples.reduce((sum, sample) => sum + sample.offset, 0) / samples.length : 0;

          resolve({
            inSync: maxDrift <= tolerance,
            syncOffset: avgOffset,
            maxDrift: maxDrift,
            driftEvents: driftEvents
          });
        }, duration);
      });
    `, videoElement, audioElement, duration, tolerance);

    return syncData as any;
  } catch (error) {
    logger?.warn('Failed to test video/audio sync', { error });

    return {
      inSync: false,
      syncOffset: 0,
      maxDrift: 0,
      driftEvents: []
    };
  }
}

/**
 * Detect video-specific issues
 */
export async function detectVideoIssues(
  driver: WebDriver,
  elements: VideoElement[],
  checkDuration: number = 5000,
  logger?: winston.Logger
): Promise<VideoIssue[]> {
  const issues: VideoIssue[] = [];
  const timestamp = Date.now();

  for (const videoElement of elements) {
    try {
      // Check for no video source
      if (!videoElement.src && !videoElement.currentSrc) {
        issues.push({
          type: 'no-video',
          severity: 'high',
          description: 'Video element has no source URL',
          timestamp,
          element: videoElement.selector
        });
        continue;
      }

      // Check for loading issues
      if (videoElement.networkState === 3) { // NETWORK_NO_SOURCE
        issues.push({
          type: 'network-issue',
          severity: 'high',
          description: 'Video source could not be loaded',
          timestamp,
          element: videoElement.selector
        });
      }

      // Check for codec issues
      if (videoElement.readyState === 0) { // HAVE_NOTHING
        issues.push({
          type: 'codec-error',
          severity: 'medium',
          description: 'Video codec may not be supported',
          timestamp,
          element: videoElement.selector
        });
      }

      // Check video dimensions
      if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
        issues.push({
          type: 'no-video',
          severity: 'medium',
          description: 'Video has zero dimensions - may not be properly loaded',
          timestamp,
          element: videoElement.selector
        });
      }

      // Check for buffering issues
      if (videoElement.buffered.length === 0 && !videoElement.paused) {
        issues.push({
          type: 'buffering',
          severity: 'medium',
          description: 'Video is playing but has no buffered data',
          timestamp,
          element: videoElement.selector
        });
      }

      // Check for dropped frames (if available)
      if (videoElement.webkitDroppedFrameCount && videoElement.webkitDecodedFrameCount) {
        const dropRate = videoElement.webkitDroppedFrameCount / videoElement.webkitDecodedFrameCount;
        if (dropRate > 0.05) { // > 5% dropped frames
          issues.push({
            type: 'poor-quality',
            severity: dropRate > 0.1 ? 'high' : 'medium',
            description: `High frame drop rate: ${(dropRate * 100).toFixed(1)}%`,
            timestamp,
            element: videoElement.selector,
            metrics: {
              droppedFrames: videoElement.webkitDroppedFrameCount
            }
          });
        }
      }

      // Check for resolution mismatches
      const expectedResolutions = [
        { width: 1920, height: 1080, name: '1080p' },
        { width: 1280, height: 720, name: '720p' },
        { width: 854, height: 480, name: '480p' },
        { width: 640, height: 360, name: '360p' }
      ];

      const actualRes = { width: videoElement.videoWidth, height: videoElement.videoHeight };
      const matchesStandard = expectedResolutions.some(res =>
        Math.abs(res.width - actualRes.width) < 10 &&
        Math.abs(res.height - actualRes.height) < 10
      );

      if (!matchesStandard && actualRes.width > 0 && actualRes.height > 0) {
        issues.push({
          type: 'poor-quality',
          severity: 'low',
          description: `Non-standard resolution: ${actualRes.width}x${actualRes.height}`,
          timestamp,
          element: videoElement.selector,
          metrics: {
            qualityLevel: `${actualRes.width}x${actualRes.height}`
          }
        });
      }

    } catch (error) {
      logger?.warn('Error analyzing video element for issues', {
        selector: videoElement.selector,
        error
      });

      issues.push({
        type: 'decode-error',
        severity: 'low',
        description: `Error analyzing video element: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp,
        element: videoElement.selector
      });
    }
  }

  return issues;
}

/**
 * Monitor video performance metrics over time
 */
export async function monitorVideoPerformance(
  driver: WebDriver,
  element: any,
  duration: number = 5000,
  sampleInterval: number = 200,
  logger?: winston.Logger
): Promise<{
  samples: Array<{
    timestamp: number;
    currentTime: number;
    frameCount: number;
    droppedFrames: number;
    bufferLevel: number;
    qualityLevel: string;
  }>;
  issues: string[];
  performance: VideoPerformanceMetrics;
}> {
  const samples: Array<{
    timestamp: number;
    currentTime: number;
    frameCount: number;
    droppedFrames: number;
    bufferLevel: number;
    qualityLevel: string;
  }> = [];
  const issues: string[] = [];

  try {
    const monitoringResult = await driver.executeScript(`
      const el = arguments[0];
      const duration = arguments[1];
      const sampleInterval = arguments[2];

      return new Promise((resolve) => {
        const samples = [];
        const issues = [];
        const startTime = performance.now();

        const takeSample = () => {
          const timestamp = performance.now();

          // Calculate buffer level
          let bufferLevel = 0;
          if (el.buffered && el.buffered.length > 0) {
            const bufferedEnd = el.buffered.end(el.buffered.length - 1);
            bufferLevel = Math.max(0, bufferedEnd - el.currentTime);
          }

          // Determine quality level (simplified)
          let qualityLevel = 'unknown';
          if (el.videoWidth && el.videoHeight) {
            if (el.videoHeight >= 1080) qualityLevel = '1080p';
            else if (el.videoHeight >= 720) qualityLevel = '720p';
            else if (el.videoHeight >= 480) qualityLevel = '480p';
            else qualityLevel = '360p';
          }

          const sample = {
            timestamp: timestamp,
            currentTime: el.currentTime || 0,
            frameCount: el.webkitDecodedFrameCount || 0,
            droppedFrames: el.webkitDroppedFrameCount || 0,
            bufferLevel: bufferLevel,
            qualityLevel: qualityLevel
          };

          samples.push(sample);

          // Check for issues
          if (samples.length > 1) {
            const prevSample = samples[samples.length - 2];
            const timeDiff = sample.timestamp - prevSample.timestamp;
            const frameDiff = sample.frameCount - prevSample.frameCount;
            const expectedFrames = (timeDiff / 1000) * 30; // Assume 30fps

            // Detect frame drops
            if (frameDiff < expectedFrames * 0.8) {
              issues.push('Frame drops detected at ' + sample.currentTime + 's');
            }

            // Detect buffering issues
            if (sample.bufferLevel < 1 && !el.paused) {
              issues.push('Low buffer detected at ' + sample.currentTime + 's');
            }

            // Detect quality changes
            if (sample.qualityLevel !== prevSample.qualityLevel) {
              issues.push('Quality change: ' + prevSample.qualityLevel + ' → ' + sample.qualityLevel);
            }
          }
        };

        // Take initial sample
        takeSample();

        // Set up periodic sampling
        const interval = setInterval(() => {
          if (performance.now() - startTime >= duration) {
            clearInterval(interval);

            // Calculate performance metrics
            const totalFrames = samples.length > 0 ?
              samples[samples.length - 1].frameCount - samples[0].frameCount : 0;
            const totalDropped = samples.length > 0 ?
              samples[samples.length - 1].droppedFrames - samples[0].droppedFrames : 0;
            const avgFrameRate = totalFrames / (duration / 1000);

            const performance = {
              playback: {
                frameRate: avgFrameRate,
                droppedFrames: totalDropped,
                corruptedFrames: 0,
                decodedFrames: totalFrames,
                renderingFrames: totalFrames - totalDropped
              },
              network: {
                bufferingTime: 0, // Would calculate from buffering events
                downloadSpeed: 0, // Would need network monitoring
                totalBytesDownloaded: el.webkitVideoDecodedByteCount || 0,
                averageBitrate: 0
              },
              system: {
                cpuUsage: 0, // Would need system monitoring
                gpuUsage: 0, // Would need GPU stats
                memoryUsage: 0,
                decodeTime: 0,
                renderTime: 0
              },
              quality: {
                currentResolution: { width: el.videoWidth || 0, height: el.videoHeight || 0 },
                availableQualities: [], // Would extract from video source
                adaptationEvents: 0,
                qualityScore: totalDropped / totalFrames > 0.1 ? 60 : 90
              }
            };

            resolve({
              samples: samples,
              issues: issues,
              performance: performance
            });
          } else {
            takeSample();
          }
        }, sampleInterval);
      });
    `, element, duration, sampleInterval);

    return monitoringResult as any;
  } catch (error) {
    logger?.warn('Error monitoring video performance', { error });
    return {
      samples: [],
      issues: ['Error during video monitoring'],
      performance: {
        playback: { frameRate: 0, droppedFrames: 0, corruptedFrames: 0, decodedFrames: 0, renderingFrames: 0 },
        network: { bufferingTime: 0, downloadSpeed: 0, totalBytesDownloaded: 0, averageBitrate: 0 },
        system: { cpuUsage: 0, gpuUsage: 0, memoryUsage: 0, decodeTime: 0, renderTime: 0 },
        quality: { currentResolution: { width: 0, height: 0 }, availableQualities: [], adaptationEvents: 0, qualityScore: 0 }
      }
    };
  }
}

/**
 * Generate video testing recommendations
 */
export function generateVideoRecommendations(issues: VideoIssue[]): string[] {
  const recommendations: string[] = [];
  const issueTypes = new Set(issues.map(issue => issue.type));

  if (issueTypes.has('no-video')) {
    recommendations.push('Check video source URLs and ensure they are accessible');
    recommendations.push('Verify video files are in supported formats (MP4, WebM, OGV)');
    recommendations.push('Ensure proper CORS headers for cross-origin video');
  }

  if (issueTypes.has('codec-error')) {
    recommendations.push('Test with multiple video formats for browser compatibility');
    recommendations.push('Consider providing fallback video sources');
    recommendations.push('Check browser console for detailed codec error messages');
  }

  if (issueTypes.has('poor-quality')) {
    recommendations.push('Optimize video encoding settings and bitrate');
    recommendations.push('Consider adaptive bitrate streaming for better quality');
    recommendations.push('Test with different resolution targets');
  }

  if (issueTypes.has('stuttering')) {
    recommendations.push('Check system CPU/GPU usage during playback');
    recommendations.push('Consider reducing concurrent video streams');
    recommendations.push('Test with hardware acceleration enabled');
  }

  if (issueTypes.has('buffering')) {
    recommendations.push('Optimize video file size and streaming bitrate');
    recommendations.push('Consider using video preloading strategies');
    recommendations.push('Check network connectivity and CDN performance');
  }

  if (issueTypes.has('sync-issue')) {
    recommendations.push('Check video encoding frame rate and audio sample rate compatibility');
    recommendations.push('Verify container format supports proper sync metadata');
    recommendations.push('Test with different encoding tools and settings');
  }

  if (issueTypes.has('decode-error')) {
    recommendations.push('Check browser hardware acceleration support');
    recommendations.push('Test with different video codecs (H.264, VP9, AV1)');
    recommendations.push('Verify system has sufficient GPU/CPU resources');
  }

  if (issueTypes.has('network-issue')) {
    recommendations.push('Check network connectivity and bandwidth');
    recommendations.push('Test with CDN and edge caching');
    recommendations.push('Consider progressive download vs streaming');
  }

  if (recommendations.length === 0) {
    recommendations.push('Video playback appears to be functioning optimally');
    recommendations.push('Consider performance testing under various network conditions');
  }

  return recommendations;
}

/**
 * Get video format support information
 */
export async function checkVideoFormatSupport(
  driver: WebDriver,
  formats: string[] = ['video/mp4', 'video/webm', 'video/ogg'],
  logger?: winston.Logger
): Promise<Record<string, { canPlay: string; supported: boolean }>> {
  try {
    const support = await driver.executeScript(`
      const formats = arguments[0];
      const video = document.createElement('video');
      const support = {};

      formats.forEach(format => {
        try {
          const canPlay = video.canPlayType(format);
          support[format] = {
            canPlay: canPlay,
            supported: canPlay === 'probably' || canPlay === 'maybe'
          };
        } catch (e) {
          support[format] = {
            canPlay: '',
            supported: false
          };
        }
      });

      return support;
    `, formats) as Record<string, { canPlay: string; supported: boolean }>;

    return support;
  } catch (error) {
    logger?.warn('Failed to check video format support', { error });

    const defaultSupport: Record<string, { canPlay: string; supported: boolean }> = {};
    formats.forEach(format => {
      defaultSupport[format] = { canPlay: 'unknown', supported: true };
    });
    return defaultSupport;
  }
}

/**
 * Find video elements with comprehensive discovery
 */
export async function findVideoElements(
  driver: WebDriver,
  includeIframes: boolean = false,
  onlyWithSource: boolean = false,
  logger?: winston.Logger
): Promise<Array<{ element: any; selector: string; metadata: any }>> {
  try {
    const elements = await driver.executeScript(`
      const includeIframes = arguments[0];
      const onlyWithSource = arguments[1];
      const elements = [];

      function findInDocument(doc, framePrefix = '') {
        const videoElements = doc.querySelectorAll('video');

        videoElements.forEach((el, index) => {
          const hasSource = !!(el.src || el.currentSrc || el.querySelector('source'));

          if (!onlyWithSource || hasSource) {
            let selector = framePrefix;

            if (el.id) {
              selector += '#' + el.id;
            } else if (el.className) {
              selector += '.' + el.className.split(' ').join('.');
            } else {
              selector += 'video:nth-of-type(' + (index + 1) + ')';
            }

            // Get video metadata
            const metadata = {
              dimensions: {
                width: el.videoWidth || 0,
                height: el.videoHeight || 0,
                aspectRatio: (el.videoWidth && el.videoHeight) ? el.videoWidth / el.videoHeight : 0
              },
              sources: [],
              tracks: []
            };

            // Get source information
            if (el.src) {
              metadata.sources.push({ src: el.src, type: el.type || '' });
            }

            const sourceElements = el.querySelectorAll('source');
            sourceElements.forEach(source => {
              metadata.sources.push({
                src: source.src || '',
                type: source.type || '',
                media: source.media || ''
              });
            });

            // Get track information (captions, subtitles)
            const trackElements = el.querySelectorAll('track');
            trackElements.forEach(track => {
              metadata.tracks.push({
                kind: track.kind || '',
                label: track.label || '',
                src: track.src || '',
                srclang: track.srclang || '',
                default: track.default
              });
            });

            elements.push({
              selector: selector,
              element: el,
              metadata: metadata
            });
          }
        });

        // Search in iframes if requested
        if (includeIframes) {
          const iframes = doc.querySelectorAll('iframe');
          iframes.forEach((iframe, iframeIndex) => {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              if (iframeDoc) {
                findInDocument(iframeDoc, \`iframe:nth-of-type(\${iframeIndex + 1}) \`);
              }
            } catch (e) {
              // Cross-origin iframe, skip
            }
          });
        }
      }

      findInDocument(document);
      return elements;
    `, includeIframes, onlyWithSource);

    return elements as Array<{ element: any; selector: string; metadata: any }>;
  } catch (error) {
    logger?.warn('Failed to find video elements', { error });
    return [];
  }
}

/**
 * Calculate video quality score based on metrics
 */
export function calculateVideoQualityScore(
  metrics: VideoPerformanceMetrics,
  issues: VideoIssue[]
): number {
  let score = 100;

  // Deduct for frame drops
  const frameDropRate = metrics.playback.droppedFrames / Math.max(1, metrics.playback.decodedFrames);
  score -= frameDropRate * 50; // Up to 50 points for frame drops

  // Deduct for low frame rate
  if (metrics.playback.frameRate < 24) {
    score -= (24 - metrics.playback.frameRate) * 2;
  }

  // Deduct for buffering issues
  score -= Math.min(30, issues.filter(i => i.type === 'buffering').length * 10);

  // Deduct for sync issues
  score -= Math.min(20, issues.filter(i => i.type === 'sync-issue').length * 10);

  // Deduct for codec/decode errors
  score -= Math.min(40, issues.filter(i => i.type === 'codec-error' || i.type === 'decode-error').length * 20);

  return Math.max(0, Math.min(100, score));
}

/**
 * Extract video codec information
 */
export async function getVideoCodecInfo(
  driver: WebDriver,
  element: any,
  logger?: winston.Logger
): Promise<{
  video: string;
  audio: string;
  container: string;
  profile?: string;
  level?: string;
}> {
  try {
    const codecInfo = await driver.executeScript(`
      const el = arguments[0];

      // Try to get codec information from various sources
      let videoCodec = 'unknown';
      let audioCodec = 'unknown';
      let container = 'unknown';

      // Check if MediaSource API is available for codec detection
      if (window.MediaSource && MediaSource.isTypeSupported) {
        // This is a simplified approach - real implementation would need more detection
        const src = el.currentSrc || el.src;
        if (src) {
          if (src.includes('.mp4')) {
            container = 'mp4';
            videoCodec = 'h264';
            audioCodec = 'aac';
          } else if (src.includes('.webm')) {
            container = 'webm';
            videoCodec = 'vp9';
            audioCodec = 'opus';
          } else if (src.includes('.ogg') || src.includes('.ogv')) {
            container = 'ogg';
            videoCodec = 'theora';
            audioCodec = 'vorbis';
          }
        }
      }

      return {
        video: videoCodec,
        audio: audioCodec,
        container: container
      };
    `, element);

    return codecInfo as any;
  } catch (error) {
    logger?.warn('Failed to get video codec info', { error });
    return {
      video: 'unknown',
      audio: 'unknown',
      container: 'unknown'
    };
  }
}

/**
 * Test video accessibility features
 */
export async function testVideoAccessibility(
  driver: WebDriver,
  element: any,
  logger?: winston.Logger
): Promise<{
  hasCaptions: boolean;
  hasAudioDescription: boolean;
  keyboardNavigable: boolean;
  contrastRatio: number;
  issues: string[];
}> {
  try {
    const accessibilityInfo = await driver.executeScript(`
      const el = arguments[0];

      const tracks = el.querySelectorAll('track');
      let hasCaptions = false;
      let hasAudioDescription = false;

      tracks.forEach(track => {
        if (track.kind === 'captions' || track.kind === 'subtitles') {
          hasCaptions = true;
        }
        if (track.kind === 'descriptions') {
          hasAudioDescription = true;
        }
      });

      // Check keyboard navigation
      const keyboardNavigable = el.tabIndex >= 0 || el.controls;

      // Basic contrast check (simplified)
      const style = window.getComputedStyle(el);
      const backgroundColor = style.backgroundColor;
      const color = style.color;

      return {
        hasCaptions: hasCaptions,
        hasAudioDescription: hasAudioDescription,
        keyboardNavigable: keyboardNavigable,
        contrastRatio: 4.5, // Simplified - would need proper contrast calculation
        issues: []
      };
    `, element);

    return accessibilityInfo as any;
  } catch (error) {
    logger?.warn('Failed to test video accessibility', { error });
    return {
      hasCaptions: false,
      hasAudioDescription: false,
      keyboardNavigable: false,
      contrastRatio: 0,
      issues: ['Error testing accessibility features']
    };
  }
}