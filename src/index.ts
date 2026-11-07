const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function text(body: string, status: number, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return withSecurityHeaders(new Response(body, { status, headers }));
}

function isPreviewAsset(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/styles.css" ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/assets/")
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return text("Method not allowed", 405, { Allow: "GET, HEAD" });
    }

    const url = new URL(request.url);
    if (!isPreviewAsset(url.pathname)) {
      return text("Not found", 404);
    }

    const asset = await env.ASSETS.fetch(request);
    if (asset.status >= 500) {
      console.error(
        JSON.stringify({
          message: "static asset request failed",
          status: asset.status,
          path: url.pathname,
        }),
      );
    }

    const response = withSecurityHeaders(asset);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    }
    if (method === "HEAD") {
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
