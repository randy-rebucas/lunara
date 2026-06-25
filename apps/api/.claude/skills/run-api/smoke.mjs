#!/usr/bin/env node
// Smoke test for the Lunara API.
// Usage: node .claude/skills/run-api/smoke.mjs
// Expects the API running on localhost:3001.

const BASE = 'http://localhost:3001/api/v1';

async function json(url, init = {}) {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok || body.success === false) {
    throw new Error(`${init.method ?? 'GET'} ${url} → ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function login(email, password) {
  const body = await json(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return body.data.tokens.accessToken;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function main() {
  // Health
  const health = await json(`${BASE}/health`);
  console.log(`health: ${health.data.status}`);

  // Admin login
  const adminToken = await login('admin@lunara.dev', 'password123');
  console.log(`admin login: ok  token=${adminToken.slice(0, 20)}...`);

  const h = authHeaders(adminToken);

  // Dashboard
  const dash = await json(`${BASE}/admin/dashboard`, { headers: h });
  console.log(`dashboard: ok`);

  // Promotions
  const promos = await json(`${BASE}/admin/promotions`, { headers: h });
  console.log(`promotions: ok  count=${promos.data.length}`);

  // Addons
  const addons = await json(`${BASE}/admin/addons`, { headers: h });
  console.log(`addons: ok  count=${addons.data.length}`);

  // Setup status
  const setup = await json(`${BASE}/admin/setup/status`, { headers: h });
  console.log(`setup/status: ok`);

  // Parent branches
  const branches = await json(`${BASE}/admin/branches/parents`, { headers: h });
  console.log(`branches/parents: ok  count=${branches.data.length}`);

  // Partner login
  await login('partner@lunara.dev', 'password123');
  console.log(`partner login: ok`);

  console.log('\nAll checks passed.');
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err.message);
  process.exit(1);
});
