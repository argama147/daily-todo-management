import { NextResponse, type NextRequest } from "next/server";

// 許可する Chrome 拡張オリジン。Vercel/環境変数 CHROME_EXTENSION_IDS に
// カンマ区切りで複数 ID を登録できる（例: "abcdefgh...,ijklmnop..."）。
const allowedExtensionIds = (process.env.CHROME_EXTENSION_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = new Set(
  allowedExtensionIds.map((id) => `chrome-extension://${id}`)
);

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const isAllowed = origin !== "" && allowedOrigins.has(origin);

  if (request.method === "OPTIONS") {
    if (!isAllowed) {
      return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  const response = NextResponse.next();
  if (isAllowed) {
    for (const [key, value] of Object.entries(corsHeaders(origin))) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export const config = {
  matcher: "/api/tasks/:path*",
};
