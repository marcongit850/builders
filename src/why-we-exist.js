export const WHY_TITLE = "The Rules Are Changing. Are You Paying Attention?";
export const WHY_DOCUMENT_TITLE = `${WHY_TITLE} · Walton County Builders Network`;
export const WHY_DESCRIPTION =
  "If you work in construction, development, or real estate in Walton County, decisions made at the county level can directly affect your livelihood, whether you know about them or not.";
export const WHY_CANONICAL = "https://waltonbuildersnetwork.org/why-we-exist";

export const WHY_ARTICLE_MARKDOWN = [
  `# ${WHY_TITLE}`,
  "",
  `**${WHY_DESCRIPTION}**`,
  "",
  "You're busy building homes, selling properties, managing projects, coordinating subcontractors, meeting deadlines, and keeping customers satisfied.",
  "",
  "Meanwhile, local government continues reviewing proposals that could change the way you do business.",
  "",
  "A new setback requirement. Changes to permitted land uses. Higher impact fees. Additional environmental restrictions. More complicated permitting procedures. New rules affecting what property owners can build, improve, or develop.",
  "",
  "Sometimes these changes happen incrementally, one ordinance or administrative requirement at a time.",
  "",
  "And that's what makes them so easy to miss.",
  "",
  "A seemingly minor adjustment to a land development code might not make headlines. But it could affect property values, construction costs, development opportunities, or the ability of an owner to use their land.",
  "",
  "**By the time you discover the impact, the opportunity to influence the decision may have already passed.**",
  "",
  "Most builders, contractors, developers, real estate agents, engineers, architects, and industry professionals simply don't have the time to monitor every county meeting and proposed regulation.",
  "",
  "They're too busy working.",
  "",
  "**That's why Walton County Builders Network exists.**",
  "",
  "Our mission is to help keep the industry informed about proposed changes, encourage participation before important votes, and provide a unified voice for the professionals who build, develop, buy, sell, improve, and maintain Walton County.",
  "",
  "We support responsible growth, fair regulations, private property rights, efficient permitting, and a transparent local government.",
  "",
  "We're not suggesting every proposed change is bad. We're saying the people affected deserve to know what's being proposed, understand the consequences, and have an opportunity to speak.",
  "",
  "**Your industry shouldn't discover the rules have changed when you submit your next permit application.**",
  "",
  "The time to get involved is while those rules are still being considered.",
  "",
  "**Walton County Builders Network**",
  "",
  "*Connect. Advocate. Build.*",
].join("\n");

const SIGNATURE = "<p><strong>Walton County Builders Network</strong></p>";
const SIGNATURE_LINK =
  '<p><strong><a href="https://waltonbuildersnetwork.org/">Walton County Builders Network</a></strong></p>';

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMarkdown(raw) {
  const pattern = /(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g;
  const parts = [];
  let last = 0;
  for (const match of raw.matchAll(pattern)) {
    parts.push(escapeHtml(raw.slice(last, match.index)));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(`<strong>${escapeHtml(token.slice(2, -2))}</strong>`);
    } else {
      parts.push(`<em>${escapeHtml(token.slice(1, -1))}</em>`);
    }
    last = match.index + token.length;
  }
  parts.push(escapeHtml(raw.slice(last)));
  return parts.join("");
}

export function renderMarkdown(source) {
  const lines = String(source ?? "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let paragraph = [];
  const flush = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  for (const line of lines) {
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`);
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return out.join("\n");
}

export function renderWhyArticleBody(markdown = WHY_ARTICLE_MARKDOWN) {
  const html = renderMarkdown(markdown);
  if (!html.includes(SIGNATURE)) return html;
  return html.replace(SIGNATURE, SIGNATURE_LINK);
}

const ARTICLE_CSS = `
      .article-copy > .eyebrow {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.16em;
        line-height: 1.5;
        text-transform: uppercase;
      }
      .article-copy > .eyebrow::before {
        content: "";
        display: inline-block;
        width: 28px;
        height: 2px;
        margin-right: 12px;
        background: var(--gold);
        vertical-align: middle;
      }
      .article-copy .prose h1 {
        line-height: 1.08;
        text-wrap: balance;
      }
      .article-copy .prose p {
        margin: 0 0 18px;
        font-size: 17px;
        line-height: 1.6;
      }
      .article-copy .prose p:last-child { margin-bottom: 0; }
      .article-copy .prose em {
        font-family: "Cormorant Garamond", Georgia, serif;
        font-style: italic;
        font-weight: 500;
        font-synthesis: style;
        font-size: 1.2em;
        letter-spacing: 0.01em;
      }
      .article-copy .prose a {
        text-decoration: underline;
        text-decoration-color: var(--gold);
        text-decoration-thickness: 2px;
        text-underline-offset: 3px;
      }
      .article-cta { margin: 28px 0 0; }
      @media (min-width: 880px) {
        .article-copy .prose p { font-size: 19px; }
      }
      @media (min-width: 1120px) {
        .article-copy > .eyebrow {
          font-size: 12px;
          letter-spacing: 0.2em;
        }
        .article-copy > .eyebrow::before {
          width: 34px;
          margin-right: 15px;
        }
      }
      @media (max-width: 380px) {
        .article-copy .prose h1 { font-size: 32px; }
      }
`;

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

export function renderWhyWeExistPage(joinHtml) {
  const joinTitle = "Request membership · Walton County Builders Network";
  const joinDescription =
    "Request membership in the Walton County Builders Network. Membership is free and applications are reviewed before anyone is added.";
  let page = String(joinHtml ?? "");
  if (count(page, joinTitle) !== 3) throw new Error("join title shell changed");
  if (count(page, joinDescription) !== 3) throw new Error("join description shell changed");
  if (count(page, "https://waltonbuildersnetwork.org/join") !== 2) throw new Error("join canonical shell changed");
  if (count(page, 'href="#apply"') !== 1) throw new Error("join skip link changed");
  if (count(page, '<main id="apply">') !== 1) throw new Error("join main changed");
  if (count(page, "</style>") !== 1) throw new Error("join style shell changed");

  const body = renderWhyArticleBody();
  if (!body.includes(SIGNATURE_LINK)) throw new Error("closing site link missing");
  if (body.includes("<h1>") === false) throw new Error("article title missing");
  if (/[\u2014\u2013]/.test(body) || /[\u2014\u2013]/.test(WHY_TITLE) || /[\u2014\u2013]/.test(WHY_DESCRIPTION) || /[\u2014\u2013]/.test(WHY_DOCUMENT_TITLE)) {
    throw new Error("article copy contains an em or en dash");
  }

  const main = `<main id="why-we-exist">
      <article class="container apply">
        <div class="apply-copy article-copy">
          <p class="eyebrow">WHY WE EXIST</p>
          <div class="prose">
            ${body}
          </div>
          <p class="article-cta"><a class="button" href="/join">Join Walton County Builders Network</a></p>
        </div>
      </article>
    </main>`;

  page = page.split(joinTitle).join(escapeHtml(WHY_DOCUMENT_TITLE));
  page = page.split(joinDescription).join(escapeHtml(WHY_DESCRIPTION));
  page = page.split("https://waltonbuildersnetwork.org/join").join(WHY_CANONICAL);
  page = page.replace(/<main id="apply">[\s\S]*?<\/main>/, main);
  page = page.replace('href="#apply"', 'href="#why-we-exist"');
  page = page.replace("</style>", `${ARTICLE_CSS}    </style>`);
  return page;
}
