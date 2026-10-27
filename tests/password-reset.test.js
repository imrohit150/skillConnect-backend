const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../src/models/user.model");
const RefreshSession = require("../src/models/refresh-session.model");

// Real bcrypt, reset/session services, HTTP controllers and auth middleware. No MongoDB or mail.
const originalEnv = Object.fromEntries(["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET", "CLIENT_URL", "NODE_ENV"].map((key) => [key, process.env[key]]));
const originalNow = Date.now;
const originalUser = Object.fromEntries(["findOne", "findById", "findOneAndUpdate", "updateOne"].map((key) => [key, User[key]]));
const originalRefresh = Object.fromEntries(["create", "findOneAndUpdate", "updateMany"].map((key) => [key, RefreshSession[key]]));
const emailPath = require.resolve("../src/services/email.service"), originalEmail = require.cache[emailPath];
let users, sessions, emails, clock, deliver, failCleanup, failUpdate, server, baseUrl, oldHash, disconnected;
const id = "111111111111111111111111", email = "developer@example.test";
const oldPassword = "Old-password-123", newPassword = "Updated-password-456";
require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: { sendEmail: async (message) => { emails.push(message); return deliver(message); } } };
const service = require("../src/services/password-reset.service");
const sessionService = require("../src/services/session.service");
const authRoutes = require("../src/routes/auth.routes");
const authenticate = require("../src/middleware/auth.middleware");
const { passwordResetLimiter, authLimiter } = require("../src/middleware/rate-limit.middleware");

function matches(row, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or") return expected.some((part) => matches(row, part));
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      if ("$exists" in expected) return (row[key] !== undefined) === expected.$exists;
      if ("$gt" in expected) return row[key] > expected.$gt;
      if ("$lt" in expected) return row[key] < expected.$lt;
      if ("$lte" in expected) return row[key] <= expected.$lte;
    }
    return expected instanceof Date ? row[key]?.getTime() === expected.getTime() : String(row[key]) === String(expected);
  });
}
function update(row, changes) {
  Object.assign(row, changes.$set);
  for (const key of Object.keys(changes.$unset ?? {})) delete row[key];
  for (const [key, amount] of Object.entries(changes.$inc ?? {})) row[key] = (row[key] ?? 0) + amount;
}
function project(row, fields) {
  if (!row) return null;
  const copy = structuredClone(row);
  if (!fields || fields.split(" ").every((key) => key.startsWith("+"))) return copy;
  return Object.fromEntries(["_id", ...fields.split(" ").map((key) => key.replace(/^\+/, ""))].filter((key) => key in copy).map((key) => [key, copy[key]]));
}
const query = (operation) => ({ select: async (fields) => project(operation(), fields), then: (yes, no) => Promise.resolve().then(operation).then(yes, no) });
const tokenFrom = (message) => new URL(message.text.match(/https?:\/\/\S+/)[0]).hash.slice("#token=".length);
const flush = () => new Promise((resolve) => setImmediate(resolve));

