# SkillConnect Backend Build Log

This file keeps a simple list of the steps we finish while building the backend.

## Completed

1. Created the `skillConnect-backend` project folder.
2. Ran `npm init` to create `package.json`.
3. Installed Express, Mongoose, dotenv, CORS, Helmet, and Morgan.
4. Installed Nodemon to restart the server when code changes.
5. Set the project to use CommonJS, so we write `require()` and `module.exports`.
6. Created the `src` folder for backend source code.
7. Added `.env` and `node_modules/` to `.gitignore` so private settings and installed packages are not pushed.
8. Created a Git repository for the backend only.
9. Connected it to the GitHub repository `imrohit150/skillConnect-backend`.
10. Pushed the initial setup to the `main` branch. The `.env` file was not pushed.
11. Created the first Express server in `src/server.js`.
12. Added Helmet security headers, Morgan request logging, and JSON body parsing.
13. Added a root `GET /` endpoint and verified it in Postman at `http://localhost:5000/`.
14. Created a separate health router and verified `GET /api/v1/health` in Postman.
15. Added the MongoDB Atlas connection string to the local `.env` file, which Git ignores.
16. Created `src/config/database.js` to connect to MongoDB using Mongoose.
17. Updated server startup to wait for the database connection before accepting requests.
18. Created the first Mongoose model in `src/models/user.model.js` with required fields, email normalization, and timestamps.
19. Added signup input validation, including an 18+ date-of-birth check.
20. Built and tested `POST /api/v1/auth/signup` with Postman; it hashes the password and saves the new user in MongoDB.
21. Added `jsonwebtoken` and `cookie-parser` for token-based authentication.
22. Added separate access-token and refresh-token secrets and expiry settings to the local `.env` file; the file remains ignored by Git.
23. Created a refresh-session model and session service that issues access and refresh JWTs and stores only a hash of each refresh token.
24. Added login validation and `POST /api/v1/auth/login`, which checks the password hash, creates a session, and sets HttpOnly token cookies.
25. Configured Express to parse cookies.
26. Tested login in Postman and confirmed the access-token and refresh-token cookies are set.
27. Reused the session service for signup so new accounts are logged in immediately with authentication cookies.
28. Tested signup with automatic session creation in Postman.
29. Added `POST /api/v1/auth/refresh` with refresh-token verification, session rotation, and replacement cookies.
30. Tested the refresh endpoint in Postman.
31. Added `POST /api/v1/auth/logout` to revoke the refresh session and clear authentication cookies.
32. Tested logout in Postman and confirmed a subsequent refresh request is rejected.
33. Added access-token authentication middleware and protected `GET /api/v1/auth/me`.
34. Tested the protected current-user endpoint in Postman.
35. Added profile fields for interests, experience level, and social links to the User model.
36. Added profile-update validation that rejects unsupported fields.
37. Added protected `GET /api/v1/profile/me` and `PATCH /api/v1/profile/me` endpoints and tested profile updates in Postman.
38. Added authenticated `GET /api/v1/profile/:userId` for viewing another developer's public profile without exposing private fields.
39. Added query validation and authenticated `GET /api/v1/users` with name/skill search, experience filtering, and pagination.
40. Tested the developer directory endpoint in Postman.
41. Added connection-request and user-pass models with indexes to prevent duplicate pending requests and duplicate passes.
42. Added authenticated endpoints to send a request to a user and pass on a user.
43. Prevented passing users with pending requests or accepted connections, and excluded passed users and active connections from directory results.
44. Added authenticated endpoints to list sent pending requests, received pending requests, and passed developers.
45. Added authenticated endpoints to accept received requests, ignore received requests, and cancel sent requests. Each action checks that the logged-in user owns the relevant side of a pending request.
46. Added `cancelled` as a connection-request status.
47. Added an authenticated endpoint to remove an accepted connection from either participant's account.
48. Added authenticated `GET /api/v1/connections` to list accepted connections and return the other participant's public profile.

