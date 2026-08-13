# Vercel: production vs staging (`remittance-dashboard`)

The dashboard talks to the **API gateway** via **`NEXT_PUBLIC_REMITTANCE_API_URL`** (`src/lib/remittance-admin-api.ts`).

Production uses a **same-origin proxy** so the browser does not hit cross-origin CORS on the API host. Staging should use the **same pattern**.

## URLs (your setup)

| Role | Production | Staging (sandbox) |
|------|------------|-------------------|
| **Dashboard** (Vercel) | `https://remittance.borabond.com` | `https://remittance-staging.borabond.com` (Preview on `dev`) |
| **API gateway** | `https://api.borabond.com` | `https://staging-api.borabond.com` |

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
| `REMITTANCE_API_UPSTREAM` | `https://api.borabond.com` |
| `NEXT_PUBLIC_REMITTANCE_API_URL` | `/api/remittance-backend` |

`next.config.ts` no longer uses build-time rewrites. **`src/app/api/remittance-backend/[...path]/route.ts`** proxies at **runtime** using `REMITTANCE_API_UPSTREAM` (server-only env on Vercel).

### Preview / `dev` branch only (check **Preview**, uncheck Production)

| Variable | Value |
|----------|--------|
| `REMITTANCE_API_UPSTREAM` | `https://staging-api.borabond.com` |
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

## API gateway (sandbox EC2)

After the dashboard URL exists, allow the Vercel origin on the **API gateway** and set identity email links to the dashboard host:

- `ADMIN_DASHBOARD_BASE_URL=https://remittance-staging.borabond.com` (identity-service)
- Gateway `CORS_ORIGIN` includes `https://remittance-staging.borabond.com` and `http://localhost:3000`

With the **proxy** pattern above, the browser only calls `/api/remittance-backend` on the dashboard origin. CORS still matters for any direct gateway calls.

Do **not** point this app at the remittance monolith (`:9002`) or Supabase.

## Verify

1. Open `https://remittance-staging.borabond.com` (or the Preview URL) → sign in.
2. DevTools → Network → API requests should go to **`/api/remittance-backend/...`** on the **same host**, not `api.borabond.com`.
3. Upstream is the **API gateway** (`https://staging-api.borabond.com` → EC2 `:9000`).
4. Production `https://remittance.borabond.com` must still use production upstream only.

## Troubleshooting login / `500` on `/api/remittance-backend/...`

### How the request flows

```
Browser  →  remittance-staging.borabond.com/api/remittance-backend/api/v1/admin/auth/login
         →  Vercel (Next.js proxy route)
         →  https://staging-api.borabond.com/api/v1/admin/auth/login
         →  EC2 api-gateway :9000 → identity-service
```

The **gateway / identity-service** should answer login directly:

```bash
curl -sS https://staging-api.borabond.com/health
curl -sS -X POST https://staging-api.borabond.com/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@borabond.com","password":"YourPass123!"}'
```

Expect `401` for wrong credentials, not `500`.

### Diagnostic URL (after deploy)

While signed in to staging, open:

`https://remittance-staging.borabond.com/api/remittance-proxy-status`

You should see JSON like `{ "proxyConfigured": true, "upstreamHost": "staging-api.borabond.com", "healthOk": true }`. If `proxyConfigured` is false or `healthOk` is false, fix env/upstream before debugging login.

### Common causes of dashboard `500`

| Cause | Fix |
|-------|-----|
| **Cloudflare 522 / HTML error from `staging-remittance.borabond.com`** | That host is the **retired remittance Nest origin** (`:9002`). It is down. Set Preview `REMITTANCE_API_UPSTREAM` to `https://staging-api.borabond.com` and `NEXT_PUBLIC_REMITTANCE_API_URL` to `/api/remittance-backend`, then redeploy. Do not point the dashboard at `staging-remittance.borabond.com`. |
| **Vercel Deployment Protection** (SSO on Preview) | **Settings → Deployment Protection → Deployment Protection Exceptions** — add `remittance-staging.borabond.com` so the staging dashboard (and `/api/*`) is publicly reachable. See [Vercel docs](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions). |
| **No admin user on sandbox DB** | Apply staff migration into `identity.staff_accounts`, or bootstrap once: `POST /api/v1/admin/auth/bootstrap` on identity-service (env-gated). Wrong password returns **401**, not 500. |
| **API crash on valid login** (correct email/password) | Check `api-gateway` then `identity-service` logs. Often JWT secret mismatch (`ADMIN_JWT_SECRET`) or empty `identity.staff_accounts`. |

### Env checklist (Preview / `dev`)

- `REMITTANCE_API_UPSTREAM` = `https://staging-api.borabond.com` (no trailing slash)
- `NEXT_PUBLIC_REMITTANCE_API_URL` = `/api/remittance-backend`
- Not set to **All Environments** with production values
- Redeploy Preview after changing either variable

## Local development

**Against sandbox API** (same as Vercel Preview):

```bash
# remittance-dashboard/.env.local
REMITTANCE_API_UPSTREAM=https://staging-api.borabond.com
NEXT_PUBLIC_REMITTANCE_API_URL=/api/remittance-backend
```

```bash
npm run dev:sandbox
```

**Local gateway only:**

```bash
NEXT_PUBLIC_REMITTANCE_API_URL=/api/remittance-backend
REMITTANCE_API_UPSTREAM=http://localhost:9000
npm run dev
```

## New Vercel project checklist

1. Import **remittance-dashboard** repo (root directory = `remittance-dashboard` if monorepo).
2. Framework: **Next.js**.
3. Set env vars (Production vs Preview) as above.
4. Production branch `main`, connect `dev` for Preview.
5. Add domains `remittance.borabond.com` + `remittance-staging.borabond.com`.
6. Push `dev` → confirm Preview build uses staging upstream.
