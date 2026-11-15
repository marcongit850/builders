// Soft forward of a valid membership application to the shared leaders hub.
// A missing secret, a hub error, or a timeout must not affect the applicant.

export const HUB_NETWORK = "builders";
export const HUB_TIMEOUT_MS = 4000;
const HUB_LOGIN_FALLBACK = "https://waltonleaders.org/login/builders";

function usableHubUrl(hubUrl) {
  if (typeof hubUrl !== "string") return "";
  const trimmed = hubUrl.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url;
  } catch {
    return "";
  }
}

export function hubLoginUrl(hubUrl) {
  const url = usableHubUrl(hubUrl);
  if (!url) return HUB_LOGIN_FALLBACK;
  url.pathname = "/login/builders";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function hubApplicationsUrl(hubUrl) {
  const url = usableHubUrl(hubUrl);
  if (!url) return "";
  url.pathname = "/api/hub/applications";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function joinApplicationPayload({ name, email, sourceUrl, form, submittedAt }) {
  const fields = {};
  if (form && typeof form.entries === "function") {
    for (const [key, value] of form.entries()) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) continue;
      fields[key] = typeof value === "string" ? value : value == null ? "" : String(value);
    }
  }
  return {
    network: HUB_NETWORK,
    name: String(name),
    email: String(email),
    submitted_at: submittedAt,
    source_url: String(sourceUrl),
    fields,
  };
}

function logHub(entry) {
  console.error(JSON.stringify(entry));
}

export async function forwardJoinApplication(env, payload, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? HUB_TIMEOUT_MS;
  const key = env && typeof env.HUB_INGEST_KEY === "string" ? env.HUB_INGEST_KEY : "";
  const applicationsUrl = hubApplicationsUrl(env && env.HUB_URL);
  if (!key || !applicationsUrl) {
    const missing = [];
    if (!key) missing.push("HUB_INGEST_KEY");
    if (!applicationsUrl) missing.push("HUB_URL");
    logHub({ message: "hub forward skipped", reason: "missing " + missing.join(" and ") });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(applicationsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Key": key,
      },
      body: JSON.stringify(payload),
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.body && typeof response.body.cancel === "function") {
      try {
        await response.body.cancel();
      } catch {
        // Closing an unread hub body must not change the applicant result.
      }
    }
    if (!response.ok) {
      logHub({ message: "hub forward failed", status: response.status });
    }
  } catch (err) {
    const name = err && err.name;
    const reason = name === "AbortError" || name === "TimeoutError"
      ? "timeout"
      : (err && err.message) || String(err);
    logHub({ message: "hub forward failed", reason });
  } finally {
    clearTimeout(timer);
  }
}

export function scheduleHubForward(ctx, env, payload) {
  const pending = forwardJoinApplication(env, payload);
  if (ctx && typeof ctx.waitUntil === "function") {
    try {
      ctx.waitUntil(pending);
      return null;
    } catch (err) {
      logHub({
        message: "hub forward failed",
        reason: (err && err.message) || String(err),
      });
    }
  }
  return pending;
}
