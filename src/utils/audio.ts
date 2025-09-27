import { WebDriver } from 'selenium-webdriver';
import { AudioElement, AudioState, AudioIssue } from '../types/index.js';
import winston from 'winston';

/**
 * Audio utility functions for browser audio testing
 */

export interface AudioContextState {
  state: 'suspended' | 'running' | 'closed';
  sampleRate: number;
  currentTime: number;
  destination: {
    maxChannelCount: number;
    channelCount: number;
  };
}

export interface AudioAnalysis {
  hasAudio: boolean;
  averageLevel: number;
  peakLevel: number;
  duration: number;
  silentPeriods: Array<{ start: number; end: number }>;
  clippingDetected: boolean;
}

/**
 * Get Web Audio API context state from the browser
 */
export async function getWebAudioState(driver: WebDriver): Promise<AudioContextState | null> {
  try {
    const state = await driver.executeScript(`
      if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        const AudioContextClass = AudioContext || webkitAudioContext;

        // Try to get existing context or create a test one
        let context;
        try {
          context = new AudioContextClass();
        } catch (e) {
          return null;
        }

        const result = {
          state: context.state,
          sampleRate: context.sampleRate,
          currentTime: context.currentTime,
          destination: {
            maxChannelCount: context.destination.maxChannelCount,
            channelCount: context.destination.channelCount
          }
        };

        // Clean up test context
        if (context.state !== 'closed') {
          try {
            context.close();
          } catch (e) {
            // Ignore cleanup errors
          }
        }

        return result;
      }
      return null;
    `) as AudioContextState | null;

    return state;
  } catch (error) {
    return null;
  }
}

/**
 * Extract detailed audio element information from the page
 */
export async function extractAudioElementInfo(
  driver: WebDriver,
  element: any,
  selector: string,
  logger?: winston.Logger
): Promise<AudioElement> {
  try {
    const audioInfo = await driver.executeScript(`
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

      return {
        currentTime: el.currentTime || 0,
        duration: el.duration || 0,
        paused: el.paused !== false,
        ended: el.ended === true,
        muted: el.muted === true,
        volume: el.volume || 0,
        playbackRate: el.playbackRate || 1,
        buffered: buffered,
        src: el.src || '',
        currentSrc: el.currentSrc || '',
        readyState: el.readyState || 0,
        networkState: el.networkState || 0
      };
    `, element);

    const tagName = await element.getTagName();

    return {
      selector,
      tagName: tagName.toLowerCase() as 'audio' | 'video',
      ...audioInfo
    };
  } catch (error) {
    logger?.warn('Failed to extract audio element info', { selector, error });

    // Return default values if extraction fails
    return {
      selector,
      tagName: 'audio',
      currentTime: 0,
      duration: 0,
      paused: true,
      ended: false,
      muted: false,
      volume: 1,
      playbackRate: 1,
      buffered: [],
      src: '',
      currentSrc: '',
      readyState: 0,
      networkState: 0
    };
  }
}

/**
 * Check if audio is actually playing by monitoring currentTime changes
 */
export async function isAudioActuallyPlaying(
  driver: WebDriver,
  element: any,
  checkDuration: number = 500,
  checkInterval: number = 100,
  logger?: winston.Logger
): Promise<boolean> {
  try {
    const result = await driver.executeScript(`
      const el = arguments[0];
      const checkDuration = arguments[1];
      const checkInterval = arguments[2];

      return new Promise((resolve) => {
        if (el.paused || el.ended || el.readyState < 2) {
          resolve(false);
          return;
        }

        const startTime = el.currentTime;
        const startTimestamp = Date.now();

        const checkProgress = () => {
          const now = Date.now();
          const elapsed = now - startTimestamp;

          if (elapsed >= checkDuration) {
            const currentTime = el.currentTime;
            const timeAdvanced = currentTime > startTime;
            resolve(timeAdvanced);
            return;
          }

          setTimeout(checkProgress, checkInterval);
        };

        setTimeout(checkProgress, checkInterval);
      });
    `, element, checkDuration, checkInterval);

    return result as boolean;
  } catch (error) {
    logger?.warn('Failed to check audio playback state', { error });
    return false;
  }
}

