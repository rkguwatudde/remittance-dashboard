# Vercel: production vs staging (`remittance-dashboard`)

The dashboard talks to **remittance-api** via **`NEXT_PUBLIC_REMITTANCE_API_URL`** at **build time** (`src/lib/remittance-admin-api.ts`).

Production uses a **same-origin proxy** so the browser does not hit cross-origin CORS on the API host. Staging should use the **same pattern**.

## URLs (your setup)

| Role | Production | Staging (sandbox) |
|------|------------|-------------------|
| **Dashboard** (Vercel) | `https://remittance.borabond.com` | `https://remittance-staging.borabond.com` (Preview on `dev`) |
| **Remittance API** (EC2) | `https://remittance.api.borabond.com` | `https://staging-remittance.borabond.com` |

The API host and the dashboard host are **different** subdomains (like `staging-api` vs `staging-app` for customer-app).

## Branch layout (match `customer-app`)

| Vercel deployment | Git branch | Custom domain (example) |
|-------------------|----------|---------------------------|
| **Production** | `main` | `remittance.borabond.com` |
| **Preview** (staging) | `dev` | `remittance-staging.borabond.com` |

**Settings → Git → Production Branch** = `main`. Staging ships from **`dev`** Preview deployments.

## Configure in Vercel (no production code change)

Open **Vercel** → project for **remittance-dashboard** → **Settings** → **Environment Variables**.

### Production only (check **Production**, uncheck Preview / Development)

| Variable | Value |
|----------|--------|
| `REMITTANCE_API_UPSTREAM` | `https://remittance.api.borabond.com` |
| `NEXT_PUBLIC_REMITTANCE_API_URL` | `/api/remittance-backend` |

`next.config.ts` no longer uses build-time rewrites. **`src/app/api/remittance-backend/[...path]/route.ts`** proxies at **runtime** using `REMITTANCE_API_UPSTREAM` (server-only env on Vercel).

### Preview / `dev` branch only (check **Preview**, uncheck Production)

| Variable | Value |
|----------|--------|
| `REMITTANCE_API_UPSTREAM` | `https://staging-remittance.borabond.com` |
| `NEXT_PUBLIC_REMITTANCE_API_URL` | `/api/remittance-backend` |

Optional: restrict Preview vars to Git branch **`dev`** (Vercel UI → “Git Branch” when adding the variable).

### Avoid “All Environments” for API URLs

If `REMITTANCE_API_UPSTREAM` or `NEXT_PUBLIC_REMITTANCE_API_URL` is set for **All Environments**, Preview builds on `dev` may still call **production** API. Use separate Production vs Preview values (same rule as `customer-app` — see [customer-app/docs/VERCEL_STAGING.md](../../customer-app/docs/VERCEL_STAGING.md)).

## Custom domains

1. **Production:** `remittance.borabond.com` → Production deployment (`main`).
2. **Staging:** **Cloudflare** → DNS → `remittance-staging` → CNAME to Vercel (or A per Vercel instructions) → assign domain to **`dev`** branch in Vercel **Domains**.

## Redeploy after env changes

Vercel bakes `NEXT_PUBLIC_*` at build time.

- Change **Production** vars → redeploy Production from `main`.
- Change **Preview** vars → push to `dev` or **Redeploy** latest Preview.

## Remittance API (sandbox EC2 / SSM)

After the dashboard URL exists, update staging SSM so the API allows the Vercel origin and email links use the right host:

```bash
cd remittance
# In scripts/staging-credentials.sh:
#   ADMIN_DASHBOARD_BASE_URL="https://remittance-staging.borabond.com"
#   CORS_ORIGIN="https://remittance-staging.borabond.com,http://localhost:3000"
./scripts/quick-update-staging.sh
# On EC2: load-env-from-ssm + pm2 restart remittance-api remittance-worker
```

`CORS_ORIGIN` is read in `remittance/src/main.ts`. Without it, the browser may block login when not using the proxy (direct API URL).

With the **proxy** pattern above, admin calls go to `/api/remittance-backend` on the **same origin** as the dashboard; CORS is still recommended for any direct API calls and for consistency.

## Verify

1. Open `https://remittance-staging.borabond.com` (or the Preview URL) → sign in.
2. DevTools → Network → API requests should go to **`/api/remittance-backend/...`** on the **same host**, not `remittance.api.borabond.com`.
3. On the server, remittance-api should proxy to `127.0.0.1:9002` via `staging-remittance.borabond.com` (see [STAGING-REMITTANCE-DNS-NGINX.md](../../docs/STAGING-REMITTANCE-DNS-NGINX.md)).
4. Production `https://remittance.borabond.com` must still use production upstream only.

## Troubleshooting login / `500` on `/api/remittance-backend/...`

### How the request flows

```
Browser  →  remittance-staging.borabond.com/api/remittance-backend/api/v1/admins/auth/login
         →  Vercel (Next.js proxy route)
         →  https://staging-remittance.borabond.com/api/v1/admins/auth/login
         →  EC2 remittance-api :9002
```

The **remittance API itself is often fine** — check directly:

```bash
curl -sS https://staging-remittance.borabond.com/health
curl -sS -X POST https://staging-remittance.borabond.com/api/v1/admins/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@borabond.com","password":"YourPass123!"}'
```

Expect `401` for wrong credentials, not `500`.

### Common causes of dashboard `500`

| Cause | Fix |
|-------|-----|
| **`REMITTANCE_API_UPSTREAM` missing on Vercel Preview** | Set to `https://staging-remittance.borabond.com` (Preview only), then **Redeploy**. |
| **Vercel Deployment Protection** (SSO on Preview) | **Settings → Deployment Protection** — disable for `remittance-staging.borabond.com`, or allow public access to Preview on that domain. Unauthenticated calls to `/api/remittance-backend/*` fail before the proxy runs. |
| **No admin user on sandbox DB** | Bootstrap once: `POST /api/v1/admins/auth/bootstrap` on staging API (see remittance admin-auth docs). Wrong password returns **401**, not 500. |
| **API crash on valid login** | On EC2: `pm2 logs remittance-api --lines 100` during login attempt. |

### Env checklist (Preview / `dev`)

- `REMITTANCE_API_UPSTREAM` = `https://staging-remittance.borabond.com` (no trailing slash)
- `NEXT_PUBLIC_REMITTANCE_API_URL` = `/api/remittance-backend`
- Not set to **All Environments** with production values
- Redeploy Preview after changing either variable

## Local development

**Against sandbox API** (same as Vercel Preview):

```bash
# remittance-dashboard/.env.local
REMITTANCE_API_UPSTREAM=https://staging-remittance.borabond.com
NEXT_PUBLIC_REMITTANCE_API_URL=/api/remittance-backend
```

```bash
npm run dev:sandbox
```

**Local Nest only:**

```bash
NEXT_PUBLIC_REMITTANCE_API_URL=http://localhost:9002
npm run dev
```

## New Vercel project checklist

1. Import **remittance-dashboard** repo (root directory = `remittance-dashboard` if monorepo).
2. Framework: **Next.js**.
3. Set env vars (Production vs Preview) as above.
4. Production branch `main`, connect `dev` for Preview.
5. Add domains `remittance.borabond.com` + `remittance-staging.borabond.com`.
6. Push `dev` → confirm Preview build uses staging upstream.