49. Replaced deprecated Mongoose `new: true` options with `returnDocument: "after"`.
50. Added Conversation and Message models; messages are separate documents with an index for newest-first retrieval.
51. Installed Socket.IO and added cookie-based socket authentication; tested the connection in Postman.
52. Added authenticated `POST /api/v1/conversations/:userId` to find or create one conversation for accepted connections; tested in Postman.
53. Added authenticated `GET /api/v1/conversations/:conversationId/messages` with cursor-based pagination; tested in Postman.
54. Added Socket.IO `conversation:join` and `message:send` events with participant and accepted-connection checks.
55. Added authenticated `GET /api/v1/conversations` for the chat inbox with the other user and latest message; tested in Postman.
56. Tested the Socket.IO join/send flow.
57. Added `express-rate-limit`: a strict limiter on signup/login and a general API limiter; tested the login limit in Postman.
58. Added CORS restricted to `CLIENT_URL` with credentials enabled, and a 10kb JSON body limit.
59. Added startup environment validation with Zod; the server exits with a clear message if required settings are missing or secrets are too short.
60. Reviewed the auth cookie settings (HttpOnly, secure in production). The production `sameSite` value will be decided at deployment.
61. Added per-socket rate limits for `message:send` and `conversation:join`.
62. Added the Resend email service with a safe `sendEmail` helper that never throws, and set up `RESEND_API_KEY` and `EMAIL_FROM` validation.
63. Sent an email to the recipient when a connection request is created; delivery is non-blocking so a failed email never undoes the request. Tested: the email arrived.
64. Added Razorpay test-mode setup: SDK, startup validation that rejects non-test keys, a `premiumUntil` user field, and a Subscription model.
65. Added authenticated `POST /api/v1/payments/subscription` to create a Razorpay subscription; tested in Postman.
66. Added authenticated `POST /api/v1/payments/verify`, which checks the payment signature on the backend and then grants premium. Premium is never granted from the frontend alone. Not yet tested with a real payment.
67. Added authenticated `GET /api/v1/payments/subscription/me` to return premium and subscription status.
68. Added `POST /api/v1/payments/webhook`, which validates Razorpay's signature against the raw request body, ignores duplicate events, and updates subscription and premium status. Tested with signed local requests; not yet tested with real Razorpay events.

69. Added authenticated `DELETE /api/v1/users/:userId/pass` to undo a pass so the user returns to Discover; it returns 404 if the user was not passed.
70. Added authenticated `POST /api/v1/profile/me/image` (multipart field `image`, JPG/PNG/WebP up to 5MB) using multer memory storage and Cloudinary (`CLOUDINARY_*` env vars, optional at startup, 503 if missing). Images are cropped to 600x600 around the face and stored as `skillconnect/avatars/<userId>`, so a new upload replaces the old one. Removed the default `profileImageUrl`, and `PATCH /profile/me` no longer accepts `profileImageUrl`.

71. Completed chat pagination and inbox delivery support. History now returns `nextCursor` with both timestamp and message ID, validates the cursor, and uses a deterministic `{ createdAt: -1, _id: -1 }` sort plus a matching index so same-millisecond messages are not skipped. The older timestamp-only query remains accepted. Socket connections join a server-selected user room; saved messages are delivered to both participants' user rooms so inactive chats update the inbox. Added conversation-room leave handling, premium status in inbox profiles and `canMessage` based on accepted connections. Connection removal emits a targeted event to both users so their composers disable immediately while past history remains readable. The web project's isolated test suite exercises the real history/socket/controller code with in-memory fixtures: 17 checks passed. No production database or real accounts were used for these tests.

72. Email verification step 1: added `isEmailVerified` (false by default) and `emailVerifiedAt` (null by default) to User, plus a separate EmailVerification model. Each user has at most one verification record containing a hidden OTP hash, expiry, failed-attempt counter and last-sent time. Added a TTL index for expired-record cleanup; runtime expiry, attempt limits and resend cooldown will be enforced by the service in the next steps. No signup/login enforcement, OTP sending, migrations or existing-account updates were added in this foundation step. No new dependencies or npm scripts were added.

73. Email verification step 2: added `services/email-verification.service.js` to generate a six-digit OTP with Node crypto, store a purpose/account/email-bound HMAC hash using the existing server secret, and send a branded HTML/plain-text email through the existing Resend helper. Codes expire after 10 minutes; atomic reservation against the unique user index enforces a 60-second resend cooldown, including concurrent requests. Successful resends replace the old challenge and reset its failed-attempt counter. Provider rejection restores a previous valid challenge or removes the failed reservation; cleanup matches hash plus issue time so a delayed failure cannot delete a newer resend. Only expiry/resend timing is returned, never the OTP. Added optional plain-text email support to the shared email helper. Nine isolated Node test-runner checks passed using mocked storage/email (including concurrent requests and delayed-failure cleanup); no real database connection or email delivery was used. No dependencies or npm scripts were added. Verification/resend endpoints, code comparison/attempt enforcement and signup/login integration remain for the next steps.

