const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../src/models/user.model");
const PendingSignup = require("../src/models/pending-signup.model");

// Real service, controllers, validation, cookie authentication and rate limits.
// Only storage, email delivery, password work and session persistence are isolated.
const originalSecret = process.env.ACCESS_TOKEN_SECRET;
const originalNow = Date.now, originalRandom = crypto.randomInt;
const originalHash = bcrypt.hash, originalCompare = bcrypt.compare;
const originalUser = Object.fromEntries(["exists", "create", "findById", "findOne"].map((key) => [key, User[key]]));
const originalPending = Object.fromEntries(["init", "findOne", "findOneAndUpdate", "findOneAndDelete", "deleteOne", "updateOne"].map((key) => [key, PendingSignup[key]]));
const emailPath = require.resolve("../src/services/email.service");
const sessionPath = require.resolve("../src/services/session.service");
const originalEmail = require.cache[emailPath], originalSession = require.cache[sessionPath];
let pending, users, sent, sessions, clock, deliver, failCreate, failSession, server, baseUrl;
const input = { name: "A <developer>", email: "developer@example.test", password: "Test-password-123", dateOfBirth: "2000-01-15" };
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: { sendEmail: async (message) => { sent.push(message); return deliver(message); } } };
require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: {
  createSession: async (id) => {
    if (failSession) throw new Error("Session storage unavailable");
    sessions.push(String(id));
    return { accessToken: jwt.sign({ sub: String(id) }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "5m" }), refreshToken: "test-refresh" };
  }, rotateSession: async () => null, revokeSession: async () => {},
} };
const service = require("../src/services/email-verification.service");
const authRoutes = require("../src/routes/auth.routes");
const authenticate = require("../src/middleware/auth.middleware");
const requireVerifiedEmail = require("../src/middleware/verified-email.middleware");
const { authLimiter, emailVerificationLimiter } = require("../src/middleware/rate-limit.middleware");

function matches(record, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return value.some((part) => matches(record, part));
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("$gt" in value) return record[key] > value.$gt;
      if ("$lt" in value) return record[key] < value.$lt;
      if ("$lte" in value) return record[key] <= value.$lte;
    }
    return value instanceof Date ? record[key]?.getTime() === value.getTime() : String(record[key]) === String(value);
  });
}
function document(record, projection) {
  if (!record) return null;
  let copy = structuredClone(record);
  if (projection && !projection.startsWith("+")) copy = Object.fromEntries(["_id", ...projection.split(" ")].filter((key) => key in copy).map((key) => [key, copy[key]]));
  Object.defineProperty(copy, "toObject", { value: () => structuredClone(Object.fromEntries(Object.entries(copy))) });
  return copy;
}
const query = (operation) => ({ select: async (projection) => document(operation(), projection), then: (yes, no) => Promise.resolve().then(() => document(operation())).then(yes, no) });
const duplicate = () => Object.assign(new Error("Duplicate email"), { code: 11000 });

