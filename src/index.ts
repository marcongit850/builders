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
    pathname === "/join" ||
    pathname === "/join.html" ||
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function documentPage(
  status: number,
  heading: string,
  linkHref: string,
  linkLabel: string,
  detail?: string,
): Response {
  const detailHtml = detail ? `<p>${escapeHtml(detail)}</p>` : "";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(heading)} | Walton County Builders Network</title>
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
        <h1>${escapeHtml(heading)}</h1>
        ${detailHtml}
        <a class="text-link" href="${escapeHtml(linkHref)}">${escapeHtml(linkLabel)}</a>
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

function validWebsite(value: string): boolean {
  if (!value) return true;
  if (value.length > 200 || /\s/.test(value)) return false;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

function validPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return value.length <= 40 && digits.length >= 7 && digits.length <= 15;
}

async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

async function deliver(env: Env, subject: string, replyTo: string, text: string): Promise<boolean> {
  try {
    await env.EMAIL.send({
      to: env.CONTACT_TO,
      from: { name: "Walton County Builders Network", email: env.EMAIL_FROM },
      replyTo,
      subject,
      text,
    });
    return true;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    console.error(JSON.stringify({ message: "email send failed", subject, code }));
    return false;
  }
}

function contactBody(name: string, email: string, message: string): string {
  return [`Name: ${name}`, `Email: ${email}`, "", "Message:", message].join("\n");
}

async function handleContact(request: Request, env: Env): Promise<Response> {
  const form = await readForm(request);
  const name = form ? fieldValue(form, "name") : "";
  const email = form ? fieldValue(form, "email") : "";
  const message = form ? fieldValue(form, "message") : "";
  const valid =
    name.length > 0 &&
    name.length <= 120 &&
    EMAIL_PATTERN.test(email) &&
    email.length <= 200 &&
    message.length > 0 &&
    message.length <= 4000;

  if (!valid) {
    return documentPage(
      400,
      "Please enter your name, a valid email address, and a message.",
      "/",
      "Return to the homepage",
    );
  }

  const sent = await deliver(env, "Builders Network contact", email, contactBody(name, email, message));
  if (!sent) {
    return documentPage(502, "We could not send your message. Please try again.", "/", "Return to the homepage");
  }

  return documentPage(200, "Thank you for getting in touch.", "/", "Return to the homepage");
}

function shown(value: string): string {
  return value || "Not provided";
}

async function handleJoin(request: Request, env: Env): Promise<Response> {
  const form = await readForm(request);
  const name = form ? fieldValue(form, "name") : "";
  const email = form ? fieldValue(form, "email") : "";
  const phone = form ? fieldValue(form, "phone") : "";
  const company = form ? fieldValue(form, "company") : "";
  const role = form ? fieldValue(form, "role") : "";
  const industry = form ? fieldValue(form, "industry") : "";
  const waltonTime = form ? fieldValue(form, "walton_time") : "";
  const website = form ? fieldValue(form, "website") : "";
  const note = form ? fieldValue(form, "note") : "";
  const required = [name, company, role, industry, waltonTime];
  const valid =
    required.every((value) => value.length > 0 && value.length <= 160) &&
    name.length <= 120 &&
    EMAIL_PATTERN.test(email) &&
    email.length <= 200 &&
    validPhone(phone) &&
    validWebsite(website) &&
    note.length <= 4000;

  if (!valid) {
    return documentPage(
      400,
      "Please complete the required fields. Use a valid email address and phone number. Leave the website blank, or enter a valid address.",
      "/join",
      "Return to the application",
    );
  }

  const text = [
    `Full name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Business or company: ${company}`,
    `Role at your company: ${role}`,
    `Industry or type of work: ${industry}`,
    `How long in Walton County: ${waltonTime}`,
    `Business website: ${shown(website)}`,
    "",
    "Who you are, or why you want to join:",
    shown(note),
  ].join("\n");

  const sent = await deliver(env, "Builders Network membership application", email, text);
  if (!sent) {
    return documentPage(
      502,
      "We could not submit your application. Please try again.",
      "/join",
      "Return to the application",
    );
  }

  return documentPage(
    200,
    "Thank you for applying.",
    "/",
    "Return to the homepage",
    "Your application will be reviewed.",
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    const method = request.method.toUpperCase();
    const url = new URL(request.url);

    if (url.pathname === "/contact") {
      if (method === "POST") {
        return handleContact(request, env);
      }
      if (method === "GET" || method === "HEAD") {
        return new Response(null, {
          status: 303,
          headers: { Location: new URL("/", url).toString() },
        });
      }
      return text("Method not allowed", 405, { Allow: "POST" });
    }

    if (url.pathname === "/join") {
      if (method === "POST") {
        return handleJoin(request, env);
      }
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
    if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/join" || url.pathname === "/join.html") {
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
