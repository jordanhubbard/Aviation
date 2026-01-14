/**
 * k6 Load Testing Scenarios for Aviation Accident Tracker
 * 
 * Usage:
 *   k6 run load-tests/scenarios.js
 *   k6 run --vus 10 --duration 30s load-tests/scenarios.js
 *   k6 run --stage 30s:10 --stage 1m:50 --stage 30s:0 load-tests/scenarios.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const listDuration = new Trend('list_duration');
const detailDuration = new Trend('detail_duration');
const filterDuration = new Trend('filter_duration');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Performance targets
const TARGETS = {
  LIST_P95: 200,      // ms
  DETAIL_P95: 200,    // ms
  FILTER_P95: 300,    // ms
  ERROR_RATE: 0.01    // 1%
};

// Test configuration
export const options = {
  // Scenarios for different load patterns
  scenarios: {
    // Constant load test
    constant_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
      tags: { test_type: 'constant' },
    },
    
    // Ramp up test
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      tags: { test_type: 'ramp' },
    },
    
    // Spike test
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '10s', target: 100 }, // Spike
        { duration: '10s', target: 10 },
      ],
      tags: { test_type: 'spike' },
    },
    
    // Stress test
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 150 },
        { duration: '2m', target: 200 },
        { duration: '1m', target: 0 },
      ],
      tags: { test_type: 'stress' },
    },
  },
  
  // Thresholds for pass/fail
  thresholds: {
    'http_req_duration': ['p(95)<500'],  // 95% of requests should be below 500ms
    'http_req_duration{endpoint:list}': ['p(95)<200'],
    'http_req_duration{endpoint:detail}': ['p(95)<200'],
    'http_req_duration{endpoint:filter}': ['p(95)<300'],
    'http_req_failed': ['rate<0.01'],   // Error rate should be less than 1%
    'errors': ['rate<0.01'],
  },
};

/**
 * Test: List all events (paginated)
 */
export function testListEvents() {
  const params = {
    tags: { endpoint: 'list' },
  };
  
  const response = http.get(`${BASE_URL}/api/events?page=1&pageSize=50`, params);
  
  const success = check(response, {
    'list: status is 200': (r) => r.status === 200,
    'list: has events array': (r) => JSON.parse(r.body).events !== undefined,
    'list: response time < 200ms': (r) => r.timings.duration < TARGETS.LIST_P95,
  });
  
  errorRate.add(!success);
  listDuration.add(response.timings.duration);
  
  return response;
}

/**
 * Test: Get event detail
 */
export function testEventDetail(eventId) {
  const params = {
    tags: { endpoint: 'detail' },
  };
  
  const response = http.get(`${BASE_URL}/api/events/${eventId}`, params);
  
  const success = check(response, {
    'detail: status is 200': (r) => r.status === 200,
    'detail: has event data': (r) => JSON.parse(r.body).id !== undefined,
    'detail: response time < 200ms': (r) => r.timings.duration < TARGETS.DETAIL_P95,
  });
  
  errorRate.add(!success);
  detailDuration.add(response.timings.duration);
  
  return response;
}

/**
 * Test: Filter events by date range
 */
export function testFilterByDate() {
  const params = {
    tags: { endpoint: 'filter' },
  };
  
  const response = http.get(
    `${BASE_URL}/api/events?startDate=2024-01-01&endDate=2024-12-31&page=1&pageSize=50`,
    params
  );
  
  const success = check(response, {
    'filter: status is 200': (r) => r.status === 200,
    'filter: has events array': (r) => JSON.parse(r.body).events !== undefined,
    'filter: response time < 300ms': (r) => r.timings.duration < TARGETS.FILTER_P95,
  });
  
  errorRate.add(!success);
  filterDuration.add(response.timings.duration);
  
  return response;
}

/**
 * Test: Filter events by category
 */
export function testFilterByCategory(category = 'GA') {
  const params = {
    tags: { endpoint: 'filter' },
  };
  
  const response = http.get(
    `${BASE_URL}/api/events?category=${category}&page=1&pageSize=50`,
    params
  );
  
  const success = check(response, {
    'filter category: status is 200': (r) => r.status === 200,
    'filter category: has events array': (r) => JSON.parse(r.body).events !== undefined,
  });
  
  errorRate.add(!success);
  filterDuration.add(response.timings.duration);
  
  return response;
}

/**
 * Test: Search events by text
 */
export function testSearchEvents(query = 'engine') {
  const params = {
    tags: { endpoint: 'search' },
  };
  
  const response = http.get(
    `${BASE_URL}/api/events?search=${encodeURIComponent(query)}&page=1&pageSize=50`,
    params
  );
  
  const success = check(response, {
    'search: status is 200': (r) => r.status === 200,
    'search: has events array': (r) => JSON.parse(r.body).events !== undefined,
  });
  
  errorRate.add(!success);
  
  return response;
}

/**
 * Test: Health check
 */
