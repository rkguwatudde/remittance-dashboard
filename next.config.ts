import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo parent (`main-app`) when present — not used on Vercel if only this app is deployed (avoids broken tracing / ENOENT). */
const parentDir = path.join(__dirname, "..");
const parentHasWorkspaceLockfile = fs.existsSync(
  path.join(parentDir, "package-lock.json"),
);

/**
 * Browser calls `/api/remittance-backend/*` (NEXT_PUBLIC_REMITTANCE_API_URL).
 * Proxying is handled at runtime by `src/app/api/remittance-backend/[...path]/route.ts`
 * using REMITTANCE_API_UPSTREAM (server env) which should be the API gateway.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@react-pdf/renderer"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
  ...(parentHasWorkspaceLockfile
    ? { outputFileTracingRoot: parentDir }
    : {}),
};

export default nextConfig;
