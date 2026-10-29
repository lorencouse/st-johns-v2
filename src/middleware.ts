import { auth } from "@/server/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isSignedIn = !!req.auth;

  // Public routes
  if (
    pathname === "/" ||
    pathname === "/signin" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/api/auth")
  ) {
    // Redirect signed-in users away from landing/signin
    if (isSignedIn && (pathname === "/" || pathname === "/signin")) {
      return NextResponse.redirect(new URL("/app", req.url));
    }
    return NextResponse.next();
  }

  // Protected routes — require auth
  if (!isSignedIn) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  return NextResponse.next();
});

export const config = {
  // Files served from /public (icons, manifest, robots.txt, images) skip the
  // middleware, so signed-out visitors and crawlers get them instead of a
  // redirect to /signin.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|icons/|manifest\\.json|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
