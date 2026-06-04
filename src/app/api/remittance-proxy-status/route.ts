import { NextResponse } from "next/server";

import {
  getRemittanceApiUpstream,
  getRemittanceApiUpstreamLabel,
} from "@/lib/remittance-api-upstream";

export const dynamic = "force-dynamic";

/**
 * GET /api/remittance-proxy-status — confirms server-side proxy config (no secrets).
 */
export async function GET() {
  const upstream = getRemittanceApiUpstream();
  let healthStatus: number | null = null;
  let healthOk = false;

  if (upstream) {
    try {
      const res = await fetch(`${upstream}/health`, { cache: "no-store" });
      healthStatus = res.status;
      healthOk = res.ok;
    } catch {
      healthStatus = null;
    }
  }

  return NextResponse.json({
    proxyConfigured: Boolean(upstream),
    upstreamHost: getRemittanceApiUpstreamLabel(),
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV,
    remittanceApiUpstreamSet: Boolean(process.env.REMITTANCE_API_UPSTREAM?.trim()),
    healthStatus,
    healthOk,
  });
}
