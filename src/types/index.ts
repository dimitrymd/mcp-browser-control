import { WebDriver } from 'selenium-webdriver';

export interface ServerConfig {
  name: string;
  version: string;
  selenium: {
    gridUrl?: string;
    browserType: 'chrome' | 'firefox';
    headless: boolean;
  };
  session: {
    maxConcurrent: number;
    timeout: number;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
    console: boolean;
  };
}

export interface BrowserSession {
  id: string;
  driver: WebDriver;
  createdAt: number;
  lastUsed: number;
  url: string;
  title: string;
  isReady: boolean;
  browserType: 'chrome' | 'firefox';
  // Enhanced tracking features
  activeElement?: string | undefined;
  scrollPosition: { x: number; y: number };
  actionHistory: Array<{
    action: string;
    timestamp: number;
    selector?: string | undefined;
    success: boolean;
    duration?: number | undefined;
  }>;
  performanceMetrics: {
    totalActions: number;
    successfulActions: number;
    averageActionTime: number;
    lastActionTime?: number | undefined;
  };
}

export interface SessionState {
  url: string;
  title: string;
  readyState: string;
}

export interface NavigationResult {
  success: boolean;
  url: string;
  title?: string;
  loadTime?: number;
  error?: string;
}

export interface MCPToolResult<T = any> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface NavigateToParams {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded';
  timeout?: number;
}

export interface RefreshParams {
  hard?: boolean;
}

export type WaitCondition = 'load' | 'domcontentloaded';

export interface DriverOptions {
  headless: boolean;
  windowSize?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
}

export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  averageSessionAge: number;
  failedSessions: number;
}

export interface ToolExecutionContext {
  sessionId?: string;
  userId?: string;
  requestId: string;
  timestamp: number;
}

// Sprint 2 Types - Element Interaction and Extraction

export interface ClickParams {
  selector: string;
  clickType?: 'left' | 'right' | 'middle' | 'double';
  waitForElement?: boolean;
  timeout?: number;
  scrollIntoView?: boolean;
}

export interface ClickResult {
  success: boolean;
  element: {
    tag: string;
    text: string;
    attributes: Record<string, string>;
  };
  coordinates: { x: number; y: number };
}

export interface TypeTextParams {
  selector: string;
  text: string;
  clear?: boolean;
  delay?: number;
  pressEnter?: boolean;
}

export interface TypeTextResult {
  success: boolean;
  finalValue: string;
}

export interface SelectDropdownParams {
  selector: string;
  value?: string;
  text?: string;
  index?: number;
}

export interface SelectDropdownResult {
  success: boolean;
  selectedOption: {
    value: string;
    text: string;
    index: number;
  };
}

export interface HoverParams {
  selector: string;
  duration?: number;
  offset?: { x: number; y: number };
}

export interface HoverResult {
  success: boolean;
  element: {
    tag: string;
    text: string;
  };
}

export interface ScrollToParams {
  selector?: string | undefined;
  x?: number;
  y?: number;
  behavior?: 'auto' | 'smooth';
}

export interface ScrollToResult {
  success: boolean;
  scrollPosition: { x: number; y: number };
}

export interface GetPageContentParams {
  format: 'html' | 'text' | 'markdown';
  selector?: string | undefined;
  includeHidden?: boolean;
}

export interface GetPageContentResult {
  content: string;
  path?: string;
  metadata: {
    title: string;
    url: string;
    length: number;
  };
}

export interface GetElementTextParams {
  selector: string;
  all?: boolean;
  trim?: boolean;
}

export interface GetElementTextResult {
  text: string | string[];
  count: number;
}

export interface GetElementAttributeParams {
  selector: string;
  attribute: string;
  all?: boolean;
}

export interface GetElementAttributeResult {
  value: string | string[] | null;
  elements: number;
}

export interface TakeScreenshotParams {
  fullPage?: boolean;
  selector?: string | undefined;
  format?: 'png' | 'jpeg' | 'base64';
  quality?: number;
  path?: string;
}