74. Email verification step 3: added authenticated `POST /api/v1/auth/email-verification/verify` (body: `{ "otp": "123456" }`) and `POST /api/v1/auth/email-verification/resend` (empty body). Both use the account ID from the session cookie; strict validation rejects supplied account details. Verification reserves one of five attempts atomically, rejects expired records independently of TTL cleanup, compares hashes using Node crypto's timing-safe comparison, and consumes a matching issuance once before marking the same account/email verified. Concurrent submissions cannot exceed the attempt budget or verify the same issuance twice; a racing resend cannot be consumed by an earlier request. Incorrect-code responses include remaining attempts; resend cooldown includes `Retry-After` and `retryAfter`. Both endpoints share an additional 20-requests-per-15-minutes IP limiter. Signup/login/current-user responses now include verification status and time, but signup sending, access enforcement and the frontend OTP flow remain for the next step. If the account update fails after code consumption, verification fails safely and the user must request a new code. All 28 isolated service/HTTP checks passed with Node's existing test runner (`node --test tests/email-verification.service.test.js tests/email-verification.routes.test.js`); storage and email were mocked, with no real database or delivery test. No dependencies, npm scripts or production builds were added/run.

75. Signup email verification integration (supersedes the user-linked challenge design in steps 72-74): an account is now created ONLY after its signup OTP is verified. `POST /api/v1/auth/signup` validates the form, hashes the password, creates/replaces a temporary PendingSignup and sends a six-digit email code; it returns 202 with safe signup metadata and an HttpOnly pending-signup cookie, with no User, refresh session or login cookies. PendingSignup replaces the earlier EmailVerification model and stores only hashes for its random browser token and OTP; sensitive fields are hidden. Temporary signup data expires after 30 minutes via a TTL index and runtime checks. OTPs last up to 10 minutes, allow five atomic checks and have a 60-second resend cooldown; resending cannot extend the signup lifetime. `GET /api/v1/auth/signup/pending` restores email, timing and attempts after refresh without exposing credentials. Verify/resend endpoints now identify the pending signup using its restricted cookie, and accept no account details from the client. A matching OTP is consumed once before creating a verified User from the saved snapshot and issuing auth cookies. Duplicate-email and concurrent-verification races cannot create duplicate accounts. Delivery failures restore/remove the relevant pending reservation; account-storage failure requires a fresh signup, while session-storage failure after account creation offers login. Login and protected app APIs/chat require verified email; no old accounts were migrated or deleted. Replaced the earlier user-linked verification tests with `node --test tests/signup-verification.test.js`: 25 isolated service/HTTP checks passed. The web suite passed all 24 cases, including six signup browser flows and the existing chat checks plus unverified socket rejection. Storage/email were mocked; real database delivery remains to be checked. No dependencies, npm scripts or production builds were added/run.

76. Added full forgot/reset-password handling. `POST /api/v1/auth/forgot-password` accepts only an email and always acknowledges valid requests with the same generic message; in-process email work runs after the response to avoid delivery/account timing disclosure. Only verified accounts receive mail, with an atomic 60-second per-account cooldown and an additional shared 10-request/15-minute IP limiter for both reset endpoints. Links use a random 256-bit token stored only as a hidden SHA-256 hash on User, expire after 15 minutes, and use the configured `CLIENT_URL` (HTTPS required in production). The token is in the frontend URL fragment, so it is not sent in page-request URLs/referrers/access logs. Failed delivery conditionally restores prior reset fields, without overwriting a newer link. `POST /api/v1/auth/reset-password` validates the token and password (minimum 8 characters, maximum 72 UTF-8 bytes for bcrypt), then atomically updates the bcrypt hash, consumes the token, and increments a hidden session version. Access/refresh JWTs and Socket.IO authentication check that version; refresh sessions record it, login/session creation reject credentials changed during the request, and reset disconnects existing user-room sockets and clears browser auth/pending cookies. Older JWTs without a version count as version zero for compatibility until the first reset. Old tokens fail even if refresh-session cleanup fails. Password-change notification email is non-blocking, and the user logs in again rather than receiving an automatic reset login. Added isolated tests using real bcrypt/session/auth/controller code with mocked storage/mail: `node --test tests/password-reset.test.js tests/signup-verification.test.js` passed all 39 checks (14 reset, 25 signup). The web suite passed all 33 cases including reset UI/recovery and old-socket rejection. Automated checks used mocked storage/email; the user subsequently tested and confirmed the forgot/reset flow works in their environment. No new dependencies/scripts, account migration, or production build.

