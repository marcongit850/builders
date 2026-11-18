import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import test from "node:test";
import {
  forwardJoinApplication,
  hubApplicationsUrl,
  hubLoginUrl,
  joinApplicationPayload,
  normalizeReferralCode,
  scheduleHubForward,
} from "../src/hub.js";

const registered = register(new URL("./email-hooks.js", import.meta.url));
if (registered && typeof registered.then === "function") await registered;
const { default: worker } = await import("../src/index.js");

const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");

function joinForm(extra = {}) {
  const form = new FormData();
  const values = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "850-555-0100",
    years_in_walton: "12",
    company: "Analytical Engines",
    role: "Builder",
    industry: "Construction",
    website: "https://example.com",
    company_fax: "",
    about: "I build here.",
    ...extra,
  };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

test("hub URL var is the leaders origin and observability stays in place", () => {
  assert.match(wrangler, /\[vars\]\nHUB_URL = "https:\/\/waltonleaders.org"\n/);
  assert.match(
    wrangler,
    /\[observability\]\nenabled = true\n\n\[observability\.logs\]\nhead_sampling_rate = 1\n\n\[observability\.traces\]\nenabled = true\nhead_sampling_rate = 1\n/
  );
  assert.match(
    wrangler,
    /\[\[send_email\]\]\nname = "EMAIL"\ndestination_address = "marc@whpinc.com"\nallowed_sender_addresses = \["hello@waltonbuildersnetwork.org"\]\n/
  );
  assert.equal(wrangler.includes("[[routes]]"), false);
  assert.equal(wrangler.includes("HUB_INGEST_KEY ="), false);
  assert.equal(/[\u2013\u2014]/.test(wrangler), false);
});

test("applications and login URLs are built from the hub origin", () => {
  assert.equal(
    hubApplicationsUrl("https://waltonleaders.org"),
    "https://waltonleaders.org/api/hub/applications"
  );
  assert.equal(
    hubApplicationsUrl("https://waltonleaders.org/api/hub/applications"),
    "https://waltonleaders.org/api/hub/applications"
  );
  assert.equal(hubLoginUrl("https://waltonleaders.org"), "https://waltonleaders.org/login/builders");
  assert.equal(hubLoginUrl(""), "https://waltonleaders.org/login/builders");
  assert.equal(hubLoginUrl("not a url"), "https://waltonleaders.org/login/builders");
});

test("payload keeps every original form field as a string", () => {
  const form = joinForm({ name: " Ada\nLovelace ", website: "", about: "" });
  const payload = joinApplicationPayload({
    name: "Ada Lovelace",
    email: "ada@example.com",
    sourceUrl: "https://waltonbuildersnetwork.org/join",
    form,
    submittedAt: "2026-11-15T13:45:00.000Z",
  });
  assert.deepEqual(payload, {
    network: "builders",
    name: "Ada Lovelace",
    email: "ada@example.com",
    submitted_at: "2026-11-15T13:45:00.000Z",
    source_url: "https://waltonbuildersnetwork.org/join",
    ref: "",
    fields: {
      name: " Ada\nLovelace ",
      email: "ada@example.com",
      phone: "850-555-0100",
      years_in_walton: "12",
      company: "Analytical Engines",
      role: "Builder",
      industry: "Construction",
      website: "",
      company_fax: "",
      about: "",
    },
  });
});