export interface TakeScreenshotResult {
  data: string;
  path?: string;
  dimensions: { width: number; height: number };
}

export interface GetElementPropertiesParams {
  selector: string;
  properties: string[];
}

export interface GetElementPropertiesResult {
  properties: Record<string, string>;
  computed: boolean;
}

// SEO Performance Analysis Types
export interface CoreWebVitalsParams {
  sessionId?: string;
  mobile?: boolean;
  includeFieldData?: boolean;
}

export interface CoreWebVitalsResult {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  inp: number; // Interaction to Next Paint
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
  score: {
    performance: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    recommendations: string[];
  };
  fieldData?: {
    origin: string;
    realUserMetrics: Record<string, number>;
  };
}

export interface PagePerformanceParams {
  sessionId?: string;
  duration?: number;
  includeResources?: boolean;
}

export interface PagePerformanceResult {
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  resources: Record<string, any>[];
  networkRequests: number;
  totalSize: number;
  optimizationOpportunities: Record<string, any>[];
}

export interface PageSpeedParams {
  sessionId?: string;
  strategy?: 'mobile' | 'desktop';
  category?: 'performance' | 'accessibility' | 'best-practices' | 'seo';
  includeScreenshot?: boolean;
}

export interface PageSpeedResult {
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  metrics: Record<string, any>;
  opportunities: Record<string, any>[];
  diagnostics: Record<string, any>[];
  screenshot?: string;
}

export interface PerformanceIssuesParams {
  sessionId?: string;
  thresholds?: Record<string, number>;
  monitoringDuration?: number;
}

