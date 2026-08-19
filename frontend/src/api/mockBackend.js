/**
 * Mock backend used as an Axios adapter when no real API is configured
 * (i.e. `VITE_API_URL` is not set). It implements the same contract the real
 * backend is expected to expose:
 *
 *   POST /auth/register  -> { user, accessToken, refreshToken }
 *   POST /auth/login     -> { user, accessToken, refreshToken }
 *   POST /auth/refresh   -> { accessToken, refreshToken }
 *   POST /auth/logout    -> { success: true }
 *   GET  /auth/me        -> { user }              (requires Bearer token)
 *   GET  /dashboard/summary -> dashboard payload  (requires Bearer token)
 *
 * Users are persisted in localStorage so registration survives reloads.
 * Delete this file (and the adapter wiring in `client.js`) once a real API
 * is available.
 */

const USERS_KEY = "mock_users";
const ACCESS_TTL = 5 * 60 * 1000; // 5 minutes -> exercises the refresh flow
const REFRESH_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

const isBrowser = typeof window !== "undefined";

/** Tiny latency so loading states are visible/testable. */
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

function readUsers() {
  if (!isBrowser) return [];
  try {
    return JSON.parse(window.localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeUsers(users) {
  if (!isBrowser) return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** Not a real JWT signature — a base64 payload is enough for a demo. */
function makeToken(userId, type, ttl) {
  const payload = { sub: userId, type, exp: Date.now() + ttl };
  return `mock.${btoa(JSON.stringify(payload))}.sig`;
}

function readToken(token) {
  try {
    const payload = JSON.parse(atob(String(token).split(".")[1]));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function publicUser(user) {
  const { password: _password, ...rest } = user;
  return rest;
}

function issueTokens(user) {
  return {
    user: publicUser(user),
    accessToken: makeToken(user.id, "access", ACCESS_TTL),
    refreshToken: makeToken(user.id, "refresh", REFRESH_TTL),
  };
}

function userFromAuthHeader(config) {
  const header = config.headers?.Authorization || config.headers?.authorization;
  const payload = header ? readToken(String(header).replace("Bearer ", "")) : null;
  if (!payload || payload.type !== "access") return null;
  return readUsers().find((u) => u.id === payload.sub) || null;
}

const ok = (config, data, status = 200) => ({
  data,
  status,
  statusText: "OK",
  headers: {},
  config,
});

const fail = (config, status, message) => {
  const error = new Error(message);
  error.isAxiosError = true;
  error.config = config;
  error.response = { data: { message }, status, statusText: "Error", headers: {}, config };
  return Promise.reject(error);
};

const parseBody = (config) => {
  if (!config.data) return {};
  return typeof config.data === "string" ? JSON.parse(config.data) : config.data;
};

/** Deterministic demo dashboard data. */
function dashboardSummary(user) {
  return {
    stats: [
      { id: "balance", label: "Total balance", value: "KES 482,300", change: "+12.4%" },
      { id: "contributions", label: "Contributions (MTD)", value: "KES 96,500", change: "+4.1%" },
      { id: "members", label: "Active members", value: "38", change: "+2" },
      { id: "pending", label: "Pending approvals", value: "5", change: "-1" },
    ],
    activity: [
      { id: "t-1041", member: "Grace Wanjiru", type: "Contribution", amount: "KES 5,000", date: "2026-08-17", status: "completed" },
      { id: "t-1040", member: "Peter Otieno", type: "Loan repayment", amount: "KES 12,000", date: "2026-08-16", status: "pending" },
      { id: "t-1039", member: "Amina Yusuf", type: "Contribution", amount: "KES 5,000", date: "2026-08-15", status: "completed" },
      { id: "t-1038", member: "Brian Kiptoo", type: "Withdrawal", amount: "KES 20,000", date: "2026-08-14", status: "failed" },
      { id: "t-1037", member: user.name, type: "Contribution", amount: "KES 5,000", date: "2026-08-13", status: "completed" },
    ],
  };
}

/** Axios adapter signature: (config) => Promise<AxiosResponse>. */
export async function mockAdapter(config) {
  await delay();
  const url = (config.url || "").replace(/^\/+/, "/");
  const method = (config.method || "get").toLowerCase();
  const body = parseBody(config);
  const users = readUsers();

  if (method === "post" && url.endsWith("/auth/register")) {
    if (!body.email || !body.password || !body.name) {
      return fail(config, 400, "Name, email and password are required.");
    }
    if (users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) {
      return fail(config, 409, "An account with this email already exists.");
    }
    const user = {
      id: `u_${Date.now()}`,
      name: body.name,
      email: body.email,
      password: body.password,
      phone_number: body.phone_number,
      role: "member",
      createdAt: new Date().toISOString(),
    };
    writeUsers([...users, user]);
    return ok(config, issueTokens(user), 201);
  }

  if (method === "post" && url.endsWith("/auth/login")) {
    const user = users.find(
      (u) => u.email.toLowerCase() === String(body.email || "").toLowerCase(),
    );
    if (!user || user.password !== body.password) {
      return fail(config, 401, "Invalid email or password.");
    }
    return ok(config, issueTokens(user));
  }

  if (method === "post" && url.endsWith("/auth/refresh")) {
    const payload = readToken(body.refreshToken);
    if (!payload || payload.type !== "refresh") {
      return fail(config, 401, "Refresh token expired.");
    }
    const user = users.find((u) => u.id === payload.sub);
    if (!user) return fail(config, 401, "Unknown session.");
    const tokens = issueTokens(user);
    return ok(config, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  }

  if (method === "post" && url.endsWith("/auth/logout")) {
    return ok(config, { success: true });
  }

  const user = userFromAuthHeader(config);

  if (method === "get" && url.endsWith("/auth/me")) {
    if (!user) return fail(config, 401, "Session expired.");
    return ok(config, { user: publicUser(user) });
  }

  if (method === "get" && url.endsWith("/dashboard/summary")) {
    if (!user) return fail(config, 401, "Session expired.");
    return ok(config, dashboardSummary(publicUser(user)));
  }

  return fail(config, 404, `No mock handler for ${method.toUpperCase()} ${url}`);
}