test("forward posts the hub key and fails soft on hub errors", async () => {
  const payload = { network: "builders", name: "Ada", email: "ada@example.com", fields: {} };
  const logs = [];
  const originalError = console.error;
  console.error = (line) => logs.push(String(line));
  try {
    const calls = [];
    await forwardJoinApplication(
      { HUB_URL: "https://waltonleaders.org", HUB_INGEST_KEY: "secret-key" },
      payload,
      {
        fetchImpl: async (url, init) => {
          calls.push({ url, init });
          return new Response("created", { status: 201 });
        },
      }
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://waltonleaders.org/api/hub/applications");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.redirect, "manual");
    assert.equal(calls[0].init.headers["X-Hub-Key"], "secret-key");
    assert.equal(calls[0].init.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(calls[0].init.body), payload);
    assert.equal(logs.length, 0);

    logs.length = 0;
    await forwardJoinApplication(
      { HUB_URL: "https://waltonleaders.org", HUB_INGEST_KEY: "secret-key" },
      payload,
      { fetchImpl: async () => new Response("no", { status: 503 }) }
    );
    assert.equal(JSON.parse(logs[0]).message, "hub forward failed");
    assert.equal(JSON.parse(logs[0]).status, 503);
    assert.equal(logs[0].includes("secret-key"), false);

    logs.length = 0;
    let fetched = false;
    await forwardJoinApplication(
      { HUB_URL: "https://waltonleaders.org" },
      payload,
      { fetchImpl: async () => { fetched = true; return new Response("ok"); } }
    );
    assert.equal(fetched, false);
    assert.equal(JSON.parse(logs[0]).reason, "missing HUB_INGEST_KEY");

    logs.length = 0;
    await forwardJoinApplication(
      { HUB_INGEST_KEY: "secret-key" },
      payload,
      { fetchImpl: async () => { fetched = true; return new Response("ok"); } }
    );
    assert.equal(fetched, false);
    assert.equal(JSON.parse(logs[0]).reason, "missing HUB_URL");

    logs.length = 0;
    await forwardJoinApplication(
      { HUB_URL: "https://waltonleaders.org", HUB_INGEST_KEY: "secret-key" },
      payload,
      {
        timeoutMs: 20,
        fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
      }
    );
    assert.equal(JSON.parse(logs[0]).reason, "timeout");

    logs.length = 0;
    await forwardJoinApplication(
      { HUB_URL: "https://waltonleaders.org", HUB_INGEST_KEY: "secret-key" },
      payload,
      { fetchImpl: async () => { throw new Error("connect failed"); } }
    );
    assert.equal(JSON.parse(logs[0]).reason, "connect failed");
  } finally {
    console.error = originalError;
  }
});

test("scheduleHubForward uses ctx.waitUntil and does not throw", async () => {
  const jobs = [];
  let called = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return new Response("ok", { status: 200 });
  };
  try {
    const pending = scheduleHubForward(
      { waitUntil(promise) { jobs.push(promise); } },
      { HUB_URL: "https://waltonleaders.org", HUB_INGEST_KEY: "secret-key" },
      { network: "builders" }
    );
    assert.equal(pending, null);
    assert.equal(jobs.length, 1);
    await jobs[0];
    assert.equal(called, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function mailEnv(emails) {
  return {
    HUB_URL: "https://waltonleaders.org",
    HUB_INGEST_KEY: "secret-key",
    EMAIL: { async send(message) { emails.push(message); } },
  };
}

async function postJoin(env, ctx, form) {
  return worker.fetch(new Request("https://waltonbuildersnetwork.org/join", {
    method: "POST",
    body: form,
  }), env, ctx);
}

test("a valid join emails Marc and forwards to the hub without waiting on it", async () => {
  const emails = [];
  const hubCalls = [];
  let releaseHub;
  const gate = new Promise((resolve) => { releaseHub = resolve; });
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs = [];
  console.error = (line) => logs.push(String(line));
  globalThis.fetch = async (url, init) => {
    hubCalls.push({ url, init });
    await gate;
    return new Response("ok", { status: 200 });
  };
  const jobs = [];
  try {
    const form = joinForm({ name: "Ada\nLovelace" });
    const responsePromise = postJoin(mailEnv(emails), {
      waitUntil(promise) { jobs.push(promise); },
    }, form);
    const response = await Promise.race([
      responsePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("response waited on the hub")), 200)),
    ]);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "https://waltonbuildersnetwork.org/received?for=join");
    assert.equal(emails.length, 1);
    assert.equal(emails[0].to, "marc@whpinc.com");
    assert.equal(emails[0].from, "hello@waltonbuildersnetwork.org");
    assert.match(emails[0].raw, /From: Walton County Builders Network <hello@waltonbuildersnetwork.org>/);
    assert.match(emails[0].raw, /Reply-To: ada@example.com/);
    assert.match(emails[0].raw, /Subject: Builders Network membership application/);
    const body = [
      "New membership application from the Walton County Builders Network website.",
      "",
      "Full name: Ada Lovelace",
      "Email: ada@example.com",
      "Phone: 850-555-0100",
      "Business or company: Analytical Engines",
      "Role: Builder",
      "Industry or type of work: Construction",
      "How long in Walton County: 12",
      "Business website: https://example.com",
      "",
      "About:",
      "I build here.",
    ].join("\n");
    assert.ok(emails[0].raw.includes(body));
    assert.equal(jobs.length, 1);
    assert.equal(hubCalls.length, 1);
    releaseHub();
    await jobs[0];
    const sent = JSON.parse(hubCalls[0].init.body);
    assert.equal(sent.network, "builders");
    assert.equal(sent.name, "Ada Lovelace");
    assert.equal(sent.email, "ada@example.com");
    assert.equal(sent.source_url, "https://waltonbuildersnetwork.org/join");
    assert.equal(sent.fields.name, "Ada\r\nLovelace");
    assert.equal(sent.fields.company_fax, "");
    assert.equal(sent.ref, "");
    assert.equal(Number.isNaN(Date.parse(sent.submitted_at)), false);
    assert.equal(logs.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test("hub failure and a missing secret still send the email and show success", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs = [];
  console.error = (line) => logs.push(String(line));
  try {
    const emails = [];
    globalThis.fetch = async () => new Response("down", { status: 502 });
    const jobs = [];
    const failed = await postJoin(mailEnv(emails), {
      waitUntil(promise) { jobs.push(promise); },
    }, joinForm());
    await Promise.all(jobs);
    assert.equal(failed.status, 303);
    assert.equal(emails.length, 1);
    assert.equal(JSON.parse(logs[0]).status, 502);

    logs.length = 0;
    const quietEmails = [];
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return new Response("ok"); };
    const quietJobs = [];
    const env = mailEnv(quietEmails);
    delete env.HUB_INGEST_KEY;
    const skipped = await postJoin(env, {
      waitUntil(promise) { quietJobs.push(promise); },
    }, joinForm());
    await Promise.all(quietJobs);
    assert.equal(skipped.status, 303);
    assert.equal(quietEmails.length, 1);
    assert.equal(fetched, false);
    assert.match(JSON.parse(logs[0]).reason, /HUB_INGEST_KEY/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test("invalid, honeypot, and contact submissions are not forwarded", async () => {
  const originalFetch = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return new Response("ok"); };
  try {
    const emails = [];
    const env = mailEnv(emails);
    const ctx = { waitUntil() { throw new Error("waitUntil should not run"); } };
    const invalid = await postJoin(env, ctx, joinForm({ phone: "" }));
    assert.equal(invalid.status, 400);
    assert.equal(emails.length, 0);

    const honeypot = await postJoin(env, ctx, joinForm({ company_fax: "spam" }));
    assert.equal(honeypot.status, 303);
    assert.equal(honeypot.headers.get("Location"), "https://waltonbuildersnetwork.org/received?for=join");
    assert.equal(emails.length, 0);

    const contact = new FormData();
    contact.set("name", "Ada Lovelace");
    contact.set("email", "ada@example.com");
    contact.set("message", "Hello");
    contact.set("company_fax", "");
    const sent = await worker.fetch(new Request("https://waltonbuildersnetwork.org/contact", {
      method: "POST",
      body: contact,
    }), env, ctx);
    assert.equal(sent.status, 303);
    assert.equal(sent.headers.get("Location"), "https://waltonbuildersnetwork.org/received?for=contact");
    assert.equal(emails.length, 1);
    assert.match(emails[0].raw, /Subject: Builders Network contact/);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email failure does not forward and still shows the try again page", async () => {
  const originalFetch = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return new Response("ok"); };
  try {
    const response = await postJoin({
      HUB_URL: "https://waltonleaders.org",
      HUB_INGEST_KEY: "secret-key",
      EMAIL: { async send() { throw new Error("mailbox unavailable"); } },
    }, { waitUntil() { throw new Error("waitUntil should not run"); } }, joinForm());
    assert.equal(response.status, 200);
    assert.match(await response.text(), /We could not send that just now/);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("payload sets top-level ref from the form", () => {
  const form = joinForm({ ref: " KMNP2345 " });
  const payload = joinApplicationPayload({
    name: "Ada Lovelace",
    email: "ada@example.com",
    sourceUrl: "https://waltonbuildersnetwork.org/join",
    form,
    submittedAt: "2026-11-15T13:45:00.000Z",
  });
  assert.equal(payload.ref, " KMNP2345 ");
  assert.equal(payload.fields.ref, " KMNP2345 ");
  assert.equal(form.get("ref"), payload.ref);
});

test("referral codes stay inside the invite alphabet", () => {
  assert.equal(normalizeReferralCode(" ABCD2345 "), "abcd2345");
  assert.equal(normalizeReferralCode("abcdefgu"), "abcdefgu");
  assert.equal(normalizeReferralCode("abci2345"), "");
  assert.equal(normalizeReferralCode("abcdl345"), "");
  assert.equal(normalizeReferralCode("abcdo345"), "");
  assert.equal(normalizeReferralCode("abcd0345"), "");
  assert.equal(normalizeReferralCode("abcd1345"), "");
  assert.equal(normalizeReferralCode("abcd234"), "");
  assert.equal(normalizeReferralCode("abcd23450"), "");
  assert.equal(normalizeReferralCode(""), "");
  assert.equal(normalizeReferralCode(null), "");
  const hubSrc = readFileSync(new URL("../src/hub.js", import.meta.url), "utf8");
  const indexSrc = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  assert.equal(/[\u2013\u2014]/.test(hubSrc), false);
  assert.equal(/[\u2013\u2014]/.test(indexSrc), false);
  assert.match(indexSrc, /escapeHtml\(normalizeReferralCode\(ref\)\)/);
  assert.match(indexSrc, /url\.searchParams\.get\("ref"\)/);
});

function formSlice(html, className) {
  const start = html.indexOf(`class="${className}"`);
  assert.ok(start >= 0, className);
  const end = html.indexOf("</form>", start);
  assert.ok(end > start, className);
  return html.slice(start, end);
}

test("join pages keep a personal invite ref on the apply form only", async () => {
  const env = {};
  const ctx = { waitUntil() {} };

  const plain = await worker.fetch(new Request("https://waltonbuildersnetwork.org/join"), env, ctx);
  const plainHtml = await plain.text();
  assert.match(formSlice(plainHtml, "apply-form"), /<input type="hidden" name="ref" value="">/);
  assert.equal(formSlice(plainHtml, "contact-form").includes('name="ref"'), false);
  assert.equal(plainHtml.split('name="ref"').length - 1, 1);
  assert.equal(plain.headers.get("Cache-Control"), "no-store");
  assert.equal(plain.headers.get("Vary"), null);

  const page = await worker.fetch(new Request("https://waltonbuildersnetwork.org/join?ref=%20ABCD2345%20"), env, ctx);
  const html = await page.text();
  assert.match(formSlice(html, "apply-form"), /<input type="hidden" name="ref" value="abcd2345">/);
  assert.equal(formSlice(html, "contact-form").includes('name="ref"'), false);
  assert.equal(html.split('name="ref"').length - 1, 1);
  assert.equal(page.headers.get("Cache-Control"), "no-store");
  assert.equal(page.headers.get("Vary"), "*");
  assert.equal(/[\u2013\u2014]/.test(html), false);

  const other = await worker.fetch(new Request("https://waltonbuildersnetwork.org/join.html?ref=efgh6789"), env, ctx);
  const otherHtml = await other.text();
  assert.match(formSlice(otherHtml, "apply-form"), /<input type="hidden" name="ref" value="efgh6789">/);
  assert.equal(formSlice(otherHtml, "contact-form").includes('name="ref"'), false);
  assert.equal(other.headers.get("Cache-Control"), "no-store");
  assert.equal(other.headers.get("Vary"), "*");
  assert.equal(html.includes("efgh6789"), false);
  assert.equal(otherHtml.includes("abcd2345"), false);

  const rejected = ["abci2345", "abcdl345", "abcdo345", "abcd0345", "abcd1345", "abcd234", "abcd23450", "abcd2345\"><script>"];
  for (const bad of rejected) {
    const res = await worker.fetch(new Request(`https://waltonbuildersnetwork.org/join?ref=${encodeURIComponent(bad)}`), env, ctx);
    const body = await res.text();
    assert.match(formSlice(body, "apply-form"), /<input type="hidden" name="ref" value="">/, bad);
    assert.equal(formSlice(body, "apply-form").includes(bad), false, bad);
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    assert.equal(res.headers.get("Vary"), "*");
  }

  const head = await worker.fetch(new Request("https://waltonbuildersnetwork.org/join?ref=abcd2345", { method: "HEAD" }), env, ctx);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("Cache-Control"), "no-store");
  assert.equal(head.headers.get("Vary"), "*");

  const headPlain = await worker.fetch(new Request("https://waltonbuildersnetwork.org/join.html", { method: "HEAD" }), env, ctx);
  assert.equal(headPlain.status, 200);
  assert.equal(await headPlain.text(), "");
  assert.equal(headPlain.headers.get("Vary"), null);
});

test("a posted join forwards the form ref and leaves the email unchanged", async () => {
  const emails = [];
  const hubCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    hubCalls.push({ url, init });
    return new Response("ok", { status: 200 });
  };
  const jobs = [];
  try {
    const response = await postJoin(mailEnv(emails), {
      waitUntil(promise) { jobs.push(promise); },
    }, joinForm({ ref: " KMNP2345 " }));
    assert.equal(response.status, 303);
    await Promise.all(jobs);
    assert.equal(emails.length, 1);
    assert.equal(emails[0].raw.includes("KMNP2345"), false);
    const sent = JSON.parse(hubCalls[0].init.body);
    assert.equal(sent.ref, " KMNP2345 ");
    assert.equal(sent.fields.ref, " KMNP2345 ");
    assert.equal(sent.ref, joinForm({ ref: " KMNP2345 " }).get("ref"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("login page and header Login link send members to the hub", async () => {
  const env = { HUB_URL: "https://waltonleaders.org" };
  const ctx = { waitUntil() {} };
  const login = await worker.fetch(new Request("https://waltonbuildersnetwork.org/login"), env, ctx);
  assert.equal(login.status, 302);
  assert.equal(login.headers.get("Location"), "https://waltonleaders.org/login/builders");

  const posted = await worker.fetch(new Request("https://waltonbuildersnetwork.org/login", {
    method: "POST",
    body: new URLSearchParams({ email: "ada@example.com", password: "secret" }),
  }), env, ctx);
  assert.equal(posted.status, 302);
  assert.equal(posted.headers.get("Location"), "https://waltonleaders.org/login/builders");

  const htmlLogin = await worker.fetch(new Request("https://waltonbuildersnetwork.org/login.html"), env, ctx);
  assert.equal(htmlLogin.status, 302);
  assert.equal(htmlLogin.headers.get("Location"), "https://waltonleaders.org/login/builders");

  const www = await worker.fetch(new Request("http://www.waltonbuildersnetwork.org/login"), env, ctx);
  assert.equal(www.status, 301);
  assert.equal(www.headers.get("Location"), "https://waltonbuildersnetwork.org/login");

  const home = await worker.fetch(new Request("https://waltonbuildersnetwork.org/"), env, ctx);
  const html = await home.text();
  assert.match(html, /href="https:\/\/waltonleaders.org\/login\/builders">Login</);
  assert.match(html, /class="nav-login-bar" href="https:\/\/waltonleaders.org\/login\/builders">Login</);
  assert.match(html, /href="https:\/\/waltonleaders.org\/login\/builders">Sign in</);
  assert.equal(html.includes('action="/login"'), false);
});