export interface PerformanceIssuesResult {
  issues: Record<string, any>[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: {
    userExperience: number;
    searchRanking: number;
    conversionLoss: number;
  };
  recommendations: Record<string, any>[];
}

export interface BenchmarkPerformanceParams {
  sessionId?: string;
  industryType?: string;
  competitorUrls?: string[];
}

export interface BenchmarkPerformanceResult {
  currentMetrics: Record<string, any>;
  industryAverage: Record<string, any>;
  percentileRanking: number;
  competitorComparison?: Record<string, any>[];
  improvementPotential: {
    quickWins: Record<string, any>[];
    mediumTermGoals: Record<string, any>[];
    longTermOptimizations: Record<string, any>[];
  };
}

// Sprint 2: Competitive Intelligence & Advanced SEO Types
export interface CompetitorSEOParams {
  competitorUrls: string[];
  metrics?: string[];
  alertThresholds?: Record<string, number>;
  monitoringFrequency?: 'hourly' | 'daily' | 'weekly';
}

export interface CompetitorSEOResult {
  competitors: Record<string, any>[];
  benchmarks: Record<string, any>;
  opportunities: Record<string, any>[];
  threats: Record<string, any>[];
  recommendations: Record<string, any>[];
  alerts: Record<string, any>[];
}

export interface MetaAuditParams {
  sessionId?: string;
  includeOpenGraph?: boolean;
  includeTwitterCards?: boolean;
  checkDuplicates?: boolean;
}

export interface MetaAuditResult {
  title: {
    content: string;
    length: number;
    optimal: boolean;
    recommendations: string[];
  };
  description: {
    content: string;
    length: number;
    optimal: boolean;
    recommendations: string[];
  };
  headings: Record<string, any>[];
  openGraph: Record<string, any>;
  twitterCards: Record<string, any>;
  canonicalUrl: string;
  robotsMeta: Record<string, any>;
  issues: Record<string, any>[];
  score: number;
}

export interface SEOContentParams {
  sessionId?: string;
  targetKeywords?: string[];
  analyzeReadability?: boolean;
  checkDuplicateContent?: boolean;
}

export interface SEOContentResult {
  wordCount: number;
  readabilityScore: number;
  keywordDensity: Record<string, any>[];
  headingStructure: Record<string, any>;
  internalLinks: Record<string, any>;
  externalLinks: Record<string, any>;
  imageOptimization: Record<string, any>;
  contentQuality: {
    score: number;
    factors: Record<string, any>[];
    improvements: string[];
  };
}

// Sprint 3: Keyword Intelligence Types
export interface KeywordResearchParams {
  seedKeywords: string[];
  location?: string;
  language?: string;
  includeVolume?: boolean;
  includeDifficulty?: boolean;
  includeRelated?: boolean;
  maxResults?: number;
}

export interface KeywordResearchResult {
  keywords: {
    keyword: string;
    volume: number;
    difficulty: number;
    cpc: number;
    competition: 'low' | 'medium' | 'high';
    trend: 'rising' | 'stable' | 'declining';
  }[];
  relatedKeywords: string[];
  opportunities: {
    keyword: string;
    opportunity: 'high-volume-low-competition' | 'rising-trend' | 'competitor-gap';
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
  }[];
  analysis: {
    totalVolume: number;
    averageDifficulty: number;
    competitiveGaps: number;
    recommendations: string[];
  };
}

export interface KeywordRankingsParams {
  targetKeywords: string[];
  targetUrl: string;
  location?: string;
  device?: 'desktop' | 'mobile';
  includeCompetitors?: boolean;
}

export interface KeywordRankingsResult {
  rankings: {
    keyword: string;
    position: number;
    url: string;
    title: string;
    description: string;
    features: string[];
  }[];
  summary: {
    averagePosition: number;
    topTenCount: number;
    firstPageCount: number;
    visibilityScore: number;
  };
  competitors: {
    domain: string;
    averagePosition: number;
    keywords: string[];
  }[];
  opportunities: {
    keyword: string;
    currentPosition: number;
    opportunityType: 'improve-existing' | 'new-ranking' | 'featured-snippet';
    priority: 'high' | 'medium' | 'low';
  }[];
}

export interface WaitForElementParams {
  selector: string;
  condition: 'present' | 'visible' | 'clickable' | 'hidden' | 'removed';
  timeout?: number;
}

export interface WaitForElementResult {
  success: boolean;
  waitTime: number;
}

export interface WaitForTextParams {
  text: string;
  selector?: string | undefined;
  exact?: boolean;
  timeout?: number;
}

export interface WaitForTextResult {
  success: boolean;
  element: {
    selector: string;
    tag: string;
  };
}

export interface ElementExistsParams {
  selector: string;
  visible?: boolean;
}

export interface ElementExistsResult {
  exists: boolean;
  count: number;
  visible: number;
}

export interface EnhancedSessionState extends SessionState {
  activeElement?: string;
  scrollPosition: { x: number; y: number };
  actionHistory: Array<{
    action: string;
    timestamp: number;
    selector?: string;
    success: boolean;
  }>;
  performanceMetrics: {
    totalActions: number;
    successfulActions: number;
    averageActionTime: number;
    lastActionTime?: number | undefined;
  };
}

// Sprint 3 Types - Audio Testing & Advanced Features

export interface AudioElement {
  selector: string;
  tagName: 'audio' | 'video';
  currentTime: number;
  duration: number;
  paused: boolean;
  ended: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  buffered: Array<{ start: number; end: number }>;
  src: string;
  currentSrc: string;
  readyState: number;
  networkState: number;
}

export interface CheckAudioPlayingParams {
  selector?: string | undefined;
  checkInterval?: number;
  sampleDuration?: number;
}

export interface CheckAudioPlayingResult {
  isPlaying: boolean;
  elements: AudioElement[];
  activeCount: number;
}

export interface GetAudioElementsParams {
  includeIframes?: boolean;
  onlyWithSource?: boolean;
}

export interface AudioElementInfo {
  selector: string;
  tagName: string;
  hasSource: boolean;
  sources: Array<{ src: string; type: string }>;
  autoplay: boolean;
  controls: boolean;
  loop: boolean;
  preload: string;
  crossOrigin: string | null;
  mediaGroup: string;
  defaultMuted: boolean;
  defaultPlaybackRate: number;
}

export interface GetAudioElementsResult {
  elements: AudioElementInfo[];
  total: number;
  byType: { audio: number; video: number };
}

export interface AudioState {
  currentTime: number;
  duration: number;
  paused: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  ended: boolean;
  readyState: number;
}

export interface ControlAudioPlaybackParams {
  selector: string;
  action: 'play' | 'pause' | 'stop' | 'mute' | 'unmute' | 'toggle';
  volume?: number;
  seekTo?: number;
  playbackRate?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface ControlAudioPlaybackResult {
  success: boolean;
  previousState: AudioState;
  currentState: AudioState;
  error?: string;
}

export interface AudioEvent {
  timestamp: number;
  type: string;
  target: string;
  data: any;
}

export interface MonitorAudioEventsParams {
  selector?: string | undefined;
  duration: number;
  events?: string[];
  includeTimeUpdates?: boolean;
  throttle?: number;
}

export interface MonitorAudioEventsResult {
  events: AudioEvent[];
  summary: {
    playCount: number;
    pauseCount: number;
    totalPlayTime: number;
    bufferingEvents: number;
    errors: Array<{ type: string; message: string }>;
  };
}

export interface AudioPerformanceMetrics {
  bufferingTime: number;
  playbackTime: number;
  bufferRatio: number;
  averageBitrate: number;
  droppedFrames: number;
  decodedFrames: number;
  audioLatency: number;
  stutterEvents: number;
}

export interface AnalyzeAudioPerformanceParams {
  selector: string;
  duration: number;
  metrics?: string[];
}

export interface AnalyzeAudioPerformanceResult {
  performance: AudioPerformanceMetrics;
  timeline: Array<{ time: number; metric: string; value: any }>;
}

export interface AudioIssue {
  type: 'no-audio' | 'stuttering' | 'sync-issue' | 'buffering' | 'codec-error';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: number;
  element: string;
}

export interface DetectAudioIssuesParams {
  selector?: string | undefined;
  checkDuration?: number;
}

export interface DetectAudioIssuesResult {
  hasIssues: boolean;
  issues: AudioIssue[];
  recommendations: string[];
}

// JavaScript Execution Types

export interface ExecuteJavaScriptParams {
  script: string;
  args?: any[];
  async?: boolean;
  timeout?: number;
  context?: 'page' | 'isolated';
}

export interface ExecuteJavaScriptResult {
  result: any;
  console: Array<{ type: string; message: string }>;
  errors: Array<{ message: string; stack: string }>;
  executionTime: number;
}

export interface InjectScriptParams {
  url?: string | undefined;
  code?: string | undefined;
  type?: 'module' | 'text/javascript';
  defer?: boolean;
  async?: boolean;
  id?: string | undefined;
}

export interface InjectScriptResult {
  success: boolean;
  scriptId: string;
  loadTime: number;
}

export interface EvaluateExpressionParams {
  expression: string;
  returnType?: 'primitive' | 'json' | 'element';
}

export interface EvaluateExpressionResult {
  value: any;
  type: string;
  isNull: boolean;
  isUndefined: boolean;
}

// Dialog Handling Types

export interface HandleAlertParams {
  action: 'accept' | 'dismiss' | 'getText' | 'sendKeys';
  text?: string | undefined;
  timeout?: number;
}

export interface HandleAlertResult {
  handled: boolean;
  alertText: string;
  alertType: 'alert' | 'confirm' | 'prompt';
}

export interface SetDialogHandlerParams {
  enabled: boolean;
  autoAccept?: boolean;
  promptText?: string | undefined;
  callback?: string | undefined;
}

export interface SetDialogHandlerResult {
  success: boolean;
  previousHandler: any;
}

// Storage Management Types

export interface Cookie {
  name: string;
  value: string;
  domain?: string | undefined;
  path?: string | undefined;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  expires?: number | undefined;
}

export interface ManageCookiesParams {
  action: 'get' | 'set' | 'delete' | 'clear';
  cookie?: Cookie;
  filter?: { domain?: string; name?: string };
}

export interface ManageCookiesResult {
  cookies: Cookie[];
  affected: number;
}

export interface ManageStorageParams {
  storageType: 'localStorage' | 'sessionStorage';
  action: 'get' | 'set' | 'remove' | 'clear' | 'getAllKeys';
  key?: string | undefined;
  value?: any;
}

export interface ManageStorageResult {
  data: any;
  size: number;
  keys: string[];
}

export interface ClearBrowserDataParams {
  dataTypes: Array<'cookies' | 'localStorage' | 'sessionStorage' | 'indexedDB' | 'cache'>;
  timeRange?: { start?: number; end?: number };
}

export interface ClearBrowserDataResult {
  cleared: string[];
  errors: string[];
}

// Sprint 4 Types - Advanced Extraction & Multi-Window Support

// Advanced Data Extraction Types

export interface ExtractTableDataParams {
  selector: string;
  format: 'json' | 'csv' | 'array' | 'object';
  headers?: 'auto' | 'first-row' | 'custom' | string[];
  columnMapping?: Record<string, string>;
  skipRows?: number;
  maxRows?: number;
  cleanData?: boolean;
  parseNumbers?: boolean;
  parseDates?: boolean;
}

export interface TableMetadata {
  rows: number;
  columns: number;
  headers: string[];
  emptyCells: number;
  dataTypes: Record<string, string>;
}

export interface ExtractTableDataResult {
  data: any;
  metadata: TableMetadata;
  warnings: string[];
}

export interface FieldSchema {
  name: string;
  selector: string;
  attribute?: string;
  transform?: 'text' | 'number' | 'date' | 'boolean' | 'url';
  multiple?: boolean;
  required?: boolean;
  default?: any;
}

export interface ExtractionSchema {
  selector: string;
  fields: FieldSchema[];
  pagination?: {
    nextSelector: string;
    maxPages: number;
  };
}

export interface ExtractStructuredDataParams {
  schema: ExtractionSchema;
}

export interface ExtractStructuredDataResult {
  data: any[];
  pagesProcessed: number;
  errors: Array<{ field: string; error: string }>;
}

export interface FormField {
  name: string;
  type: string;
  value: any;
  options?: any[];
  required: boolean;
  validation?: string;
  label?: string;
}

export interface ExtractFormDataParams {
  selector?: string | undefined;
  includeHidden?: boolean;
  includeDisabled?: boolean;
  groupByName?: boolean;
}

export interface ExtractFormDataResult {
  fields: FormField[];
  formAction: string;
  formMethod: string;
}

export interface MediaInfo {
  type: string;
  src: string;
  alt?: string;
  dimensions?: { width: number; height: number };
  duration?: number;
  loaded: boolean;
  visible: boolean;
  naturalSize?: { width: number; height: number };
  fileSize?: number;
}

export interface ExtractMediaInfoParams {
  mediaType?: 'image' | 'video' | 'audio' | 'all';
  includeDimensions?: boolean;
  includeMetadata?: boolean;
  checkLoaded?: boolean;
}

export interface ExtractMediaInfoResult {
  media: MediaInfo[];
  total: number;
  byType: Record<string, number>;
}

export interface LinkInfo {
  href: string;
  text: string;
  title?: string;
  target?: string;
  rel?: string;
  isInternal: boolean;
  isValid?: boolean;
  statusCode?: number;
}

export interface ExtractLinksParams {
  internal?: boolean;
  external?: boolean;
  includeAnchors?: boolean;
  checkStatus?: boolean;
  pattern?: string;
}

export interface ExtractLinksResult {
  links: LinkInfo[];
  statistics: {
    total: number;
    internal: number;
    external: number;
    broken: number;
    anchors: number;
  };
}

// Window Management Types

export interface WindowInfo {
  handle: string;
  title: string;
  url: string;
  isActive: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface GetWindowsResult {
  windows: WindowInfo[];
  current: string;
  count: number;
}

export interface SwitchWindowParams {
  target: string | number;
  closeOthers?: boolean;
}

export interface SwitchWindowResult {
  success: boolean;
  previousWindow: string;
  currentWindow: string;
}

export interface OpenNewWindowParams {
  url?: string | undefined;
  type?: 'tab' | 'window';
  focus?: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface OpenNewWindowResult {
  handle: string;
  success: boolean;
}

export interface CloseWindowParams {
  handle?: string | undefined;
  force?: boolean;
}

export interface CloseWindowResult {
  success: boolean;
  remainingWindows: number;
}

export interface ArrangeWindowsParams {
  layout: 'cascade' | 'tile' | 'stack' | 'custom';
  windows?: string[];
  customLayout?: Array<{ handle: string; position: any; size: any }>;
}

export interface ArrangeWindowsResult {
  success: boolean;
  arrangement: WindowInfo[];
}

// iframe Support Types

export interface FrameInfo {
  id?: string;
  name?: string;
  src: string;
  index: number;
  selector: string;
  isAccessible: boolean;
  origin: string;
}

export interface GetFramesResult {
  frames: FrameInfo[];
  count: number;
  currentFrame: string | null;
}

export interface SwitchToFrameParams {
  target: string | number;
  waitForLoad?: boolean;
}

export interface SwitchToFrameResult {
  success: boolean;
  frameInfo: FrameInfo;
  previousContext: string;
}

export interface SwitchToParentFrameResult {
  success: boolean;
  currentContext: string;
}

export interface ExecuteInFrameParams {
  frame: string | number;
  script: string;
  args?: any[];
}

export interface ExecuteInFrameResult {
  result: any;
  frameContext: string;
}

// Network Monitoring Types

export interface StartNetworkCaptureParams {
  captureTypes: Array<'xhr' | 'fetch' | 'document' | 'script' | 'stylesheet' | 'image' | 'media' | 'font' | 'websocket'>;
  urlPattern?: string;
  includeHeaders?: boolean;
  includeBody?: boolean;
  maxSize?: number;
}

export interface StartNetworkCaptureResult {
  captureId: string;
  success: boolean;
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  responseHeaders: Record<string, string>;
  body?: any;
  responseBody?: any;
  startTime: number;
  endTime: number;
  duration: number;
  size: number;
  type: string;
  initiator?: string;
}

export interface NetworkSummary {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  totalSize: number;
  averageDuration: number;
}

export interface GetNetworkDataParams {
  captureId?: string;
  filter?: {
    status?: number[];
    method?: string[];
    url?: string;
    minDuration?: number;
    maxDuration?: number;
  };
}

export interface GetNetworkDataResult {
  requests: NetworkRequest[];
  summary: NetworkSummary;
}

export interface StopNetworkCaptureParams {
  captureId: string;
  getData?: boolean;
}

export interface StopNetworkCaptureResult {
  success: boolean;
  data?: GetNetworkDataResult;
}

export interface BlockRequestsParams {
  patterns: string[];
  action: 'block' | 'redirect' | 'modify';
  redirectUrl?: string;
  modifyHeaders?: Record<string, string>;
}

export interface BlockRequestsResult {
  success: boolean;
  blockedCount: number;
}

// Performance Profiling Types

export interface NavigationMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
}

export interface ResourceMetrics {
  count: number;
  totalSize: number;
  cachedSize: number;
  averageDuration: number;
}

export interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface PerformanceMetrics {
  navigation: NavigationMetrics;
  resources: ResourceMetrics;
  memory?: MemoryMetrics;
  fps?: number;
}

export interface GetPerformanceMetricsResult {
  metrics: PerformanceMetrics;
}

export interface ProfilePageLoadParams {
  url: string;
  iterations?: number;
  clearCache?: boolean;
  throttling?: {
    cpu: number;
    network: 'offline' | 'slow-2g' | 'fast-3g' | '4g';
  };
}

export interface LoadProfile {
  iteration: number;
  metrics: PerformanceMetrics;
  timestamp: number;
}

export interface ProfilePageLoadResult {
  profiles: LoadProfile[];
  averages: PerformanceMetrics;
  recommendations: string[];
}

export interface AnalyzeRenderPerformanceParams {
  duration: number;
  interactions?: Array<{ action: string; selector: string }>;
}

export interface RenderMetrics {
  fps: number[];
  jank: number;
  longTasks: Array<{ start: number; duration: number }>;
  layouts: number;
  paints: number;
  compositeLayers: number;
}

export interface AnalyzeRenderPerformanceResult {
  renderMetrics: RenderMetrics;
  issues: string[];
}

// Sprint 6 Types - Advanced Video Testing & Media Analysis

// Video Element and Playback Types

export interface VideoElement {
  selector: string;
  tagName: 'video';
  currentTime: number;
  duration: number;
  paused: boolean;
  ended: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  videoWidth: number;
  videoHeight: number;
  buffered: Array<{ start: number; end: number }>;
  src: string;
  currentSrc: string;
  readyState: number;
  networkState: number;
  // Video-specific properties
  poster?: string;
  preload: string;
  autoplay: boolean;
  loop: boolean;
  controls: boolean;
  crossOrigin: string | null;
  playsinline: boolean;
  // Advanced video metrics
  webkitDecodedFrameCount?: number;
  webkitDroppedFrameCount?: number;
  webkitVideoDecodedByteCount?: number;
  getVideoPlaybackQuality?: {
    droppedVideoFrames: number;
    totalVideoFrames: number;
    corruptedVideoFrames: number;
    creationTime: number;
  };
}

export interface CheckVideoPlayingParams {
  selector?: string | undefined;
  checkInterval?: number;
  sampleDuration?: number;
  frameRateThreshold?: number;
  qualityCheck?: boolean;
}

export interface CheckVideoPlayingResult {
  isPlaying: boolean;
  elements: VideoElement[];
  activeCount: number;
  qualityIssues?: Array<{
    element: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export interface VideoQualityMetrics {
  resolution: {
    width: number;
    height: number;
    aspectRatio: number;
  };
  frameRate: {
    declared: number;
    actual: number;
    variance: number;
    droppedFrames: number;
    corruptedFrames: number;
  };
  bitrate: {
    video: number;
    audio: number;
    total: number;
  };
  codec: {
    video: string;
    audio: string;
    container: string;
  };
  performance: {
    decodeTime: number;
    renderTime: number;
    bufferHealth: number;
    cpuUsage: number;
    gpuUsage: number;
  };
}

export interface AnalyzeVideoQualityParams {
  selector: string;
  duration: number;
  sampleInterval?: number;
  includeFrameAnalysis?: boolean;
  includeBitrateAnalysis?: boolean;
}

export interface AnalyzeVideoQualityResult {
  quality: VideoQualityMetrics;
  timeline: Array<{
    timestamp: number;
    frameRate: number;
    bufferLevel: number;
    qualityLevel: string;
  }>;
  recommendations: string[];
}

export interface VideoSyncTestParams {
  videoSelector: string;
  audioSelector?: string;
  duration: number;
  tolerance?: number;
}

export interface VideoSyncTestResult {
  inSync: boolean;
  syncOffset: number;
  maxDrift: number;
  driftEvents: Array<{
    timestamp: number;
    offset: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  recommendations: string[];
}

export interface ControlVideoPlaybackParams {
  selector: string;
  action: 'play' | 'pause' | 'stop' | 'mute' | 'unmute' | 'toggle' | 'fullscreen' | 'exitFullscreen' | 'pictureInPicture';
  volume?: number;
  seekTo?: number;
  playbackRate?: number;
  qualityLevel?: string;
  fadeIn?: number;
  fadeOut?: number;
}

export interface ControlVideoPlaybackResult {
  success: boolean;
  previousState: VideoPlaybackState;
  currentState: VideoPlaybackState;
  qualityChanged?: boolean;
  error?: string;
}

export interface VideoPlaybackState {
  currentTime: number;
  duration: number;
  paused: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  ended: boolean;
  readyState: number;
  videoWidth: number;
  videoHeight: number;
  fullscreen: boolean;
  pictureInPicture: boolean;
  qualityLevel?: string;
}

export interface MonitorVideoEventsParams {
  selector?: string | undefined;
  duration: number;
  events?: string[];
  includeQualityEvents?: boolean;
  includeFrameEvents?: boolean;
  throttle?: number;
}

export interface VideoEvent {
  timestamp: number;
  type: string;
  target: string;
  data: {
    currentTime?: number;
    videoWidth?: number;
    videoHeight?: number;
    readyState?: number;
    networkState?: number;
    qualityLevel?: string;
    frameRate?: number;
    droppedFrames?: number;
  };
}

export interface MonitorVideoEventsResult {
  events: VideoEvent[];
  summary: {
    playCount: number;
    pauseCount: number;
    qualityChanges: number;
    bufferingEvents: number;
    fullscreenToggles: number;
    errors: Array<{ type: string; message: string }>;
  };
}

export interface VideoIssue {
  type: 'no-video' | 'poor-quality' | 'stuttering' | 'sync-issue' | 'buffering' | 'codec-error' | 'decode-error' | 'network-issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
  element: string;
  metrics?: {
    frameRate?: number;
    droppedFrames?: number;
    bufferLevel?: number;
    qualityLevel?: string;
  };
}

export interface DetectVideoIssuesParams {
  selector?: string | undefined;
  checkDuration?: number;
  frameRateThreshold?: number;
  qualityThreshold?: number;
  bufferThreshold?: number;
}

export interface DetectVideoIssuesResult {
  hasIssues: boolean;
  issues: VideoIssue[];
  recommendations: string[];
  overallScore: number; // 0-100 quality score
}

export interface VideoPerformanceMetrics {
  playback: {
    frameRate: number;
    droppedFrames: number;
    corruptedFrames: number;
    decodedFrames: number;
    renderingFrames: number;
  };
  network: {
    bufferingTime: number;
    downloadSpeed: number;
    totalBytesDownloaded: number;
    averageBitrate: number;
  };
  system: {
    cpuUsage: number;
    gpuUsage: number;
    memoryUsage: number;
    decodeTime: number;
    renderTime: number;
  };
  quality: {
    currentResolution: { width: number; height: number };
    availableQualities: string[];
    adaptationEvents: number;
    qualityScore: number;
  };
}

export interface ProfileVideoPerformanceParams {
  selector: string;
  duration: number;
  includeSystemMetrics?: boolean;
  includeNetworkMetrics?: boolean;
  includeQualityMetrics?: boolean;
}

export interface ProfileVideoPerformanceResult {
  performance: VideoPerformanceMetrics;
  timeline: Array<{
    timestamp: number;
    frameRate: number;
    qualityLevel: string;
    bufferLevel: number;
    cpuUsage: number;
  }>;
  bottlenecks: Array<{
    type: 'cpu' | 'gpu' | 'network' | 'decode' | 'render';
    severity: 'low' | 'medium' | 'high';
    description: string;
    recommendations: string[];
  }>;
}

// Advanced Media Testing Types

export interface MediaStreamTestParams {
  videoSelector: string;
  testDuration: number;
  qualityLevels?: string[];
  networkConditions?: Array<{
    name: string;
    downloadSpeed: number;
    uploadSpeed: number;
    latency: number;
  }>;
}

export interface MediaStreamTestResult {
  adaptationPerformance: Array<{
    qualityLevel: string;
    switchTime: number;
    bufferingEvents: number;
    qualityScore: number;
  }>;
  networkResilience: {
    recoveryTime: number;
    qualityDegradation: number;
    userExperienceScore: number;
  };
  recommendations: string[];
}

export interface VideoAccessibilityParams {
  selector: string;
  checkCaptions?: boolean;
  checkAudioDescription?: boolean;
  checkKeyboardNavigation?: boolean;
}

export interface VideoAccessibilityResult {
  compliance: {
    captions: boolean;
    audioDescription: boolean;
    keyboardNavigation: boolean;
    contrastRatio: number;
    focusManagement: boolean;
  };
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    wcagGuideline: string;
  }>;
  score: number; // 0-100 accessibility score
}