before(async () => {
  process.env.ACCESS_TOKEN_SECRET = "password-reset-test-access-secret-at-least-32-characters";
  process.env.REFRESH_TOKEN_SECRET = "password-reset-test-refresh-secret-at-least-32-characters";
  process.env.CLIENT_URL = "http://localhost:3100"; process.env.NODE_ENV = "test";
  oldHash = await bcrypt.hash(oldPassword, 12);
  User.findOne = (filter) => query(() => project(users.find((row) => matches(row, filter))));
  User.findById = (userId) => query(() => users.find((row) => row._id === String(userId)));
  User.findOneAndUpdate = (filter, changes, options) => query(() => {
    if (failUpdate) throw new Error("Database unavailable");
    const row = users.find((entry) => matches(entry, filter));
    if (!row) return null;
    const previous = structuredClone(row); update(row, changes);
    return options?.returnDocument === "after" ? row : previous;
  });
  User.updateOne = async (filter, changes) => { const row = users.find((entry) => matches(entry, filter)); if (row) update(row, changes); };
  RefreshSession.create = async (values) => { const row = { ...values, revokedAt: null }; sessions.push(row); return row; };
  RefreshSession.findOneAndUpdate = (filter, changes) => query(() => { const row = sessions.find((entry) => matches(entry, filter)); if (!row) return null; const previous = structuredClone(row); update(row, changes); return previous; });
  RefreshSession.updateMany = async (filter, changes) => { if (failCleanup) throw new Error("Cleanup failed"); for (const row of sessions.filter((entry) => matches(entry, filter))) update(row, changes); };
  const app = express(); app.use(express.json(), cookieParser()); app.use("/api/v1", authRoutes);
  app.set("io", { in: (room) => ({ disconnectSockets: () => disconnected.push(room) }) });
  app.get("/private", authenticate, (_req, res) => res.json({ success: true }));
  server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  users = [{ _id: id, email, name: "Developer", passwordHash: oldHash, isEmailVerified: true, sessionVersion: 0 }];
  sessions = []; emails = []; disconnected = []; deliver = async () => true; failCleanup = false; failUpdate = false;
  clock = originalNow(); Date.now = () => clock;
  passwordResetLimiter.resetKey("127.0.0.1"); authLimiter.resetKey("127.0.0.1");
});
after(async () => {
  await flush(); await new Promise((resolve) => server.close(resolve)); Date.now = originalNow;
  Object.assign(User, originalUser); Object.assign(RefreshSession, originalRefresh);
  if (originalEmail) require.cache[emailPath] = originalEmail; else delete require.cache[emailPath];
  for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
async function request(path, body, cookie = "") {
  const res = await fetch(`${baseUrl}${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, headers: res.headers, body: await res.json() };
}
const cookieFor = (tokens) => `accessToken=${tokens.accessToken}; refreshToken=${tokens.refreshToken}`;

test("request stores only a hash, uses the configured frontend fragment URL, and leaves password/sessions intact", async () => {
  const tokens = await sessionService.createSession(id);
  await service.requestPasswordReset(email);
  const token = tokenFrom(emails[0]);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(users[0].passwordResetTokenHash, crypto.createHash("sha256").update(token).digest("hex"));
  assert.notEqual(users[0].passwordResetTokenHash, token);
  assert.match(emails[0].text, /http:\/\/localhost:3100\/reset-password#token=/);
  assert.equal(users[0].passwordHash, oldHash); assert.equal(users[0].sessionVersion, 0);
  assert.equal((await request("/private", undefined, cookieFor(tokens))).status, 200);
});
test("correct reset updates bcrypt password once, increments session version and invalidates the link", async () => {
  await service.requestPasswordReset(email); const token = tokenFrom(emails[0]);
  await service.resetPassword(token, newPassword);
  assert.equal(await bcrypt.compare(newPassword, users[0].passwordHash), true);
  assert.equal(await bcrypt.compare(oldPassword, users[0].passwordHash), false);
  assert.equal(users[0].sessionVersion, 1); assert.equal(users[0].passwordResetTokenHash, undefined);
  await assert.rejects(service.resetPassword(token, newPassword), { code: "INVALID_RESET_TOKEN" });
});
test("expired, unknown and malformed links never change the password", async () => {
  await service.requestPasswordReset(email); const token = tokenFrom(emails[0]); clock += service.RESET_TTL_MS;
  for (const value of [token, "f".repeat(64), "invalid"]) await assert.rejects(service.resetPassword(value, newPassword), { code: "INVALID_RESET_TOKEN" });
  assert.equal(users[0].passwordHash, oldHash); assert.equal(users[0].sessionVersion, 0);
});
test("simultaneous submissions consume the token in one atomic password update", async () => {
  await service.requestPasswordReset(email); const token = tokenFrom(emails[0]);
  const results = await Promise.allSettled([service.resetPassword(token, newPassword), service.resetPassword(token, "Other-password-789")]);
  assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1); assert.equal(users[0].sessionVersion, 1);
});
test("cooldown suppresses duplicate mail; a newer reset link replaces the previous one", async () => {
  await service.requestPasswordReset(email); const first = tokenFrom(emails[0]);
  await service.requestPasswordReset(email); assert.equal(emails.length, 1);
  clock += service.RESET_COOLDOWN_MS; await service.requestPasswordReset(email);
  await assert.rejects(service.resetPassword(first, newPassword), { code: "INVALID_RESET_TOKEN" });
  await service.resetPassword(tokenFrom(emails[1]), newPassword);
});
test("failed email delivery restores the previous valid link", async (t) => {
  t.mock.method(console, "error", () => {});
  await service.requestPasswordReset(email); const first = tokenFrom(emails[0]); const previous = structuredClone(users[0]);
  clock += service.RESET_COOLDOWN_MS; deliver = async () => false; await service.requestPasswordReset(email);
  assert.deepEqual(users[0], previous); await service.resetPassword(first, newPassword);
});
test("failed first delivery removes the reservation and permits immediate retry", async (t) => {
  t.mock.method(console, "error", () => {});
  deliver = async () => { throw new Error("Provider failure"); }; await service.requestPasswordReset(email);
  assert.equal(users[0].passwordResetTokenHash, undefined); assert.equal(users[0].passwordResetLastSentAt, undefined);
  deliver = async () => true; await service.requestPasswordReset(email); assert.ok(users[0].passwordResetTokenHash);
});
test("late failed delivery cannot overwrite a newer successful link", async (t) => {
  t.mock.method(console, "error", () => {});
  let finish; deliver = () => new Promise((resolve) => { finish = resolve; });
  const first = service.requestPasswordReset(email); await flush();
  clock += service.RESET_COOLDOWN_MS; deliver = async () => true; await service.requestPasswordReset(email);
  const latest = structuredClone(users[0]); finish(false); await first; assert.deepEqual(users[0], latest);
});
test("unknown and unverified accounts send no mail and disclose the same HTTP response", async () => {
  const known = await request("/api/v1/auth/forgot-password", { email }); await flush();
  const missing = await request("/api/v1/auth/forgot-password", { email: "unknown@example.test" }); await flush();
  users[0].isEmailVerified = false;
  const unverified = await request("/api/v1/auth/forgot-password", { email }); await flush();
  assert.deepEqual(known.body, missing.body); assert.deepEqual(known.body, unverified.body);
  assert.equal(known.status, 200); assert.equal(emails.length, 1);
});
test("HTTP reset revokes old access/refresh cookies, disconnects chat, and requires the new password", async () => {
  const old = await sessionService.createSession(id); await service.requestPasswordReset(email);
  const result = await request("/api/v1/auth/reset-password", { token: tokenFrom(emails[0]), newPassword }, cookieFor(old));
  assert.equal(result.status, 200); assert.deepEqual(disconnected, [`user:${id}`]);
  assert.doesNotMatch(JSON.stringify(result.body), /token|passwordHash|Updated-password/);
  assert.match(result.headers.get("set-cookie"), /accessToken=;/);
  assert.equal((await request("/private", undefined, cookieFor(old))).status, 401);
  assert.equal((await request("/api/v1/auth/refresh", {}, cookieFor(old))).status, 401);
  assert.equal((await request("/api/v1/auth/login", { email, password: oldPassword })).status, 401);
  const login = await request("/api/v1/auth/login", { email, password: newPassword });
  assert.equal(login.status, 200);
  const access = login.headers.getSetCookie().find((value) => value.startsWith("accessToken=")).split(";")[0];
  assert.equal((await request("/private", undefined, access)).status, 200);
  await flush(); assert.equal(emails.filter((message) => message.subject === "Your SkillConnect password was changed").length, 1);
});
test("version checks reject old tokens even if refresh-session cleanup fails", async (t) => {
  t.mock.method(console, "error", () => {});
  const old = await sessionService.createSession(id); await service.requestPasswordReset(email); failCleanup = true;
  await service.resetPassword(tokenFrom(emails[0]), newPassword);
  assert.equal((await request("/private", undefined, cookieFor(old))).status, 401);
  assert.equal(await sessionService.rotateSession(old.refreshToken), null);
  assert.equal(await sessionService.createSession(id, 0), null);
  const fresh = await sessionService.createSession(id, 1); assert.equal(jwt.decode(fresh.accessToken).ver, 1);
});
test("failed password storage leaves the current password and reset link intact", async () => {
  await service.requestPasswordReset(email); const previous = structuredClone(users[0]); failUpdate = true;
  await assert.rejects(service.resetPassword(tokenFrom(emails[0]), newPassword), /Database unavailable/);
  assert.deepEqual(users[0], previous);
});
test("strict HTTP validation rejects injected identity and bcrypt-truncated passwords", async () => {
  assert.equal((await request("/api/v1/auth/forgot-password", { email, userId: id })).status, 400);
  await service.requestPasswordReset(email); const token = tokenFrom(emails[0]);
  for (const body of [{ token, newPassword: "short" }, { token, newPassword: "a".repeat(73) }, { token, newPassword: "😀".repeat(19) }, { token, newPassword, email }, { token: "bad", newPassword }]) assert.equal((await request("/api/v1/auth/reset-password", body)).status, 400);
  assert.equal(users[0].passwordHash, oldHash);
});
test("request and reset share an IP limit with a JSON retry delay", async () => {
  for (let index = 0; index < 10; index++) await request("/api/v1/auth/reset-password", {});
  const result = await request("/api/v1/auth/forgot-password", { email });
  assert.equal(result.status, 429); assert.equal(result.body.code, "PASSWORD_RESET_RATE_LIMIT"); assert.ok(result.body.retryAfter > 0);
});
