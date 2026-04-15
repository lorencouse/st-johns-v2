import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/server/auth";

export async function GET(req: NextRequest) {
  if (
    req.nextUrl.pathname.endsWith("/callback/google") &&
    req.nextUrl.searchParams.get("error") === "access_denied"
  ) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("auth_error", "access_denied");
    return NextResponse.redirect(url);
  }

  return handlers.GET(req);
}

export const POST = handlers.POST;
