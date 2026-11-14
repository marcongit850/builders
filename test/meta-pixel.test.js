import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const PIXEL_ID = "1181294521002723";

const PIXEL = `<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1181294521002723');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1181294521002723&ev=PageView&noscript=1"/></noscript>`;

const CSP =
  "default-src 'none'; script-src 'self' 'unsafe-inline' https://*.googletagmanager.com https://*.google-analytics.com https://connect.facebook.net; img-src 'self' https://*.google-analytics.com https://*.googletagmanager.com https://www.facebook.com; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.facebook.com https://connect.facebook.net; form-action 'self'; base-uri 'none'";

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

test("homepage head includes the Meta Pixel base code after the existing GA4 tag", () => {
  const home = readStringConst("HOME");
  const headEnd = home.indexOf("</head>");
  assert.ok(headEnd > 0);
  const head = home.slice(0, headEnd);
  const body = home.slice(headEnd);
  assert.equal(head.split(PIXEL).length - 1, 1);
  assert.ok(head.indexOf("G-2GMYW45HSD") < head.indexOf("https://connect.facebook.net/en_US/fbevents.js"));
  assert.ok(head.includes(`fbq('init', '${PIXEL_ID}');`));
  assert.ok(head.includes("fbq('track', 'PageView');"));
  assert.equal(body.includes("fbq("), false);
  assert.equal(body.includes("fbevents.js"), false);
});

test("other pages do not include the Meta Pixel", () => {
  for (const name of ["JOIN", "THANKS_CONTACT", "LOGIN"]) {
    const html = readStringConst(name);
    assert.equal(html.includes("fbq("), false, name);
    assert.equal(html.includes("fbevents.js"), false, name);
    assert.equal(html.includes("facebook.com/tr"), false, name);
    assert.equal(html.includes(PIXEL_ID), false, name);
  }
  assert.equal(src.split("fbq(").length - 1, 5);
  assert.equal(src.split("fbevents.js").length - 1, 2);
  assert.equal(src.split("facebook.com/tr").length - 1, 2);
});

test("GA4 remains on the pages that already had it", () => {
  for (const name of ["HOME", "JOIN", "THANKS_JOIN", "THANKS_CONTACT"]) {
    assert.ok(readStringConst(name).includes("G-2GMYW45HSD"), name);
  }
  assert.equal(readStringConst("LOGIN").includes("googletagmanager.com"), false);
});

test("content security policy allows the pixel and still allows GA4", () => {
  assert.equal(src.split(CSP).length - 1, 1);
  assert.ok(CSP.includes("https://*.googletagmanager.com"));
  assert.ok(CSP.includes("'unsafe-inline'"));
  assert.ok(CSP.includes("https://connect.facebook.net"));
  assert.ok(CSP.includes("https://www.facebook.com"));
});

test("membership thank-you page has the pixel base code and fires Lead after it", () => {
  const t = readStringConst("THANKS_JOIN");
  assert.ok(t.includes("fbevents.js") && t.includes(PIXEL_ID));
  assert.ok(t.indexOf("fbq('track', 'Lead');") > t.indexOf("fbq('track', 'PageView');"));
  assert.ok(t.indexOf("fbq('track', 'Lead');") < t.indexOf("</body>"));
});
