import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// Load test configuration
export let options = {
  stages: [
    { duration: '30s', target: 5 },   // Ramp up to 5 users
    { duration: '2m', target: 10 },   // Stay at 10 users for 2 minutes
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '2m', target: 20 },   // Stay at 20 users for 2 minutes
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete within 2s
    http_req_failed: ['rate<0.05'],    // Error rate must be less than 5%
    checks: ['rate>0.95'],             // 95% of checks must pass
  },
};

// Test data
const testUrls = new SharedArray('urls', function () {
  return [
    'https://example.com',
    'https://httpbin.org/html',
    'https://jsonplaceholder.typicode.com/',
    'https://www.google.com',
    'https://github.com'
  ];
});

const serverUrl = 'http://localhost:3000';

export default function () {
  // Test 1: Health check
  testHealthEndpoint();

  // Test 2: Session management
  testSessionManagement();

  // Test 3: Navigation tools
  testNavigationTools();

  // Test 4: Audio testing (if available)
  testAudioCapabilities();

  // Test 5: Performance tools
  testPerformanceTools();

  sleep(1);
}

function testHealthEndpoint() {
  const response = http.get(`${serverUrl}/health/live`);

  check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
    'health check contains status': (r) => r.json('status') !== undefined,
  });
}

function testSessionManagement() {
  // Create session
  const createPayload = JSON.stringify({
    tool: 'create_session',
    arguments: {
      browserType: 'chrome',
      headless: true
    }
  });

  const createResponse = http.post(`${serverUrl}/tools/execute`, createPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  let sessionId;
  const createCheck = check(createResponse, {
    'create session status is 200': (r) => r.status === 200,
    'create session returns sessionId': (r) => {
      const data = r.json();
      sessionId = data.data?.sessionId;
      return sessionId !== undefined;
    },
    'create session response time < 5s': (r) => r.timings.duration < 5000,
  });

  if (!createCheck || !sessionId) {
    console.log('Failed to create session, skipping session tests');
    return;
  }

  // List sessions
  const listPayload = JSON.stringify({
    tool: 'list_sessions',
    arguments: {}
  });

  const listResponse = http.post(`${serverUrl}/tools/execute`, listPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(listResponse, {
    'list sessions status is 200': (r) => r.status === 200,
    'list sessions contains sessions': (r) => {
      const data = r.json();
      return data.data?.sessions !== undefined;
    },
  });

  // Get session info
  const infoPayload = JSON.stringify({
    tool: 'get_session_info',
    arguments: { sessionId }
  });

  const infoResponse = http.post(`${serverUrl}/tools/execute`, infoPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(infoResponse, {
    'session info status is 200': (r) => r.status === 200,
    'session info contains data': (r) => {
      const data = r.json();
      return data.data?.id === sessionId;
    },
  });

  // Close session
  const closePayload = JSON.stringify({
    tool: 'close_session',
    arguments: { sessionId }
  });

  const closeResponse = http.post(`${serverUrl}/tools/execute`, closePayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(closeResponse, {
    'close session status is 200': (r) => r.status === 200,
  });
}

function testNavigationTools() {
  // Create session for navigation testing
  const createPayload = JSON.stringify({
    tool: 'create_session',
    arguments: { browserType: 'chrome', headless: true }
  });

  const createResponse = http.post(`${serverUrl}/tools/execute`, createPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const sessionId = createResponse.json('data.sessionId');
  if (!sessionId) return;

  // Test navigation
  const testUrl = testUrls[Math.floor(Math.random() * testUrls.length)];
  const navPayload = JSON.stringify({
    tool: 'navigate_to',
    arguments: {
      url: testUrl,
      waitUntil: 'load',
      timeout: 10000,
      sessionId
    }
  });

  const navResponse = http.post(`${serverUrl}/tools/execute`, navPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(navResponse, {
    'navigation status is 200': (r) => r.status === 200,
    'navigation successful': (r) => r.json('status') === 'success',
    'navigation response time < 10s': (r) => r.timings.duration < 10000,
  });

  // Get current URL
  const urlPayload = JSON.stringify({
    tool: 'get_current_url',
    arguments: { sessionId }
  });

  const urlResponse = http.post(`${serverUrl}/tools/execute`, urlPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(urlResponse, {
    'get_current_url status is 200': (r) => r.status === 200,
    'get_current_url returns URL': (r) => {
      const data = r.json();
      return data.data?.url !== undefined;
    },
  });

  // Take screenshot
  const screenshotPayload = JSON.stringify({
    tool: 'take_screenshot',
    arguments: {
      format: 'png',
      sessionId
    }
  });

  const screenshotResponse = http.post(`${serverUrl}/tools/execute`, screenshotPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(screenshotResponse, {
    'screenshot status is 200': (r) => r.status === 200,
    'screenshot returns data': (r) => r.json('data.data') !== undefined,
  });

  // Cleanup
  http.post(`${serverUrl}/tools/execute`, JSON.stringify({
    tool: 'close_session',
    arguments: { sessionId }
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function testAudioCapabilities() {
  // Create session
  const createResponse = http.post(`${serverUrl}/tools/execute`, JSON.stringify({
    tool: 'create_session',
    arguments: { browserType: 'chrome', headless: true }
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const sessionId = createResponse.json('data.sessionId');
  if (!sessionId) return;

  // Navigate to audio test page
  const navResponse = http.post(`${serverUrl}/tools/execute`, JSON.stringify({
    tool: 'navigate_to',
    arguments: {
      url: 'data:text/html,<audio controls autoplay><source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiN1O+XSAoUWbTo66dhGQk+ltryxnkpBSl+zPLaizsIGGS57OOUTAoPU6fj8LZjHAY+ltryxnkpBSl+zPLaizsIGGS57OOUTAoPU6fj8LZjHAY+ltryxnkpBSl+zPLaizsIGGS57OOUTAoPU6fj8LZjHAY+ltryxnkpBSl+zPLaizsIGGS57OOUTAoPU6fj8LZjHAY+ltryxnkpBSl+zPLaizsIGGS57OOUTAoPU6fj8LZjHAY+ltryxnkpBSl+zPLaizsIGGS57OOUTAoPU6fj8LZjHAY+ltryxnkpBSl+zPLaizsIGGS57OOUTAoPU6fj8LZjHAY+ltryxnkpBSl+zPLaizsIGGS57OOUTAo=" type="audio/wav"></audio>',
      sessionId
    }
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  // Test audio element discovery
  const audioElementsResponse = http.post(`${serverUrl}/tools/execute`, JSON.stringify({
    tool: 'get_audio_elements',
    arguments: { sessionId }
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(audioElementsResponse, {
    'audio elements status is 200': (r) => r.status === 200,
    'audio elements found': (r) => {
      const data = r.json();
      return data.data?.total > 0;
    },
  });

  // Test real audio playback detection (Revolutionary Feature)
  const playbackResponse = http.post(`${serverUrl}/tools/execute`, JSON.stringify({
    tool: 'check_audio_playing',
    arguments: {
      checkInterval: 100,
      sampleDuration: 1000,
      sessionId
    }
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(playbackResponse, {
    'audio playback check status is 200': (r) => r.status === 200,
    'audio playback check returns data': (r) => {
      const data = r.json();
      return data.data?.isPlaying !== undefined;
    },
  });

  // Cleanup
  http.post(`${serverUrl}/tools/execute`, JSON.stringify({
    tool: 'close_session',
    arguments: { sessionId }
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function testPerformanceTools() {
  // Create session
  const createResponse = http.post(`${serverUrl}/tools/execute`, JSON.stringify({
    tool: 'create_session',
    arguments: { browserType: 'chrome', headless: true }
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const sessionId = createResponse.json('data.sessionId');
  if (!sessionId) return;

  // Navigate to test page
  http.post(`${serverUrl}/tools/execute`, JSON.stringify({
    tool: 'navigate_to',
    arguments: {
      url: 'https://example.com',
      sessionId
    }
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  // Test performance metrics
  const perfResponse = http.post(`${serverUrl}/tools/execute`, JSON.stringify({
    tool: 'get_performance_metrics',
    arguments: { sessionId }
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(perfResponse, {
    'performance metrics status is 200': (r) => r.status === 200,
    'performance metrics contains data': (r) => {
      const data = r.json();
      return data.data?.metrics !== undefined;
    },
  });

  // Cleanup
  http.post(`${serverUrl}/tools/execute`, JSON.stringify({
    tool: 'close_session',
    arguments: { sessionId }
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    'load-test-summary.txt': `
MCP Browser Control Server Load Test Results
============================================

Test Duration: ${data.state.testRunDurationMs}ms
Virtual Users: ${data.options.stages.map(s => s.target).join(' → ')}

HTTP Request Metrics:
- Total Requests: ${data.metrics.http_reqs.values.count}
- Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s
- Average Duration: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
- 95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
- Failed Requests: ${data.metrics.http_req_failed.values.rate.toFixed(4)}%

Performance Summary:
- Checks Passed: ${(data.metrics.checks.values.rate * 100).toFixed(2)}%
- Data Received: ${(data.metrics.data_received.values.count / 1024 / 1024).toFixed(2)}MB
- Data Sent: ${(data.metrics.data_sent.values.count / 1024 / 1024).toFixed(2)}MB

Status: ${data.metrics.http_req_failed.values.rate < 0.05 && data.metrics.checks.values.rate > 0.95 ? 'PASS' : 'FAIL'}
`
  };
}