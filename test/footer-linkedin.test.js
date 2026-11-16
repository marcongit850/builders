import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

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
      i += 2;
      continue;
    }
    if (ch === '"') return out;
    out += ch;
    i += 1;
  }
  throw new Error(`unterminated ${name}`);
}

const PAGES = ["HOME", "JOIN", "THANKS_JOIN", "THANKS_CONTACT", "LOGIN"];

const FACEBOOK =
  '<a class="footer-social" href="https://www.facebook.com/groups/waltonbuildersnetwork/" target="_blank" rel="noopener noreferrer" aria-label="Walton County Builders Network Facebook group">';

const LINKEDIN =
  '<a class="footer-social" href="https://www.linkedin.com/company/walton-county-builders-network" target="_blank" rel="noopener noreferrer" aria-label="Walton County Builders Network on LinkedIn">';

const LINKEDIN_MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/></svg>';

test("every footer places a LinkedIn link beside the Facebook logo", () => {
  for (const name of PAGES) {
    const html = readStringConst(name);
    const start = html.indexOf('<footer class="footer">');
    const end = html.indexOf("</footer>", start);
    assert.ok(start > 0 && end > start, name);
    const footer = html.slice(start, end);
    assert.equal(footer.split(FACEBOOK).length - 1, 1, name);
    assert.equal(footer.split(LINKEDIN).length - 1, 1, name);
    assert.ok(footer.indexOf(FACEBOOK) < footer.indexOf(LINKEDIN), name);
    assert.ok(footer.includes(LINKEDIN_MARK), name);
    assert.match(footer, /<div class="footer-socials">\s*<a class="footer-social" href="https:\/\/www\.facebook\.com/, name);
    assert.equal(html.split("https://www.linkedin.com/company/walton-county-builders-network").length - 1, 1, name);
    assert.ok(
      html.includes(".footer-socials { display: inline-flex; align-items: center; gap: 10px; flex: none; }"),
      name
    );
    assert.ok(
      html.includes(
        ".footer-social { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 36px; height: 36px; color: #d0a040;"
      ),
      name
    );
  }
});

test("the LinkedIn mark is inline, so the content security policy stays unchanged", () => {
  const csp = src.match(/"Content-Security-Policy": "([^"]+)"/);
  assert.ok(csp);
  assert.equal(csp[1].includes("linkedin"), false);
  assert.equal(src.split('"Content-Security-Policy"').length - 1, 1);
  assert.equal(src.split("https://www.linkedin.com/company/walton-county-builders-network").length - 1, 5);
  assert.equal(/<img[^>]*linkedin/i.test(src), false);
});

test("the homepage Facebook group sentence stays a text link", () => {
  const home = readStringConst("HOME");
  assert.match(
    home,
    /Join the conversation in our <a href="https:\/\/www\.facebook\.com\/groups\/waltonbuildersnetwork\/" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;font-weight:600;">Facebook group<\/a>\./
  );
  const why = home.slice(home.indexOf('id="why"'), home.indexOf('id="join"'));
  assert.equal(why.includes("linkedin"), false);
});
