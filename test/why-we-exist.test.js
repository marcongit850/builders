import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import test from "node:test";
import {
  renderMarkdown,
  renderWhyArticleBody,
  renderWhyWeExistPage,
  WHY_CANONICAL,
  WHY_DESCRIPTION,
  WHY_DOCUMENT_TITLE,
  WHY_TITLE,
} from "../src/why-we-exist.js";

const registered = register(new URL("./email-hooks.js", import.meta.url));
if (registered && typeof registered.then === "function") await registered;

const { default: worker } = await import("../src/index.js");

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const CSP =
  "default-src 'none'; script-src 'self' 'unsafe-inline' https://*.googletagmanager.com https://*.google-analytics.com https://connect.facebook.net; img-src 'self' https://*.google-analytics.com https://*.googletagmanager.com https://www.facebook.com; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.facebook.com https://connect.facebook.net; form-action 'self'; base-uri 'none'";

function readStringConst(name) {
  const token = `const ${name} = "`;
  const start = source.indexOf(token);
  assert.notEqual(start, -1, name);
  let i = start + token.length;
  let out = "";
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      const next = source[i + 1];
      if (next === "n") out += "\n";
      else if (next === "r") out += "\r";
      else if (next === '"') out += '"';
      else if (next === "\\") out += "\\";
      else throw new Error(`unexpected escape \\${next} in ${name}`);
      i += 2;
      continue;
    }
    if (ch === '"') return out;
    out += ch;
    i += 1;
  }
  throw new Error(`unterminated ${name}`);
}

