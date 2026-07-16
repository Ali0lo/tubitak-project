# Security Testing

## Automated checks

| What | Where | Run it |
|---|---|---|
| Cross-service auth enforcement | `tests/security/test_auth_enforcement.py` | `pytest tests/security -v` (no DB/network required — see `helpers.py`) |
| Python static analysis (bandit) | CI | `bandit -r <service>/app` |
| Python dependency vulnerabilities | — | `pip install pip-audit && pip-audit -r <service>/requirements.txt` |
| Frontend dependency vulnerabilities | — | `cd frontend && npm audit` |
| Frontend static analysis | CI (`ci.yml`) | `npm run lint` (`eslint-config-next` includes security-relevant rules) |

`test_auth_enforcement.py` sweeps every protected endpoint across
auth-service, core-service, ai-service, and notification-service,
confirming each one rejects a request with no `Authorization` header
(401), *and* confirming the genuinely-public auth endpoints
(register/login/refresh/password-reset) do **not** incorrectly
require one. It runs each service's real FastAPI app in an isolated
subprocess — no live database needed, since these routes reject before
any code that would touch one runs.

## Manual checklist

Run through this before a major release or after any change to
auth/authorization code:

- [ ] Every new endpoint that shouldn't be public has an explicit
      `Depends(get_current_user_id)` (or `verify_internal_api_key` for
      service-to-service routes) — check it's not accidentally missing
- [ ] Every new endpoint that operates on a specific resource
      (task/meeting/reminder/conversation/notification by id) checks
      that resource's `user_id` matches the caller — not just that
      *a* valid token was presented
- [ ] `INTERNAL_SERVICE_API_KEY` and `JWT_SECRET_KEY` are set to long,
      random, non-default values in every real environment (`.env.example`
      files intentionally ship with obviously-fake placeholder values)
- [ ] Postgres and Redis are not exposed to the host in production
      (`docker compose -f docker-compose.yml -f docker-compose.prod.yml config`
      should show no `ports:` for either — see `docs/deployment.md`)
- [ ] `pip-audit` / `npm audit` reviewed for new findings; anything
      left unresolved is understood and documented (see below for the
      current known exceptions)
- [ ] No secrets committed — check `.env` is actually gitignored, not
      just `.env.example`

## Known accepted findings

**As of this writing** (revisit periodically — dependency security
status changes):

- **Next.js pinned to 15.5.18.** Next.js 14.x reached end-of-security-
  patches as of the May 2026 disclosure (auth bypass + SSRF + more,
  13 CVEs) — 14.x will not receive further fixes. This repo was
  upgraded from 14 to 15 specifically because of that; see the
  upgrade notes in `frontend/package.json` history / commit log if
  this ever needs revisiting.
- **`node_modules/next/node_modules/postcss` flagged by `npm audit`**
  (moderate, CSS-output XSS). This is PostCSS bundled *inside* Next.js's
  own dependency tree, not a top-level dependency this repo controls —
  `npm audit fix --force` would "fix" it by downgrading Next back to
  a version with the RCE/auth-bypass vulnerabilities above, which is
  strictly worse. It's build-time-only tooling (transforms CSS during
  `next build`, doesn't process attacker-controlled input at runtime).
  Will resolve itself when Next.js bumps its internal PostCSS.
- **`esbuild`/`vite`/`vitest` chain flagged by `npm audit`** (moderate,
  dev-server request forgery). Dev-tooling only — `vitest` never ships
  in the production build (`next build`/`next start` don't include
  it), so this only matters if someone runs `npm run test:watch` with
  the dev server reachable from an untrusted network, which isn't this
  project's deployment model.

If either of the two "known accepted" items above gets a real fix
upstream, bump the relevant dependency and remove it from this list.
