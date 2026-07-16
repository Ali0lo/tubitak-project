// Load test against a running stack, through the gateway exactly like
// a real client. Requires k6 (https://k6.io) — not a Node/npm
// dependency, a standalone binary.
//
// Usage:
//   k6 run tests/load/gateway_load_test.js
//   BASE_URL=https://staging.example.com k6 run tests/load/gateway_load_test.js
//
// What it checks, beyond raw throughput: p95 latency stays under 500ms
// and the error rate stays under 1% while ramping up to 50 concurrent
// virtual users. Tune the thresholds/stages below for your actual
// capacity planning needs — the defaults here are a starting point,
// not a validated production SLA.

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // warm up
    { duration: "1m", target: 50 }, // ramp to typical peak
    { duration: "2m", target: 50 }, // hold
    { duration: "30s", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    errors: ["rate<0.01"],
  },
};

function registerAndLogin() {
  const email = `loadtest-${__VU}-${__ITER}-${Date.now()}@example.com`;
  const password = "load-test-password-123";

  const registerRes = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({ email, full_name: "Load Test", password }),
    { headers: { "Content-Type": "application/json" } }
  );
  const registerOk = check(registerRes, {
    "register: status 201": (r) => r.status === 201,
  });
  errorRate.add(!registerOk);
  if (!registerOk) return null;

  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { "Content-Type": "application/json" } }
  );
  const loginOk = check(loginRes, {
    "login: status 200": (r) => r.status === 200,
    "login: has access_token": (r) => !!r.json("access_token"),
  });
  errorRate.add(!loginOk);
  if (!loginOk) return null;

  return loginRes.json("access_token");
}

export default function () {
  const token = registerAndLogin();
  if (!token) {
    sleep(1);
    return;
  }
  const authHeaders = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  const createRes = http.post(
    `${BASE_URL}/api/v1/tasks`,
    JSON.stringify({ title: "Load test task", priority: "low" }),
    authHeaders
  );
  const createOk = check(createRes, {
    "create task: status 201": (r) => r.status === 201,
  });
  errorRate.add(!createOk);

  const listRes = http.get(`${BASE_URL}/api/v1/tasks`, authHeaders);
  const listOk = check(listRes, {
    "list tasks: status 200": (r) => r.status === 200,
  });
  errorRate.add(!listOk);

  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, { "gateway health: status 200": (r) => r.status === 200 });

  sleep(1);
}
