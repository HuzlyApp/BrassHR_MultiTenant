/**
 * Recruiter Candidates session.
 *
 *   k6 run -e SESSION_VUS=1  perf/k6/candidates.js
 *   k6 run -e SESSION_VUS=10 perf/k6/candidates.js
 *   k6 run -e SESSION_VUS=50 perf/k6/candidates.js
 *
 * Env:
 *   BASE_URL      default http://localhost:3010
 *   K6_COOKIE     Cookie header value (authenticated session). Omit only for a local dev bypass.
 *   SESSION_VUS   virtual users, each runs the session once. Do not use K6_VUS; k6 treats that as its own --vus flag and drops this scenario.
 *   K6_RARE_TERM  default phlebot
 *
 * Summary JSON is written to stdout handle "summary" when K6_SUMMARY_PATH is not used.
 * Run with: k6 run --summary-export perf/results/k6-summary.json perf/k6/candidates.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const baseUrl = (__ENV.BASE_URL || "http://localhost:3010").replace(/\/$/, "");
const cookie = __ENV.K6_COOKIE || "";
const rareTerm = __ENV.K6_RARE_TERM || "phlebot";
const vus = Math.max(1, Number(__ENV.SESSION_VUS || 1));

const ENDPOINTS = [
  "candidates_page",
  "workers_page1",
  "workers_page2",
  "workers_filter",
  "workers_search_smith",
  "workers_search_rare",
  "workers_metrics",
  "admin_jobs_picker",
];

const durationByName = Object.fromEntries(ENDPOINTS.map((name) => [name, new Trend(`dur_${name}`, true)]));
const bytesByName = Object.fromEntries(ENDPOINTS.map((name) => [name, new Trend(`bytes_${name}`, true)]));
const timingByName = Object.fromEntries(
  ENDPOINTS.filter((name) => name.startsWith("workers_") && name !== "workers_metrics").map((name) => [
    name,
    new Trend(`timing_${name}`, true),
  ])
);

export const options = {
  scenarios: {
    recruiter_session: {
      executor: "per-vu-iterations",
      vus,
      iterations: 1,
      maxDuration: "3m",
    },
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  thresholds: {
    http_req_failed: ["rate<1"],
  },
};

export function handleSummary(data) {
  return {
    [`perf/results/k6-vus-${vus}.json`]: JSON.stringify(data, null, 2),
  };
}

function headers() {
  const value = { Accept: "application/json" };
  if (cookie) value.Cookie = cookie;
  return value;
}

function hit(name, path) {
  const res = http.get(`${baseUrl}${path}`, {
    headers: headers(),
    tags: { name },
    timeout: "120s",
  });
  durationByName[name].add(res.timings.duration);
  bytesByName[name].add(res.body ? res.body.length : 0);
  const ok = check(res, {
    [`${name} status 200`]: (r) => r.status === 200,
  });
  if (timingByName[name] && res.status === 200) {
    try {
      const body = res.json();
      if (typeof body.timingMs === "number") timingByName[name].add(body.timingMs);
    } catch {
      /* non-json body */
    }
  }
  return ok;
}

export default function recruiterSession() {
  hit("candidates_page", "/admin_recruiter/candidates");
  hit("workers_page1", "/api/workers?limit=15&offset=0&sort=createdDate&sortDir=desc");
  hit("workers_page2", "/api/workers?limit=15&offset=15&sort=createdDate&sortDir=desc");
  hit("workers_filter", "/api/workers?limit=15&offset=0&status=pending&sort=createdDate&sortDir=desc");
  hit("workers_search_smith", "/api/workers?limit=15&offset=0&q=smith&sort=createdDate&sortDir=desc");
  hit(
    "workers_search_rare",
    `/api/workers?limit=15&offset=0&q=${encodeURIComponent(rareTerm)}&sort=createdDate&sortDir=desc`
  );
  hit("workers_metrics", "/api/workers/metrics");
  hit("admin_jobs_picker", "/api/admin/jobs?fields=picker");
  sleep(0.2);
}
