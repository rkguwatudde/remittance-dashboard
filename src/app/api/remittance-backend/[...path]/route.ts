import { NextRequest, NextResponse } from "next/server";

import {
  getRemittanceApiUpstream,
  getRemittanceApiUpstreamLabel,
} from "@/lib/remittance-api-upstream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FORWARD_REQUEST_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "accept-language",
  "x-requested-with",
  "x-idempotency-key",
] as const;

async function proxyToRemittanceApi(req: NextRequest, pathSegments: string[]) {
  try {
    const upstream = getRemittanceApiUpstream();
    if (!upstream) {
      return NextResponse.json(
        {
          success: false,
          code: "PROXY_NOT_CONFIGURED",
          message:
            "REMITTANCE_API_UPSTREAM is not set on the dashboard server. Configure it in Vercel (Preview) and redeploy.",
        },
        { status: 503 },
      );
    }

    const path = pathSegments.join("/");
    const targetUrl = `${upstream}/${path}${req.nextUrl.search}`;

    const headers = new Headers();
    for (const name of FORWARD_REQUEST_HEADERS) {
      const value = req.headers.get(name);
      if (value) headers.set(name, value);
    }

    const init: RequestInit = {
      method: req.method,
      headers,
      redirect: "manual",
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = await req.arrayBuffer();
    }

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(targetUrl, init);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Upstream fetch failed";
      return NextResponse.json(
        {
          success: false,
          code: "UPSTREAM_UNREACHABLE",
          message: `Could not reach API gateway at ${getRemittanceApiUpstreamLabel()}.`,
          data: { detail },
        },
        { status: 502 },
      );
    }

    const responseHeaders = new Headers();
    const contentType = upstreamRes.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Proxy handler failed";
    return NextResponse.json(
      {
        success: false,
        code: "PROXY_HANDLER_ERROR",
        message: "Dashboard API proxy failed.",
        data: {
          detail,
          upstreamHost: getRemittanceApiUpstreamLabel(),
        },
      },
      { status: 500 },
    );
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToRemittanceApi(req, path);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToRemittanceApi(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToRemittanceApi(req, path);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToRemittanceApi(req, path);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToRemittanceApi(req, path);
}

export async function OPTIONS(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToRemittanceApi(req, path);
}
