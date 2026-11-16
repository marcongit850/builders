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

const BELIEF =
  "We believe the professionals who build, develop, buy, sell, improve, and maintain Walton County, including builders, contractors, developers, real estate agents, brokers, and related industry professionals, deserve a meaningful voice in the decisions shaping its future.";

test("homepage hero uses the updated belief sentence and keeps its class", () => {
  const home = readStringConst("HOME");
  assert.equal(home.split(`<p class="belief">${BELIEF}</p>`).length - 1, 1);
  assert.equal(home.includes("should have a meaningful voice"), false);
  const head = home.slice(0, home.indexOf("</head>"));
  assert.equal(head.includes(BELIEF), false);
  assert.match(
    head,
    /<meta name="description" content="Walton County Builders Network is a free membership organization giving builders, contractors, and developers a unified voice in Walton County\.">/
  );
});
