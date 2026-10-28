# Backend deployment settings

## Authentication on free hosting domains

The production web app proxies `/api/v1/*` and `/socket.io` through its own
origin to this backend. Browsers receive authentication cookies on the frontend
host, avoiding a dependency on third-party cookies between `vercel.app` and
`onrender.com`.

- On Render, set `NODE_ENV=production` and `CLIENT_URL` to the exact HTTPS
  frontend origin, without a trailing slash. Password-reset links use this URL.
- On Vercel, set `BACKEND_ORIGIN` to this backend's HTTPS origin, without an API
  path. Configure it before building; changing it requires redeployment.
- Access and refresh cookies use `HttpOnly`, `Secure` in production,
  `SameSite=Lax`, and `Path=/`, with no `Domain`. Access cookies need the root
  path so the proxied Socket.IO handshake can use them. Pending-signup cookies
  retain `Path=/api/v1/auth`. Clearing uses the same attributes as setting.
- API and Socket.IO responses send `Cache-Control: private, no-store`. Do not
  enable CDN caching on these proxy paths.
- Hosted chat uses Socket.IO HTTP long polling through the frontend proxy,
  retaining live events and existing cookie authentication. Local development
  retains its direct backend connection and WebSocket upgrade support.
- Local development can keep its existing localhost URLs. Production requires
  HTTPS and ignores the frontend's development `NEXT_PUBLIC_API_URL` and
  `NEXT_PUBLIC_SOCKET_URL` values.

Determine proxy depth using the full browser -> Vercel -> Render -> Express
path. Direct requests to Render take a different path; do not blindly increase
trust to cover both. Follow the ingress and spoofing checks below. Razorpay's
signed webhook can use Render's direct `/api/v1/payments/webhook` URL.

After deploying, manually check signup/resend/verification, login and refresh,
logout, reset-password cookie clearing, and two-user chat with third-party
cookies blocked. Deployment behavior has not been checked locally.

## Request origin checks

`CLIENT_URL` is the single trusted frontend origin, shared by HTTP CORS,
state-changing API requests and Socket.IO. It must be an HTTP(S) origin without
credentials, a path, query or fragment; production requires HTTPS. Preview URLs
are not automatically trusted. Update the setting when changing the frontend
deployment domain and restart the backend.

Non-safe API methods (anything except GET, HEAD and OPTIONS) require a trusted
request origin before body parsing and route handling. Untrusted requests return
403 with `ORIGIN_NOT_ALLOWED`. The signed Razorpay webhook is registered before
the guard and retains its raw-body signature verification; health/read-only
requests remain available without an origin. Existing authentication, ownership
checks and rate limits still apply independently.

Socket.IO checks every underlying Engine.IO request, including initial
handshakes, later polling requests and WebSocket upgrades. Its origin guard
does not rely on browser CORS enforcement and does not replace token or
connection checks.

Policy for both guards:

1. If Origin is present, it must exactly equal the configured frontend origin.
   An untrusted or `null` Origin is rejected regardless of other headers.
2. If Origin is absent, a Referer from that frontend origin is accepted.
3. If both are absent, browser Fetch Metadata must say `same-origin`.
4. Requests lacking all three signals are rejected in production. Local
   development/test retains Postman and Node-client calls with no such headers.

For manual production Postman/Node calls that change data or open chat, include
`Origin: https://your-frontend.vercel.app` using the actual `CLIENT_URL` origin.
Non-browser clients can supply this header themselves: these guards protect
browser cookie flows and are not a replacement for authentication.

The Vercel rewrites must preserve Origin, Referer and Fetch Metadata. Confirm
same-origin polling GETs and POSTs when deploying, including with referrers
disabled. Wrong or opaque origins must remain rejected, and Razorpay's signed
webhook must still be reachable. No live checks have been run.

References:

- [Socket.IO Engine.IO middleware](https://socket.io/docs/v4/middlewares/)
- [Socket.IO CORS and WebSockets](https://socket.io/docs/v4/handling-cors/)

## Reverse proxy and rate limiting

Set `TRUST_PROXY_HOPS` to the verified number of reverse proxies between the
client and Express. Express uses this numeric setting to resolve `req.ip`, which
all existing HTTP rate limiters use. The setting is applied before middleware.

- Local development: leave it unset (defaults to `0`) for direct connections.
- Production: explicitly set it in the hosting environment. Startup fails if it
  is omitted, blank, negative, fractional, unsafe, or not an integer.
- `0` means no trusted proxy. `1` means exactly one proxy is trusted; this is an
  example, not an assumed value for Render. Higher values trust more hops.
- `true` is intentionally unsupported: it would trust the entire forwarding chain.

Render documents that public requests pass through Cloudflare and its load
balancers, but does not specify a fixed hop count. Confirm the deployed service's
forwarding chain before selecting the value. Do not infer it from `NODE_ENV`.

During deployment, inspect the socket peer, `X-Forwarded-For`, and resolved
`req.ip` for a request from a known public client IP using temporary diagnostics.
Select the smallest count that resolves that client IP, then confirm a request
with a forged client-supplied `X-Forwarded-For` still resolves the actual client.
Check every public ingress path, including a custom domain if used. Remove the
diagnostics afterward; do not leave an IP/debug endpoint or request-header logging
enabled. Revisit this setting if the proxy or hosting arrangement changes.

Numeric proxy trust assumes requests cannot bypass the configured proxies via a
shorter path. Do not expose the application port directly while trusting hops.

The current in-memory limiters suit the planned single backend instance; counters
reset on restart and are not shared if multiple instances are introduced.

References:

- [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/)
- [express-rate-limit proxy configuration](https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues)
- [Render client IP guidance](https://render.com/articles/how-render-handles-ddos-attacks)