function sliceBetween(html, startMark, endMark) {
  const start = html.indexOf(startMark);
  assert.notEqual(start, -1, startMark);
  const end = html.indexOf(endMark, start);
  assert.notEqual(end, -1, endMark);
  return html.slice(start, end);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function paragraphs(html) {
  return [...html.matchAll(/<p(?: class="[^"]*")?>([\s\S]*?)<\/p>/g)].map((match) =>
    match[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );
}

const HOME = readStringConst("HOME");
const JOIN = readStringConst("JOIN");
const page = renderWhyWeExistPage(JOIN);
const article = renderWhyArticleBody();

const HOME_PARAGRAPHS = [
  "You're busy building homes, selling properties, managing projects, and keeping customers satisfied. Meanwhile, local government continues reviewing proposals that could change the way you do business.",
  "By the time you discover the impact, the opportunity to influence the decision may have already passed.",
  "That's why Walton County Builders Network exists.",
];

const ARTICLE_PARAGRAPHS = [
  "If you work in construction, development, or real estate in Walton County, decisions made at the county level can directly affect your livelihood, whether you know about them or not.",
  "You're busy building homes, selling properties, managing projects, coordinating subcontractors, meeting deadlines, and keeping customers satisfied.",
  "Meanwhile, local government continues reviewing proposals that could change the way you do business.",
  "A new setback requirement. Changes to permitted land uses. Higher impact fees. Additional environmental restrictions. More complicated permitting procedures. New rules affecting what property owners can build, improve, or develop.",
  "Sometimes these changes happen incrementally, one ordinance or administrative requirement at a time.",
  "And that's what makes them so easy to miss.",
  "A seemingly minor adjustment to a land development code might not make headlines. But it could affect property values, construction costs, development opportunities, or the ability of an owner to use their land.",
  "By the time you discover the impact, the opportunity to influence the decision may have already passed.",
  "Most builders, contractors, developers, real estate agents, engineers, architects, and industry professionals simply don't have the time to monitor every county meeting and proposed regulation.",
  "They're too busy working.",
  "That's why Walton County Builders Network exists.",
  "Our mission is to help keep the industry informed about proposed changes, encourage participation before important votes, and provide a unified voice for the professionals who build, develop, buy, sell, improve, and maintain Walton County.",
  "We support responsible growth, fair regulations, private property rights, efficient permitting, and a transparent local government.",
  "We're not suggesting every proposed change is bad. We're saying the people affected deserve to know what's being proposed, understand the consequences, and have an opportunity to speak.",
  "Your industry shouldn't discover the rules have changed when you submit your next permit application.",
  "The time to get involved is while those rules are still being considered.",
  "Walton County Builders Network",
  "Connect. Advocate. Build.",
];

test("homepage places Why We Exist after the hero and before Our Shared Purpose", () => {
  const hero = HOME.indexOf('class="container hero"');
  const section = HOME.indexOf('<section class="why-exist" id="why-we-exist" aria-labelledby="why-exist-heading">');
  const purpose = HOME.indexOf('<section class="purpose" id="about">');
  assert.ok(hero < section && section < purpose);
  assert.equal(HOME.indexOf('class="why-exist"'), HOME.lastIndexOf('class="why-exist"'));
  const block = sliceBetween(HOME, '<section class="why-exist"', '<section class="purpose"');
  assert.equal(block.includes('class="eyebrow">WHY WE EXIST</p>'), true);
  assert.match(block, /<h2 id="why-exist-heading">The Rules Are Changing\. Are You Paying Attention\?<\/h2>/);
  assert.deepEqual(paragraphs(block).filter((item) => item !== "WHY WE EXIST"), HOME_PARAGRAPHS);
  assert.match(block, /<p><strong>That's why Walton County Builders Network exists\.<\/strong><\/p>/);
  assert.match(block, /<a class="button" href="\/why-we-exist">Learn Why We Exist <span aria-hidden="true">→<\/span><\/a>/);
  assert.equal(/[\u2014\u2013]/.test(block), false);
  const style = HOME.slice(HOME.indexOf("<style>"), HOME.indexOf("</style>"));
  assert.match(style, /\.why-exist \{[^}]*padding: 40px 0;/);
  assert.match(style, /\.why-exist \{[^}]*border-top: 2px solid var\(--gold\);/);
  assert.match(style, /\.why-exist \.eyebrow::before \{[^}]*background: var\(--gold\);/);
  assert.match(style, /\.why-exist \{ padding: 64px 0; \}/);
});

test("why we exist is a public article with the site chrome, meta tags, and exact copy", () => {
  assert.equal(page.includes("<header"), true);
  assert.equal(page.includes("<footer"), true);
  assert.equal(
    sliceBetween(page, "<header", "</header>"),
    sliceBetween(JOIN, "<header", "</header>")
  );
  assert.equal(
    page.slice(page.lastIndexOf("<footer"), page.indexOf("</footer>") + "</footer>".length),
    JOIN.slice(JOIN.lastIndexOf("<footer"), JOIN.indexOf("</footer>") + "</footer>".length)
  );
  assert.match(page, /<a class="skip-link" href="#why-we-exist">/);
  assert.match(page, /<title>The Rules Are Changing\. Are You Paying Attention\? · Walton County Builders Network<\/title>/);
  assert.match(page, new RegExp(`<meta name="description" content="${escapeRegExp(WHY_DESCRIPTION)}">`));
  assert.match(page, /<meta name="robots" content="index, follow">/);
  assert.match(page, /<link rel="canonical" href="https:\/\/waltonbuildersnetwork\.org\/why-we-exist">/);
  assert.match(page, /<meta property="og:type" content="website">/);
  assert.match(page, /<meta property="og:site_name" content="Walton County Builders Network">/);
  assert.match(page, /<meta property="og:title" content="The Rules Are Changing\. Are You Paying Attention\? · Walton County Builders Network">/);
  assert.match(page, new RegExp(`<meta property="og:description" content="${escapeRegExp(WHY_DESCRIPTION)}">`));
  assert.match(page, /<meta property="og:url" content="https:\/\/waltonbuildersnetwork\.org\/why-we-exist">/);
  assert.match(page, /<meta property="og:image" content="https:\/\/waltonbuildersnetwork\.org\/assets\/walton-county-builders-network-logo\.jpg">/);
  assert.match(page, /<meta name="twitter:card" content="summary">/);
  assert.match(page, /<meta name="twitter:title" content="The Rules Are Changing\. Are You Paying Attention\? · Walton County Builders Network">/);
  assert.match(page, new RegExp(`<meta name="twitter:description" content="${escapeRegExp(WHY_DESCRIPTION)}">`));
  assert.match(page, /<meta name="twitter:image" content="https:\/\/waltonbuildersnetwork\.org\/assets\/walton-county-builders-network-logo\.jpg">/);
  assert.equal(page.split("<h1>").length - 1, 1);
  assert.match(page, new RegExp(`<h1>${escapeRegExp(WHY_TITLE)}</h1>`));
  assert.deepEqual(paragraphs(article), ARTICLE_PARAGRAPHS);
  assert.match(article, /<strong>If you work in construction, development, or real estate in Walton County, decisions made at the county level can directly affect your livelihood, whether you know about them or not\.<\/strong>/);
  assert.match(article, /<strong>By the time you discover the impact, the opportunity to influence the decision may have already passed\.<\/strong>/);
  assert.match(article, /<strong>That&#39;s why Walton County Builders Network exists\.<\/strong>/);
  assert.match(article, /<strong>Your industry shouldn&#39;t discover the rules have changed when you submit your next permit application\.<\/strong>/);
  assert.match(article, /<em>Connect\. Advocate\. Build\.<\/em>/);
  assert.match(article, /<p><strong><a href="https:\/\/waltonbuildersnetwork\.org\/">Walton County Builders Network<\/a><\/strong><\/p>/);
  assert.match(page, /<a class="button" href="\/join">Join Walton County Builders Network<\/a>/);
  assert.equal(page.includes("fbq"), false);
  assert.equal(page.includes("fbevents.js"), false);
  assert.ok(page.includes("G-2GMYW45HSD"));
  assert.equal(/[\u2014\u2013]/.test(page), false);
  assert.equal(WHY_CANONICAL, "https://waltonbuildersnetwork.org/why-we-exist");
  assert.equal(WHY_DOCUMENT_TITLE, `${WHY_TITLE} · Walton County Builders Network`);
  assert.equal(WHY_DESCRIPTION.startsWith("If you work in construction"), true);
});

test("markdown renders an h1, bold, and italic, and escapes html", () => {
  const html = renderMarkdown("# A title\n\n**Bold** and *italic*\n");
  assert.match(html, /<h1>A title<\/h1>/);
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  const unsafe = renderWhyArticleBody('See <script>alert(1)</script> & "quotes"\n');
  assert.equal(unsafe.includes("<script>"), false);
  assert.match(unsafe, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(unsafe, /&amp;/);
  assert.match(unsafe, /&quot;quotes&quot;/);
});

test("the public route, sitemap, and content security policy include the article without new hosts", async () => {
  assert.match(source, /if \(path === "\/why-we-exist" \|\| path === "\/why-we-exist\.html"\) return html\(request\.method === "HEAD" \? null : WHY_WE_EXIST\);/);
  assert.equal(source.split("Content-Security-Policy").length - 1, 1);
  assert.ok(source.includes(`"Content-Security-Policy": "${CSP}"`));

  const response = await worker.fetch(new Request("https://waltonbuildersnetwork.org/why-we-exist"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("content-security-policy"), CSP);
  const html = await response.text();
  assert.match(html, /<h1>The Rules Are Changing\. Are You Paying Attention\?<\/h1>/);
  assert.match(html, /href="https:\/\/waltonbuildersnetwork\.org\/"/);
  assert.match(html, /<a class="button" href="\/join">Join Walton County Builders Network<\/a>/);
  assert.match(html, /<button type="button" class="nav-toggle"/);
  assert.equal(html.includes("fbq"), false);

  const head = await worker.fetch(new Request("https://waltonbuildersnetwork.org/why-we-exist", { method: "HEAD" }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("content-security-policy"), CSP);

  const slash = await worker.fetch(new Request("https://waltonbuildersnetwork.org/why-we-exist/"));
  assert.equal(slash.status, 301);
  assert.equal(slash.headers.get("location"), "https://waltonbuildersnetwork.org/why-we-exist");

  const legacy = await worker.fetch(new Request("https://waltonbuildersnetwork.org/why-we-exist.html"));
  assert.equal(legacy.status, 200);
  assert.match(await legacy.text(), /<h1>The Rules Are Changing\. Are You Paying Attention\?<\/h1>/);

  const sitemap = await worker.fetch(new Request("https://waltonbuildersnetwork.org/sitemap.xml"));
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type"), /application\/xml/);
  const xml = await sitemap.text();
  assert.match(xml, /<loc>https:\/\/waltonbuildersnetwork\.org\/why-we-exist<\/loc>/);
  assert.match(xml, /<loc>https:\/\/waltonbuildersnetwork\.org\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/waltonbuildersnetwork\.org\/join<\/loc>/);

  const home = await worker.fetch(new Request("https://waltonbuildersnetwork.org/"));
  assert.equal(home.status, 200);
  const homeHtml = await home.text();
  const section = homeHtml.indexOf('class="why-exist"');
  const purpose = homeHtml.indexOf('class="purpose"');
  assert.ok(section > -1 && section < purpose);
  assert.match(homeHtml, /Learn Why We Exist <span aria-hidden="true">→<\/span>/);
});
