const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function documentPage(status: number, heading: string, linkHref: string, linkLabel: string): Response {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${heading} | Walton County Builders Network</title>
    <meta name="robots" content="noindex">
    <meta name="theme-color" content="#f6f3ec">
    <link rel="icon" href="/assets/walton-county-builders-network-logo.jpg" type="image/jpeg">
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="/" aria-label="Walton County Builders Network home">
          <img class="brand-mark" src="/assets/walton-county-builders-network-logo.jpg" alt="" width="1024" height="1024">
          <span class="brand-name"><span>Walton County</span>Builders Network</span>
        </a>
      </div>
    </header>
    <main class="notice">
      <div class="container">
        <h1>${heading}</h1>
        <a class="text-link" href="${linkHref}">${linkLabel}</a>
      </div>
    </main>
  </body>
</html>`;
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  return withSecurityHeaders(new Response(html, { status, headers }));
}

async function handleContact(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return documentPage(
      400,
      "Please enter your name, a valid email address, and a message.",
      "/#contact",
      "Return to the form",
    );
  }

  const name = fieldValue(form, "name");
  const email = fieldValue(form, "email");
  const message = fieldValue(form, "message");
  const complete = name.length > 0 && email.length > 0 && message.length > 0 && EMAIL_PATTERN.test(email);
  const withinLimits = name.length <= 120 && email.length <= 200 && message.length <= 4000;

  if (!complete || !withinLimits) {
    return documentPage(
      400,
      "Please enter your name, a valid email address, and a message.",
      "/#contact",
      "Return to the form",
    );
  }

  return documentPage(200, "Thank you for getting in touch.", "/", "Return to the homepage");
}

export default {
  async fetch(request, env): Promise<Response> {
    const method = request.method.toUpperCase();
    const url = new URL(request.url);

    if (url.pathname === "/contact") {
      if (method === "POST") {
        return handleContact(request);
      }
      if (method === "GET" || method === "HEAD") {
        return new Response(null, {
          status: 303,
          headers: { Location: new URL("/#contact", url).toString() },
        });
      }
      return text("Method not allowed", 405, { Allow: "POST" });
    }

    if (method !== "GET" && method !== "HEAD") {
      return text("Method not allowed", 405, { Allow: "GET, HEAD" });
    }

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