before(async () => {
  process.env.ACCESS_TOKEN_SECRET = "test-only-signup-secret-with-at-least-32-characters";
  bcrypt.hash = async (password, rounds) => { assert.equal(rounds, 12); return digest(password); };
  bcrypt.compare = async (password, hash) => digest(password) === hash;
  User.exists = async (filter) => users.some((row) => matches(row, filter));
  User.create = async (values) => {
    if (failCreate) throw new Error("User storage unavailable");
    if (users.some((row) => row.email === values.email)) throw duplicate();
    const row = { _id: String(users.length + 1).padStart(24, "0"), skills: [], profileImageUrl: "", ...values };
    users.push(row); return document(row);
  };
  User.findById = (id) => query(() => users.find((row) => String(row._id) === String(id)));
  User.findOne = (filter) => query(() => users.find((row) => matches(row, filter)));
  PendingSignup.init = async () => {};
  PendingSignup.findOne = (filter) => query(() => pending.find((row) => matches(row, filter)));
  PendingSignup.findOneAndUpdate = (filter, update, options) => query(() => {
    let row = pending.find((entry) => matches(entry, filter));
    if (!row && !options.upsert) return null;
    if (!row && pending.some((entry) => entry.email === filter.email)) throw duplicate();
    const previous = row ? structuredClone(row) : null;
    if (!row) { row = { _id: crypto.randomBytes(12).toString("hex") }; pending.push(row); }
    Object.assign(row, update.$set);
    for (const [key, amount] of Object.entries(update.$inc ?? {})) row[key] += amount;
    return options.returnDocument === "after" ? row : previous;
  });
  PendingSignup.findOneAndDelete = (filter) => query(() => {
    const row = pending.find((entry) => matches(entry, filter));
    if (row) pending = pending.filter((entry) => entry !== row);
    return row;
  });
  PendingSignup.deleteOne = async (filter) => { pending = pending.filter((row) => !matches(row, filter)); };
  PendingSignup.updateOne = async (filter, update) => { const row = pending.find((entry) => matches(entry, filter)); if (row) Object.assign(row, update.$set); };
  const app = express();
  app.use(express.json(), cookieParser()); app.use("/api/v1", authRoutes);
  app.get("/private", authenticate, requireVerifiedEmail, (_req, res) => res.json({ success: true }));
  server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  pending = []; users = []; sent = []; sessions = []; failCreate = false; failSession = false;
  clock = originalNow(); Date.now = () => clock; crypto.randomInt = () => 1234; deliver = async () => true;
  authLimiter.resetKey("127.0.0.1"); emailVerificationLimiter.resetKey("127.0.0.1");
});
after(() => {
  server.close(); Date.now = originalNow; crypto.randomInt = originalRandom; bcrypt.hash = originalHash; bcrypt.compare = originalCompare;
  Object.assign(User, originalUser); Object.assign(PendingSignup, originalPending);
  for (const [path, original] of [[emailPath, originalEmail], [sessionPath, originalSession]]) { if (original) require.cache[path] = original; else delete require.cache[path]; }
  if (originalSecret === undefined) delete process.env.ACCESS_TOKEN_SECRET; else process.env.ACCESS_TOKEN_SECRET = originalSecret;
});
async function request(path, body, cookie = "") {
  const res = await fetch(`${baseUrl}${path}`, { method: body !== undefined ? "POST" : "GET", headers: { "Content-Type": "application/json", Cookie: cookie }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, headers: res.headers, body: await res.json() };
}
const signupCookie = (result) => result.headers.getSetCookie().find((value) => value.startsWith("pendingSignup=")).split(";")[0];
const verifyPath = "/api/v1/auth/email-verification/verify", resendPath = "/api/v1/auth/email-verification/resend";

test("signup stores only temporary hashes and emails a leading-zero OTP; no User/session exists", async () => {
  const result = await service.beginSignup(input);
  assert.equal(users.length, 0); assert.equal(sessions.length, 0); assert.equal(pending.length, 1);
  assert.equal(pending[0].passwordHash, digest(input.password));
  assert.equal(pending[0].tokenHash, service.hashSignupToken(result.token));
  assert.notEqual(pending[0].tokenHash, result.token);
  assert.match(sent[0].text, /001234/); assert.match(sent[0].html, /A &lt;developer&gt;/);
  assert.doesNotMatch(JSON.stringify(result.signup), /password|otpHash|tokenHash|001234/);
});
test("correct verification creates the verified User from the saved details and consumes signup", async () => {
  const { token } = await service.beginSignup(input);
  const user = await service.verifyEmailOtp(token, "001234");
  assert.equal(user.isEmailVerified, true); assert.equal(user.emailVerifiedAt.getTime(), clock);
  assert.equal(user.email, input.email); assert.equal(user.passwordHash, digest(input.password));
  assert.equal(users.length, 1); assert.equal(pending.length, 0);
  await assert.rejects(service.verifyEmailOtp(token, "001234"), { code: "SIGNUP_EXPIRED" });
});
test("malformed/missing tokens and malformed codes never create accounts or consume attempts", async () => {
  const { token } = await service.beginSignup(input);
  for (const value of [undefined, "bad", "f".repeat(64)]) await assert.rejects(service.verifyEmailOtp(value, "001234"), { code: "SIGNUP_EXPIRED" });
  for (const code of [123456, "12345", "abcdef", " 001234"]) await assert.rejects(service.verifyEmailOtp(token, code), { code: "INVALID_OTP_FORMAT" });
  assert.equal(pending[0].attempts, 0); assert.equal(users.length, 0);
});
test("five wrong codes lock the challenge, including a subsequent correct code", async () => {
  const { token } = await service.beginSignup(input);
  for (let index = 1; index <= 5; index++) await assert.rejects(service.verifyEmailOtp(token, "999999"), { code: index < 5 ? "OTP_INCORRECT" : "OTP_ATTEMPTS_EXCEEDED", attemptsRemaining: 5 - index });
  await assert.rejects(service.verifyEmailOtp(token, "001234"), { code: "OTP_ATTEMPTS_EXCEEDED" });
  assert.equal(users.length, 0); assert.equal(pending[0].attempts, 5);
});
test("parallel wrong submissions cannot exceed five checks", async () => {
  const { token } = await service.beginSignup(input);
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => service.verifyEmailOtp(token, "999999")));
  assert.equal(results.filter((item) => item.status === "rejected" && item.reason.code === "OTP_INCORRECT").length, 4);
  assert.equal(pending[0].attempts, 5); assert.equal(users.length, 0);
});
test("parallel correct submissions create exactly one account", async () => {
  const { token } = await service.beginSignup(input);
  const results = await Promise.allSettled([service.verifyEmailOtp(token, "001234"), service.verifyEmailOtp(token, "001234")]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1); assert.equal(users.length, 1);
});
test("expiry is checked at runtime even while TTL records remain", async () => {
  const { token } = await service.beginSignup(input);
  clock += service.OTP_TTL_MS;
  await assert.rejects(service.verifyEmailOtp(token, "001234"), { code: "OTP_EXPIRED" });
  assert.equal((await service.getPendingSignup(token)).emailVerification.status, "expired");
  clock += service.SIGNUP_TTL_MS;
  await assert.rejects(service.getPendingSignup(token), { code: "SIGNUP_EXPIRED" });
  assert.equal(users.length, 0); assert.equal(pending.length, 1);
});
test("resend cooldown survives reload, and resend resets attempts and invalidates old code", async () => {
  const { token } = await service.beginSignup(input);
  await assert.rejects(service.sendVerificationOtp(token), { code: "OTP_RESEND_COOLDOWN", retryAfter: 60 });
  await assert.rejects(service.verifyEmailOtp(token, "999999"));
  assert.equal((await service.getPendingSignup(token)).emailVerification.attemptsRemaining, 4);
  clock += 60000; crypto.randomInt = () => 987654;
  const state = await service.sendVerificationOtp(token);
  assert.equal(state.emailVerification.attemptsRemaining, 5);
  await assert.rejects(service.verifyEmailOtp(token, "001234"), { code: "OTP_INCORRECT" });
  assert.equal((await service.verifyEmailOtp(token, "987654")).isEmailVerified, true);
});
test("resend never extends the temporary signup lifetime", async () => {
  const { token } = await service.beginSignup(input);
  clock += service.SIGNUP_TTL_MS - 30000;
  const state = await service.sendVerificationOtp(token);
  assert.equal(state.emailVerification.expiresAt.getTime(), state.expiresAt.getTime());
});
test("parallel initial requests and resends send one email per cooldown", async () => {
  const results = await Promise.allSettled([service.beginSignup(input), service.beginSignup(input)]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1); assert.equal(sent.length, 1);
  const token = results.find((item) => item.status === "fulfilled").value.token;
  clock += 60000;
  const resends = await Promise.allSettled([service.sendVerificationOtp(token), service.sendVerificationOtp(token)]);
  assert.equal(resends.filter((item) => item.status === "fulfilled").length, 1); assert.equal(sent.length, 2);
});
test("delivery failure creates no account and permits a fresh signup retry", async () => {
  deliver = async () => false;
  await assert.rejects(service.beginSignup(input), { code: "VERIFICATION_EMAIL_FAILED" });
  assert.equal(users.length, 0); assert.equal(pending.length, 0);
  deliver = async () => true; await service.beginSignup(input); assert.equal(pending.length, 1);
});
test("failed replacement email restores the previous signup and credentials", async () => {
  const { token } = await service.beginSignup(input); const previous = structuredClone(pending[0]); clock += 60000;
  deliver = async () => { throw new Error("Provider failure"); };
  await assert.rejects(service.beginSignup({ ...input, name: "Different name", password: "Different-password" }), { code: "VERIFICATION_EMAIL_FAILED" });
  assert.deepEqual(pending[0], previous); deliver = async () => true;
  assert.equal((await service.verifyEmailOtp(token, "001234")).name, input.name);
});
test("failed resend restores the previous code and attempt counter", async () => {
  const { token } = await service.beginSignup(input); pending[0].attempts = 3;
  const previous = structuredClone(pending[0]); clock += 60000; deliver = async () => false;
  await assert.rejects(service.sendVerificationOtp(token), { code: "VERIFICATION_EMAIL_FAILED" });
  assert.deepEqual(pending[0], previous);
});
test("a racing resend cannot be consumed by an older verification", async () => {
  const { token } = await service.beginSignup(input); const consume = PendingSignup.findOneAndDelete;
  try {
    PendingSignup.findOneAndDelete = (filter) => ({ select: async (projection) => { clock += 60000; await service.sendVerificationOtp(token); return consume(filter).select(projection); } });
    await assert.rejects(service.verifyEmailOtp(token, "001234"), { code: "OTP_NOT_CURRENT" });
    assert.equal(users.length, 0); assert.equal(pending[0].attempts, 0);
  } finally { PendingSignup.findOneAndDelete = consume; }
});
test("account storage failures fail closed after consuming a code", async () => {
  const { token } = await service.beginSignup(input); failCreate = true;
  await assert.rejects(service.verifyEmailOtp(token, "001234"), /User storage unavailable/);
  assert.equal(users.length, 0); assert.equal(pending.length, 0);
});
test("existing emails and a duplicate-email race cannot create another User", async () => {
  const { token } = await service.beginSignup(input);
  users.push({ _id: "existing", email: input.email });
  await assert.rejects(service.beginSignup(input), { code: "EMAIL_IN_USE" });
  await assert.rejects(service.verifyEmailOtp(token, "001234"), { code: "EMAIL_IN_USE" });
  assert.equal(users.length, 1);
});
test("signup HTTP response sets only a restricted pending cookie, never auth cookies or secrets", async () => {
  const result = await request("/api/v1/auth/signup", { ...input, isEmailVerified: true });
  assert.equal(result.status, 202); assert.equal(result.body.user, undefined);
  assert.equal(result.headers.getSetCookie().length, 1);
  assert.match(result.headers.get("set-cookie"), /pendingSignup=.*Path=\/api\/v1\/auth;.*HttpOnly/);
  assert.doesNotMatch(JSON.stringify(result.body), /password|otpHash|tokenHash|001234/);
  assert.equal(users.length, 0); assert.equal(sessions.length, 0);
  const state = await request("/api/v1/auth/signup/pending", undefined, signupCookie(result));
  assert.equal(state.status, 200); assert.equal(state.body.signup.email, input.email);
  assert.equal(state.headers.get("cache-control"), "no-store");
});
test("HTTP verification creates account and auth cookies; only then can app APIs be used", async () => {
  const started = await request("/api/v1/auth/signup", input); const cookie = signupCookie(started);
  assert.equal((await request("/private", undefined, cookie)).status, 401);
  assert.equal((await request("/api/v1/auth/login", { email: input.email, password: input.password })).status, 401);
  const finished = await request(verifyPath, { otp: "001234" }, cookie);
  assert.equal(finished.status, 201); assert.equal(finished.body.user.isEmailVerified, true);
  assert.doesNotMatch(JSON.stringify(finished.body), /passwordHash|otpHash|tokenHash/);
  assert.equal(sessions.length, 1);
  const access = finished.headers.getSetCookie().find((value) => value.startsWith("accessToken=")).split(";")[0];
  assert.equal((await request("/private", undefined, access)).status, 200);
  assert.equal((await request("/api/v1/auth/login", { email: input.email, password: input.password })).status, 200);
});
test("verification/resend accept pending cookies only and reject supplied account details", async () => {
  const started = await request("/api/v1/auth/signup", input); const cookie = signupCookie(started);
  assert.equal((await request(verifyPath, { otp: "001234" })).status, 410);
  for (const body of [{ otp: 123456 }, { otp: "001234", email: input.email }, { otp: "001234", password: "changed" }]) assert.equal((await request(verifyPath, body, cookie)).status, 400);
  assert.equal((await request(resendPath, { email: input.email }, cookie)).status, 400);
  assert.equal(users.length, 0); assert.equal(pending[0].attempts, 0);
});
test("cooldown error supplies Retry-After; session refresh does not erase pending signup", async () => {
  const started = await request("/api/v1/auth/signup", input); const cookie = signupCookie(started);
  const result = await request(resendPath, {}, cookie);
  assert.equal(result.status, 429); assert.equal(result.body.retryAfter, 60); assert.equal(result.headers.get("retry-after"), "60");
  const refreshed = await request("/api/v1/auth/refresh", {}, cookie);
  assert.equal(refreshed.status, 401); assert.doesNotMatch(refreshed.headers.get("set-cookie"), /pendingSignup/);
  assert.equal((await request("/api/v1/auth/signup/pending", undefined, cookie)).status, 200);
});
test("if automatic sign-in fails, the verified account is retained and login is offered", async () => {
  const started = await request("/api/v1/auth/signup", input); failSession = true;
  const finished = await request(verifyPath, { otp: "001234" }, signupCookie(started));
  assert.equal(finished.status, 503); assert.equal(finished.body.code, "SIGNUP_LOGIN_FAILED");
  assert.equal(users.length, 1); assert.equal(users[0].isEmailVerified, true);
  assert.doesNotMatch(finished.headers.get("set-cookie"), /accessToken/);
});
test("shared verification IP limiter rejects excess requests", async () => {
  for (let index = 0; index < 20; index++) assert.equal((await request(resendPath, {})).status, 410);
  const result = await request(resendPath, {});
  assert.equal(result.status, 429); assert.equal(result.body.code, "VERIFICATION_RATE_LIMIT");
  assert.ok(result.body.retryAfter > 0);
});

