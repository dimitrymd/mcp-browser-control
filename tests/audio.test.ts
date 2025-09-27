import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { WebDriver } from 'selenium-webdriver';
import winston from 'winston';

import { AudioTools } from '../src/tools/audio.js';
import { SessionManager } from '../src/drivers/session.js';

// Mock all utilities with simple implementations
vi.mock('../src/utils/audio.js', () => ({
  findAudioElements: vi.fn().mockResolvedValue([{ element: {}, selector: '#audio1' }]),
  extractAudioElementInfo: vi.fn().mockResolvedValue({
    selector: '#audio1',
    tagName: 'audio',
    currentTime: 0,
    duration: 100,
    paused: true,
    ended: false,
    muted: false,
    volume: 1,
    playbackRate: 1,
    buffered: [],
    src: 'test.mp3',
    currentSrc: 'test.mp3',
    readyState: 4,
    networkState: 1
  }),
  isAudioActuallyPlaying: vi.fn().mockResolvedValue(false),
  getAudioState: vi.fn().mockResolvedValue({
    currentTime: 0,
    duration: 100,
    paused: true,
    muted: false,
    volume: 1,
    playbackRate: 1,
    ended: false,
    readyState: 4
  }),
  detectAudioIssues: vi.fn().mockResolvedValue([]),
  generateAudioRecommendations: vi.fn().mockReturnValue(['No issues found']),
  monitorAudioPerformance: vi.fn().mockResolvedValue({
    samples: [{ timestamp: 1000, currentTime: 0, buffered: 0 }],
    issues: []
  })
}));

vi.mock('../src/utils/elements.js', () => ({
  findElementWithRetry: vi.fn().mockResolvedValue({
    getTagName: vi.fn().mockResolvedValue('audio')
  })
}));

const mockLogger = winston.createLogger({
  level: 'error',
  silent: true,
  transports: [],
});

describe('AudioTools - Core Functionality', () => {
  let audioTools: AudioTools;
  let sessionManager: SessionManager;

  beforeEach(() => {
    const driverManager = {
      createDriver: vi.fn().mockResolvedValue({
        executeScript: vi.fn().mockResolvedValue({}),
        findElement: vi.fn().mockResolvedValue({})
      }),
      validateDriver: vi.fn().mockResolvedValue(true),
      closeDriver: vi.fn().mockResolvedValue(undefined),
      checkDriverHealth: vi.fn().mockResolvedValue({ isHealthy: true, details: {} })
    };

    sessionManager = new SessionManager(driverManager as any, mockLogger, 5, 600000);
    audioTools = new AudioTools(sessionManager, mockLogger);
  });

  afterEach(async () => {
    await sessionManager.shutdown();
  });

  describe('Parameter validation', () => {
    it('should validate check_audio_playing parameters', async () => {
      const result = await audioTools.checkAudioPlaying({
        checkInterval: 50 // Too short
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate control_audio_playback action', async () => {
      const result = await audioTools.controlAudioPlayback({
        selector: '#audio1',
        action: 'invalid-action'
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate monitor_audio_events duration', async () => {
      const result = await audioTools.monitorAudioEvents({
        duration: 50 // Too short
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate analyze_audio_performance parameters', async () => {
      const result = await audioTools.analyzeAudioPerformance({
        selector: '#audio1',
        duration: 100 // Too short
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });
  });

  describe('Tool integration', () => {
    it('should handle missing sessionId gracefully', async () => {
      const result = await audioTools.checkAudioPlaying({});

      // Should get error due to no active sessions
      expect(result.status).toBe('error');
    });

    it('should validate volume range in control_audio_playback', async () => {
      const result = await audioTools.controlAudioPlayback({
        selector: '#audio1',
        action: 'play',
        volume: 1.5 // Invalid range
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });

    it('should validate playback rate range', async () => {
      const result = await audioTools.controlAudioPlayback({
        selector: '#audio1',
        action: 'play',
        playbackRate: 5.0 // Too high
      });

      expect(result.status).toBe('error');
      expect(['E004', 'E999']).toContain(result.error?.code);
    });
  });
});