77. Added shared `utils/premium-status.js` so a premium badge is active only when the stored premium flag is true and `premiumUntil` is a valid date strictly in the future. Missing/invalid dates and the exact expiry instant count as inactive. Applied this rule to login/signup auth responses, current-user data, Discover, own/public profiles (including update/upload responses), sent/received requests, passed users, accepted connections, chat inbox profiles and membership status. Queries now select the expiry for calculation; public profile payloads retain their existing shape and do not expose the internal expiry. Membership status is calculated without saving on reads, so an expiry check cannot overwrite a concurrent renewal. Payment/webhook activation still updates the stored flag and expiry as before. No scheduled job, migration, dependencies or frontend changes are required for corrected flags on subsequent API responses. Existing browser-cached badges update when their data is fetched again. Tests, builds and visual checks were not run, per the user's preference.

78. Added and ran `node scripts/seed-demo-users.js`, creating five fictional, verified demo developers in the configured MongoDB: Alex Morgan, Priya Sharma, Sam Patel, Maya Chen and Jordan Brooks. Profiles cover Beginner/Intermediate/Advanced levels and include skills, interests, bios, adult birthdays and original embedded SVG avatars; no external image service is needed. Emails use `@demo.skillconnect.test`, with verification flags set only by this trusted script. Each password is salted with bcrypt; the default demo password and optional `DEMO_SEED_PASSWORD` setting are documented in `scripts/README.md`. Added a hidden immutable `demoSeed` marker. Unique-email upserts with insert-only data preserve existing seeded profiles/passwords/timestamps and skip unrelated email collisions; no existing users or relationships are deleted or reset. The run reported 5 created, 0 already present, 0 unrelated accounts skipped. Normal signup still requires OTP and no email/payment provider was contacted. No dependencies/npm scripts, tests, visual checks or build were added/run.

79. Replaced the shared Resend email transport with Brevo's HTTPS transactional API using Node's built-in fetch; signup OTPs, reset links, password-change notifications and connection-request emails all use the existing helper. Maps the sender to the SkillConnect display name and the verified bare email address in `EMAIL_FROM`, recipients to Brevo's address objects, and existing HTML/plain-text content to Brevo's fields. Requests time out after 15 seconds and return false on network/timeout/provider failure or a missing acceptance message ID; existing signup/reset recovery logic is preserved. Logs omit message bodies, recipients and API keys. Startup now requires `BREVO_API_KEY` instead of `RESEND_API_KEY` and validates `EMAIL_FROM` as an email address. Configure both variables in the local ignored `.env` and deployment environment, then restart the backend. The Resend package remains installed but is no longer used. No dependencies or npm scripts were added, no secrets were changed or printed, and no builds, tests or delivery checks were run per the user's preference.

80. Diagnosed Brevo HTTP 401 by inspecting only local key-type metadata, without printing credentials or making provider requests: `BREVO_API_KEY` contained an SMTP key. Added startup validation that rejects the known SMTP-key prefix with instructions to generate an API key, plus a safe actionable HTTP 401 log message. The user must replace the local value with a key from Brevo's API Keys tab and restart the backend; no secrets were changed, emails sent, dependencies added, or tests/builds run.

## Next

- Verify ignoring, cancelling, and removing connections in Postman if not already tested.
- Decide the production `sameSite` cookie value and consider scoping the refresh cookie path.
- After the frontend exists, test the full Razorpay Checkout flow with a test card.
- At deployment, create the Razorpay webhook with the public URL and set `RAZORPAY_WEBHOOK_SECRET`; until then the webhook returns 503.
- Manually verify signup OTP and password-reset email delivery with the verified Brevo sender. Signup form submission must leave Users/refresh sessions unchanged until a correct OTP is submitted.
- Verify old-session invalidation end to end against MongoDB before final demo-data setup. Final seeded demo accounts should match the completed verification rules.
- Complete any Brevo transactional-email account activation requirements and configure `BREVO_API_KEY` and the verified `EMAIL_FROM` on the deployment host. Brevo currently substitutes a compliant sender for free email addresses; an owned authenticated domain is the longer-term sending option.
- Add remaining production-readiness work and deployment configuration. Five demo developer profiles are seeded; optional example requests/conversations can be added separately.
