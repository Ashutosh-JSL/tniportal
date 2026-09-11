import { NextRequest, NextResponse } from "next/server";

/**
 * Security Middleware
 * Adds security headers to all responses and prevents XSS attacks
 */
export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  // Add security headers to all responses
  const securityHeaders = {
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // Prevent clickjacking
    "X-Frame-Options": "DENY",

    // Referrer policy
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Strict Transport Security (enable in production with HTTPS)
    // "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  };

  // Note: X-Powered-By header removal is handled by IIS web.config
  // to ensure it's stripped from all responses before client receives

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// Configure middleware to run on all routes
export const config = {
  matcher: [
    // Match all paths except:
    // - Static assets (handled by Next.js)
    // - Next.js internal routes
    // - Auth routes (handled separately if needed)
    "/((?!_next|_vercel|static|favicon.ico|sw.js|favicon.ico).*)",
  ],
};