export function testHealthCheck() {
  const response = http.get(`${BASE_URL}/api/health`);
  
  check(response, {
    'health: status is 200': (r) => r.status === 200,
    'health: status is healthy': (r) => JSON.parse(r.body).status === 'healthy',
  });
  
  return response;
}

/**
 * Main test scenario - Mixed realistic user behavior
 */
export default function () {
  // Health check (10% of requests)
  if (Math.random() < 0.1) {
    testHealthCheck();
    sleep(1);
    return;
  }
  
  // List events (40% of requests)
  if (Math.random() < 0.4) {
    testListEvents();
    sleep(1);
    return;
  }
  
  // Get event detail (30% of requests)
  if (Math.random() < 0.3) {
    // First get a list to find an event ID
    const listResponse = testListEvents();
    
    if (listResponse.status === 200) {
      const data = JSON.parse(listResponse.body);
      if (data.events && data.events.length > 0) {
        // Pick a random event
        const randomEvent = data.events[Math.floor(Math.random() * data.events.length)];
        sleep(0.5); // User reading list
        testEventDetail(randomEvent.id);
      }
    }
    
    sleep(2); // User reading detail
    return;
  }
  
  // Filter by date (15% of requests)
  if (Math.random() < 0.15) {
    testFilterByDate();
    sleep(1);
    return;
  }
  
  // Filter by category (10% of requests)
  if (Math.random() < 0.1) {
    const categories = ['GA', 'Commercial'];
    const category = categories[Math.floor(Math.random() * categories.length)];
    testFilterByCategory(category);
    sleep(1);
    return;
  }
  
  // Search (5% of requests)
  const searchTerms = ['engine', 'crash', 'landing', 'takeoff', 'fuel'];
  const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  testSearchEvents(term);
  sleep(1);
}

/**
 * Setup function - runs once at the start
 */
export function setup() {
  console.log('Starting performance tests...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Performance targets: ${JSON.stringify(TARGETS)}`);
  
  // Test health check
  const health = http.get(`${BASE_URL}/api/health`);
  if (health.status !== 200) {
    throw new Error(`Service not healthy: ${health.status}`);
  }
  
  console.log('Service is healthy, starting tests...');
}

/**
 * Teardown function - runs once at the end
 */
export function teardown(data) {
  console.log('Performance tests completed.');
}

/**
 * Summary handler - custom summary output
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: '→', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
    'summary.html': htmlReport(data),
  };
}

function textSummary(data, options) {
  // k6 built-in textSummary
  return `
Performance Test Summary
========================

Test Duration: ${data.metrics.http_reqs.values.count} requests in ${data.state.testRunDurationMs / 1000}s

Request Metrics:
  Total Requests: ${data.metrics.http_reqs.values.count}
  Requests/sec: ${data.metrics.http_reqs.values.rate.toFixed(2)}
  Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%

Response Times:
  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
  Min: ${data.metrics.http_req_duration.values.min.toFixed(2)}ms
  Max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms
  p50: ${data.metrics.http_req_duration.values['p(50)'].toFixed(2)}ms
  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
  p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms

Custom Metrics:
  Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%
  List Duration (p95): ${data.metrics.list_duration?.values['p(95)']?.toFixed(2) || 'N/A'}ms
  Detail Duration (p95): ${data.metrics.detail_duration?.values['p(95)']?.toFixed(2) || 'N/A'}ms
  Filter Duration (p95): ${data.metrics.filter_duration?.values['p(95)']?.toFixed(2) || 'N/A'}ms

Thresholds:
${Object.entries(data.thresholds || {})
  .map(([name, result]) => `  ${name}: ${result.ok ? '✓ PASS' : '✗ FAIL'}`)
  .join('\n')}
`;
}

function htmlReport(data) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>k6 Performance Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    .pass { color: green; }
    .fail { color: red; }
  </style>
</head>
<body>
  <h1>Aviation Accident Tracker - Performance Test Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  
  <h2>Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Requests</td><td>${data.metrics.http_reqs.values.count}</td></tr>
    <tr><td>Requests/sec</td><td>${data.metrics.http_reqs.values.rate.toFixed(2)}</td></tr>
    <tr><td>Failed Requests</td><td>${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%</td></tr>
    <tr><td>Avg Response Time</td><td>${data.metrics.http_req_duration.values.avg.toFixed(2)}ms</td></tr>
    <tr><td>p95 Response Time</td><td>${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</td></tr>
    <tr><td>p99 Response Time</td><td>${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms</td></tr>
  </table>
  
  <h2>Thresholds</h2>
  <table>
    <tr><th>Threshold</th><th>Status</th></tr>
    ${Object.entries(data.thresholds || {})
      .map(([name, result]) => `<tr><td>${name}</td><td class="${result.ok ? 'pass' : 'fail'}">${result.ok ? '✓ PASS' : '✗ FAIL'}</td></tr>`)
      .join('\n')}
  </table>
  
  <p><em>Full results in summary.json</em></p>
</body>
</html>`;
}