test("a delayed failed email cannot delete a newer pending signup", async () => {
  let finish;
  const delivery = new Promise((resolve) => { finish = resolve; });
  deliver = () => delivery;
  const first = service.beginSignup(input);
  await new Promise((resolve) => setImmediate(resolve));
  clock += 60000; deliver = async () => true;
  const second = await service.beginSignup(input); const current = structuredClone(pending[0]);
  finish(false);
  await assert.rejects(first, { code: "VERIFICATION_EMAIL_FAILED" });
  assert.deepEqual(pending[0], current);
  assert.equal((await service.verifyEmailOtp(second.token, "001234")).isEmailVerified, true);
});

test("restarting a signup replaces its browser token and the saved credentials", async () => {
  const first = await service.beginSignup(input); clock += 60000;
  const second = await service.beginSignup({ ...input, name: "Updated Developer", password: "Updated-password" });
  await assert.rejects(service.verifyEmailOtp(first.token, "001234"), { code: "SIGNUP_EXPIRED" });
  const user = await service.verifyEmailOtp(second.token, "001234");
  assert.equal(user.name, "Updated Developer"); assert.equal(user.passwordHash, digest("Updated-password"));
});

test("unverified persisted accounts cannot log in or use protected app APIs", async () => {
  const id = "555555555555555555555555";
  users.push({ _id: id, email: input.email, passwordHash: digest(input.password), isEmailVerified: false });
  assert.equal((await request("/api/v1/auth/login", { email: input.email, password: input.password })).status, 403);
  assert.equal(sessions.length, 0);
  const token = jwt.sign({ sub: id }, process.env.ACCESS_TOKEN_SECRET);
  assert.equal((await request("/private", undefined, `accessToken=${token}`)).body.code, "EMAIL_NOT_VERIFIED");
});
