import { defineMiddleware } from "astro:middleware";

const META_ORIGINS = 'self "https://www.facebook.com" "https://connect.facebook.net"';

export const onRequest = defineMiddleware(async (context, next) => {
  const downstream = await next();
  const response = new Response(downstream.body, downstream);
  const headers = response.headers;

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set(
    "Permissions-Policy",
    `ch-ua=(${META_ORIGINS}), ch-ua-mobile=(${META_ORIGINS}), ch-ua-platform=(${META_ORIGINS})`,
  );
  headers.set("Accept-CH", "Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Platform");
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
      "connect-src 'self' https://connect.facebook.net https://www.facebook.com https://graph.facebook.com",
      "img-src 'self' data: https://www.facebook.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
    ].join("; "),
  );

  if (context.url.pathname.startsWith("/lp/")) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  return response;
});
