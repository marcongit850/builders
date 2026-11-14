import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NAV_CSS, NAV_JS, withHeaderNav } from "../src/header-nav.js";

const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const headerNav = readFileSync(new URL("../src/header-nav.js", import.meta.url), "utf8");

function readStringConst(name) {
  const token = `const ${name} = "`;
  const start = src.indexOf(token);
  assert.notEqual(start, -1, name);
  let i = start + token.length;
  let out = "";
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      const next = src[i + 1];
      if (next === "n") out += "\n";
      else if (next === "r") out += "\r";
      else if (next === '"') out += '"';
      else if (next === "\\") out += "\\";
      else throw new Error(`unexpected escape \\${next} in ${name}`);
    } else if (ch === '"') {
      return out;
    } else {
      out += ch;
    }
    i += ch === "\\" ? 2 : 1;
  }
  throw new Error(`unterminated ${name}`);
}

const PAGES = ["HOME", "JOIN", "THANKS_JOIN", "THANKS_CONTACT", "LOGIN"];

test("every header page has a menu button and a visible Login link", () => {
  for (const name of PAGES) {
    const html = readStringConst(name);
    const page = withHeaderNav(html);
    assert.match(page, /<button type="button" class="nav-toggle" aria-expanded="false" aria-controls="nav-menu">/, name);
    assert.match(page, /<span class="nav-toggle-text">Menu<\/span>/, name);
    assert.match(page, /<a class="nav-login-bar" href="\/login">Login<\/a>/, name);
    assert.match(page, /id="nav-menu"/, name);
    assert.equal(page.includes("onclick="), false, name);
    assert.equal((page.match(/id="nav-mobile"/g) || []).length, 1, name);
    assert.equal((page.match(/id="nav-toggle-script"/g) || []).length, 1, name);
    assert.ok(page.indexOf('id="nav-mobile"') < page.indexOf("</head>"), name);
    assert.ok(page.indexOf('id="nav-toggle-script"') < page.indexOf("</body>"), name);
  }
});

test("home menu links stay on the page and other pages point back to home sections", () => {
  const home = readStringConst("HOME");
  assert.match(home, /<div class="nav-menu" id="nav-menu">\s*<a href="#about">About<\/a>\s*<a href="#issues">Issues<\/a>\s*<a href="\/login">Login<\/a>/);
  for (const name of ["JOIN", "THANKS_JOIN", "THANKS_CONTACT", "LOGIN"]) {
    const html = readStringConst(name);
    assert.match(html, /<a href="\/#about">About<\/a>/, name);
    assert.match(html, /<a href="\/#issues">Issues<\/a>/, name);
  }
});

test("mobile rules show Login beside Join and desktop rules hide the menu button", () => {
  assert.match(NAV_CSS, /@media \(max-width: 879px\)/);
  assert.match(NAV_CSS, /\.nav > a\.nav-login-bar \{\s*display: inline-flex;/);
  assert.match(NAV_CSS, /\.nav-toggle \{\s*display: inline-flex;/);
  assert.match(NAV_CSS, /@media \(min-width: 880px\) \{\s*\.nav-toggle,\s*\.nav > a\.nav-login-bar \{\s*display: none;/);
  assert.match(NAV_CSS, /@media \(min-width: 1120px\) \{\s*\.nav-menu \{ gap: 34px; \}/);
  assert.match(NAV_JS, /addEventListener\("click"/);
  assert.match(NAV_JS, /setAttribute\("aria-expanded"/);
  assert.match(NAV_JS, /event\.key === "Escape"/);
  assert.equal(NAV_JS.includes("onclick"), false);
});

test("header nav copy does not use em or en dashes", () => {
  assert.equal(/[\u2013\u2014]/.test(headerNav), false);
  for (const name of PAGES) {
    const nav = readStringConst(name).match(/<header class="site-header">[\s\S]*?<\/header>/);
    assert.ok(nav, name);
    assert.equal(/[\u2013\u2014]/.test(nav[0]), false, name);
  }
});

test("pages without the site header are left unchanged", () => {
  assert.equal(withHeaderNav(null), null);
  const plain = "<html><body><p>Hi</p></body></html>";
  assert.equal(withHeaderNav(plain), plain);
});

test("decorating a page does not add the Meta Pixel", () => {
  const login = withHeaderNav(readStringConst("LOGIN"));
  assert.equal(login.includes("fbq("), false);
  assert.equal(login.includes("fbevents.js"), false);
});
