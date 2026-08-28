# BoraBond Remittance Dashboard (Next.js)

Operations console for the BoraBond microservices platform (staff auth, transfers, recipients, notifications).

All API calls go through the **API gateway** (`/api/v1/admin/{domain}/*`). There is **no Supabase client** and no remittance-monolith (`:9002`) dependency.

## Run locally

```bash
npm install
cp .env.local.example .env.local   # edit if needed
npm run dev
```

Requires the API gateway on `http://localhost:9000` (and identity / transfer / customer / notification / payment services behind it).

Sandbox API (same as Vercel Preview on `dev`):

```bash
npm run dev:sandbox
```

## Deploy (Vercel)

| Environment | Branch | Site | API (upstream) |
|-------------|--------|------|----------------|
| Production | `main` | `https://remittance.borabond.com` | `https://core-api.borabond.com` |
| Staging | `dev` | `https://remittance-staging.borabond.com` | `https://staging-api.borabond.com` |

Step-by-step: **[docs/VERCEL_STAGING.md](./docs/VERCEL_STAGING.md)**