/**
 * Get comprehensive audio state including Web Audio API context
 */
export async function getAudioState(
  driver: WebDriver,
  element: any,
  logger?: winston.Logger
): Promise<AudioState> {
  try {
    const state = await driver.executeScript(`
      const el = arguments[0];

      return {
        currentTime: el.currentTime || 0,
        duration: el.duration || 0,
        paused: el.paused !== false,
        muted: el.muted === true,
        volume: el.volume || 0,
        playbackRate: el.playbackRate || 1,
        ended: el.ended === true,
        readyState: el.readyState || 0
      };
    `, element) as AudioState;

    return state;
  } catch (error) {
    logger?.warn('Failed to get audio state', { error });

    return {
      currentTime: 0,
      duration: 0,
      paused: true,
      muted: false,
      volume: 1,
      playbackRate: 1,
      ended: false,
      readyState: 0
    };
  }
}

/**
 * Detect potential audio issues
 */
export async function detectAudioIssues(
  driver: WebDriver,
  elements: AudioElement[],
  checkDuration: number = 5000,
  logger?: winston.Logger
): Promise<AudioIssue[]> {
  const issues: AudioIssue[] = [];
  const timestamp = Date.now();

  for (const audioElement of elements) {
    try {
      // Check for no audio source
      if (!audioElement.src && !audioElement.currentSrc) {
        issues.push({
          type: 'no-audio',
          severity: 'high',
          description: 'Audio element has no source URL',
          timestamp,
          element: audioElement.selector
        });
        continue;
      }

      // Check for loading issues
      if (audioElement.networkState === 3) { // NETWORK_NO_SOURCE
        issues.push({
          type: 'no-audio',
          severity: 'high',
          description: 'Audio source could not be loaded',
          timestamp,
          element: audioElement.selector
        });
      }

      // Check for codec issues
      if (audioElement.readyState === 0) { // HAVE_NOTHING
        issues.push({
          type: 'codec-error',
          severity: 'medium',
          description: 'Audio codec may not be supported',
          timestamp,
          element: audioElement.selector
        });
      }

      // Check for buffering issues
      if (audioElement.buffered.length === 0 && !audioElement.paused) {
        issues.push({
          type: 'buffering',
          severity: 'medium',
          description: 'Audio is playing but has no buffered data',
          timestamp,
          element: audioElement.selector
        });
      }

      // Check for sync issues (if video)
      if (audioElement.tagName === 'video' && audioElement.currentTime > 0) {
        // This would require more sophisticated analysis
        // For now, we'll skip sync issue detection
      }

    } catch (error) {
      logger?.warn('Error analyzing audio element for issues', {
        selector: audioElement.selector,
        error
      });

      issues.push({
        type: 'codec-error',
        severity: 'low',
        description: `Error analyzing audio element: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp,
        element: audioElement.selector
      });
    }
  }

  return issues;
}

/**
 * Calculate RMS (Root Mean Square) level of audio samples
 */
export function calculateRMS(samples: Float32Array): number {
  if (!samples || samples.length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }

  return Math.sqrt(sum / samples.length);
}

/**
 * Detect silence in audio samples
 */
export function detectSilence(
  samples: Float32Array,
  threshold: number = 0.01
): boolean {
  if (!samples || samples.length === 0) return true;

  const rms = calculateRMS(samples);
  return rms < threshold;
}

/**
 * Detect audio clipping
 */
export function detectClipping(
  samples: Float32Array,
  threshold: number = 0.99
): boolean {
  if (!samples || samples.length === 0) return false;

  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) >= threshold) {
      return true;
    }
  }

  return false;
}

/**
 * Analyze audio buffer for quality metrics
 */
export function analyzeAudioBuffer(buffer: ArrayBuffer): AudioAnalysis {
  try {
    // Convert ArrayBuffer to Float32Array (simplified analysis)
    const samples = new Float32Array(buffer);

    const averageLevel = calculateRMS(samples);
    const peakLevel = Math.max(...Array.from(samples).map(Math.abs));
    const clippingDetected = detectClipping(samples);

    // Detect silent periods (simplified)
    const silentPeriods: Array<{ start: number; end: number }> = [];
    let silentStart = -1;
    const sampleRate = 44100; // Assume standard sample rate

    for (let i = 0; i < samples.length; i += 1024) {
      const chunk = samples.slice(i, i + 1024);
      const isSilent = detectSilence(chunk);
      const timeSeconds = i / sampleRate;

      if (isSilent && silentStart === -1) {
        silentStart = timeSeconds;
      } else if (!isSilent && silentStart !== -1) {
        silentPeriods.push({ start: silentStart, end: timeSeconds });
        silentStart = -1;
      }
    }

    return {
      hasAudio: averageLevel > 0.001,
      averageLevel,
      peakLevel,
      duration: samples.length / sampleRate,
      silentPeriods,
      clippingDetected
    };
  } catch (error) {
    return {
      hasAudio: false,
      averageLevel: 0,
      peakLevel: 0,
      duration: 0,
      silentPeriods: [],
      clippingDetected: false
    };
  }
}

/**
 * Create audio context for testing (browser-side)
 */
export async function createAudioContext(driver: WebDriver): Promise<boolean> {
  try {
    const result = await driver.executeScript(`
      if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        const AudioContextClass = AudioContext || webkitAudioContext;

        try {
          window.testAudioContext = new AudioContextClass();
          return true;
        } catch (e) {
          return false;
        }
      }
      return false;
    `) as boolean;

    return result;
  } catch (error) {
    return false;
  }
}

/**
 * Monitor audio playback for performance issues
 */
export async function monitorAudioPerformance(
  driver: WebDriver,
  element: any,
  duration: number = 5000,
  logger?: winston.Logger
): Promise<{
  samples: Array<{ timestamp: number; currentTime: number; buffered: number }>;
  issues: string[];
}> {
  const samples: Array<{ timestamp: number; currentTime: number; buffered: number }> = [];
  const issues: string[] = [];
  const startTime = Date.now();

  try {
    while (Date.now() - startTime < duration) {
      const sample = await driver.executeScript(`
        const el = arguments[0];

        let bufferedTime = 0;
        if (el.buffered && el.buffered.length > 0) {
          bufferedTime = el.buffered.end(el.buffered.length - 1);
        }

        return {
          timestamp: Date.now(),
          currentTime: el.currentTime || 0,
          buffered: bufferedTime
        };
      `, element);

      samples.push(sample as any);

      // Check for issues
      const sampleData = sample as any;
      if (samples.length > 1) {
        const previousSample = samples[samples.length - 2];
        const timeDiff = sampleData.timestamp - previousSample.timestamp;
        const playbackDiff = sampleData.currentTime - previousSample.currentTime;

        // Detect stuttering (time not advancing properly)
        if (timeDiff > 200 && playbackDiff < timeDiff / 1000 * 0.5) {
          issues.push(`Potential stuttering detected at ${sampleData.currentTime}s`);
        }

        // Detect buffering issues
        if (sampleData.buffered < sampleData.currentTime + 2) {
          issues.push(`Low buffer detected at ${sampleData.currentTime}s`);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { samples, issues };
  } catch (error) {
    logger?.warn('Error monitoring audio performance', { error });
    return { samples, issues: ['Error during monitoring'] };
  }
}

/**
 * Generate audio testing recommendations based on detected issues
 */
export function generateAudioRecommendations(issues: AudioIssue[]): string[] {
  const recommendations: string[] = [];
  const issueTypes = new Set(issues.map(issue => issue.type));

  if (issueTypes.has('no-audio')) {
    recommendations.push('Check audio source URLs and ensure they are accessible');
    recommendations.push('Verify audio files are in supported formats (MP3, OGG, WAV)');
    recommendations.push('Ensure proper CORS headers for cross-origin audio');
  }

  if (issueTypes.has('codec-error')) {
    recommendations.push('Test with multiple audio formats for browser compatibility');
    recommendations.push('Consider providing fallback audio sources');
    recommendations.push('Check browser console for detailed codec error messages');
  }

  if (issueTypes.has('buffering')) {
    recommendations.push('Optimize audio file size and bitrate');
    recommendations.push('Consider using audio preloading strategies');
    recommendations.push('Check network connectivity and server response times');
  }

  if (issueTypes.has('stuttering')) {
    recommendations.push('Check system CPU usage during playback');
    recommendations.push('Consider reducing concurrent audio streams');
    recommendations.push('Test with different audio buffer sizes');
  }

  if (issueTypes.has('sync-issue')) {
    recommendations.push('Check video/audio synchronization timing');
    recommendations.push('Verify frame rate and audio sample rate compatibility');
    recommendations.push('Consider using different encoding settings');
  }

  if (recommendations.length === 0) {
    recommendations.push('Audio playback appears to be functioning normally');
    recommendations.push('Monitor for any user-reported audio issues');
  }

  return recommendations;
}

/**
 * Get audio element selector using multiple strategies
 */
export async function findAudioElements(
  driver: WebDriver,
  includeIframes: boolean = false,
  onlyWithSource: boolean = false,
  logger?: winston.Logger
): Promise<Array<{ element: any; selector: string }>> {
  try {
    const elements = await driver.executeScript(`
      const includeIframes = arguments[0];
      const onlyWithSource = arguments[1];
      const elements = [];

      function findInDocument(doc, framePrefix = '') {
        // Find audio and video elements
        const audioElements = doc.querySelectorAll('audio, video');

        audioElements.forEach((el, index) => {
          const hasSource = !!(el.src || el.currentSrc || el.querySelector('source'));

          if (!onlyWithSource || hasSource) {
            let selector = framePrefix;

            // Generate best possible selector
            if (el.id) {
              selector += '#' + el.id;
            } else if (el.className) {
              selector += '.' + el.className.split(' ').join('.');
            } else {
              selector += el.tagName.toLowerCase() + ':nth-of-type(' + (index + 1) + ')';
            }

            elements.push({
              selector: selector,
              element: el
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

      return elements.map(item => ({
        selector: item.selector,
        // Return element reference for WebDriver
        element: item.element
      }));
    `, includeIframes, onlyWithSource);

    return elements as Array<{ element: any; selector: string }>;
  } catch (error) {
    logger?.warn('Failed to find audio elements', { error });
    return [];
  }
}

/**
 * Validate audio format support
 */
export async function checkAudioFormatSupport(
  driver: WebDriver,
  formats: string[] = ['audio/mpeg', 'audio/ogg', 'audio/wav'],
  logger?: winston.Logger
): Promise<Record<string, boolean>> {
  try {
    const support = await driver.executeScript(`
      const formats = arguments[0];
      const audio = document.createElement('audio');
      const support = {};

      formats.forEach(format => {
        try {
          const canPlay = audio.canPlayType(format);
          support[format] = canPlay === 'probably' || canPlay === 'maybe';
        } catch (e) {
          support[format] = false;
        }
      });

      return support;
    `, formats) as Record<string, boolean>;

    return support;
  } catch (error) {
    logger?.warn('Failed to check audio format support', { error });

    // Return default support for common formats
    const defaultSupport: Record<string, boolean> = {};
    formats.forEach(format => {
      defaultSupport[format] = true; // Assume support
    });
    return defaultSupport;
  }
}