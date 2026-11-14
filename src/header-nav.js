// Shared mobile header behavior for every page that includes the site header.
// Desktop (880px and up) keeps the existing row of links. Narrower screens
// keep Login beside Join, and a menu button reveals About, Issues, and Login.

export const NAV_CSS = `
.nav-toggle,
.nav-login-bar {
  display: none;
}
@media (max-width: 879px) {
  .header-inner {
    position: relative;
    flex-wrap: wrap;
    row-gap: 2px;
  }
  .brand {
    flex: 1 1 auto;
    min-width: max-content;
    max-width: 100%;
  }
  .nav {
    flex: 0 0 auto;
    gap: 6px;
    margin-left: auto;
    max-width: 100%;
  }
  .nav-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 44px;
    height: 44px;
    margin: 0;
    padding: 0;
    border: 1px solid var(--line, #d9d8ce);
    background: transparent;
    color: var(--navy, #001840);
    cursor: pointer;
  }
  .nav-toggle-bars,
  .nav-toggle-bars::before,
  .nav-toggle-bars::after {
    display: block;
    width: 18px;
    height: 2px;
    background: currentColor;
    transition: transform 160ms ease, top 160ms ease, background-color 160ms ease;
  }
  .nav-toggle-bars {
    position: relative;
  }
  .nav-toggle-bars::before,
  .nav-toggle-bars::after {
    content: "";
    position: absolute;
    left: 0;
  }
  .nav-toggle-bars::before { top: -6px; }
  .nav-toggle-bars::after { top: 6px; }
  .nav.is-open .nav-toggle {
    background: var(--navy, #001840);
    border-color: var(--navy, #001840);
    color: var(--cream, #f6f3ec);
  }
  .nav.is-open .nav-toggle-bars { background: transparent; }
  .nav.is-open .nav-toggle-bars::before {
    top: 0;
    transform: rotate(45deg);
  }
  .nav.is-open .nav-toggle-bars::after {
    top: 0;
    transform: rotate(-45deg);
  }
  .nav-toggle-text {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .nav-toggle:focus-visible,
  .nav-login-bar:focus-visible,
  .nav-menu a:focus-visible {
    outline: 2px solid var(--gold, #d0a040);
    outline-offset: 3px;
  }
  .nav > a.nav-login-bar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 4px;
    font-size: 15px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
  }
  .nav .button { white-space: nowrap; }
  .nav-menu {
    display: none;
    position: absolute;
    z-index: 6;
    top: calc(100% + 1px);
    left: 0;
    right: 0;
    flex-direction: column;
    margin: 0;
    padding: 4px 0;
    background: var(--cream, #f6f3ec);
    border: 1px solid var(--line, #d9d8ce);
    box-shadow: 0 16px 40px rgba(0, 24, 64, 0.14);
  }
  .nav.is-open .nav-menu { display: flex; }
  .nav.is-open .nav-menu a {
    display: block;
    padding: 14px 16px;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.25;
  }
  .nav.is-open .nav-menu a + a {
    border-top: 1px solid var(--line, #d9d8ce);
  }
  .nav.is-open .nav-menu a:hover,
  .nav.is-open .nav-menu a:focus-visible {
    background: var(--band, #eeece4);
  }
}
@media (min-width: 880px) {
  .nav-toggle,
  .nav > a.nav-login-bar {
    display: none;
  }
  .nav-menu {
    display: flex;
    align-items: center;
    gap: 28px;
  }
}
@media (min-width: 1120px) {
  .nav-menu { gap: 34px; }
}
@media (prefers-reduced-motion: reduce) {
  .nav-toggle-bars,
  .nav-toggle-bars::before,
  .nav-toggle-bars::after {
    transition: none;
  }
}
`;

export const NAV_JS = `
(function () {
  var nav = document.querySelector(".nav");
  if (!nav) return;
  var toggle = nav.querySelector(".nav-toggle");
  var menu = document.getElementById("nav-menu");
  var bar = nav.querySelector(".nav-login-bar");
  if (!toggle || !menu) return;
  var label = toggle.querySelector(".nav-toggle-text");

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (label) label.textContent = open ? "Close" : "Menu";
    if (bar) {
      if (open) {
        bar.setAttribute("aria-hidden", "true");
        bar.tabIndex = -1;
      } else {
        bar.removeAttribute("aria-hidden");
        bar.removeAttribute("tabindex");
      }
    }
  }

  toggle.addEventListener("click", function () {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggle.focus();
    }
  });

  document.addEventListener("click", function (event) {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    if (!nav.contains(event.target)) setOpen(false);
  });

  document.addEventListener("focusin", function (event) {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    if (!nav.contains(event.target)) setOpen(false);
  });

  menu.addEventListener("click", function (event) {
    if (event.target.closest && event.target.closest("a")) setOpen(false);
  });

  var desktop = window.matchMedia("(min-width: 880px)");
  function onDesktop() {
    if (desktop.matches) setOpen(false);
  }
  if (desktop.addEventListener) desktop.addEventListener("change", onDesktop);
  else if (desktop.addListener) desktop.addListener(onDesktop);
})();
`;

export function withHeaderNav(body) {
  if (typeof body !== "string" || !body.includes('class="site-header"')) return body;
  let page = body;
  if (!page.includes('id="nav-mobile"')) {
    page = page.replace("</head>", '<style id="nav-mobile">\n' + NAV_CSS + "\n</style>\n</head>");
  }
  if (!page.includes('id="nav-toggle-script"')) {
    page = page.replace("</body>", '<script id="nav-toggle-script">\n' + NAV_JS + "\n</script>\n</body>");
  }
  return page;
}
