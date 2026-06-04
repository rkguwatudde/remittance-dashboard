# BoraBond Remittance Dashboard (Next.js)

Operations console for remittance-api (admin auth, transfers, queue, users).

## Run locally

```bash
npm install
cp .env.local.example .env.local   # edit if needed
npm run dev
```

Sandbox API (same as Vercel Preview on `dev`):

```bash
npm run dev:sandbox
```

## Deploy (Vercel)

| Environment | Branch | Site | API (upstream) |
|-------------|--------|------|----------------|
| Production | `main` | `https://remittance.borabond.com` | `https://remittance.api.borabond.com` |
| Staging | `dev` | `https://remittance-staging.borabond.com` | `https://staging-remittance.borabond.com` |

Step-by-step (mirror **customer-app**): **[docs/VERCEL_STAGING.md](./docs/VERCEL_STAGING.md)**

Backend sandbox: [../docs/remittance-SANDBOX-DEPLOY.md](../docs/remittance-SANDBOX-DEPLOY.md)
