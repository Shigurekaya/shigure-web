/** 顶栏 — 对齐 komowata.com：左上 Logo + 右上英文导航（全站） */
(() => {
  const LINKS = [
    { href: "index.html", label: "HOME" },
    { href: "work.html", label: "WORK" },
    { href: "about.html", label: "ABOUT" },
    { href: "portfolio.html", label: "PORTFOLIO" },
  ];

  const path = () => (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

  function active(href) {
    const p = path();
    const h = href.toLowerCase();
    if (h === "index.html") return p === "" || p === "index.html";
    return p === h;
  }

  function isFuyulevPage() {
    return [...document.body.classList].some((c) => c.startsWith("fuyulev-page-"));
  }

  function inject() {
    if (!isFuyulevPage()) return;
    if (document.getElementById("fuyulev-topbar")) return;

    const bar = document.createElement("header");
    bar.id = "fuyulev-topbar";
    bar.className = "fuyulev-topbar";
    bar.innerHTML = `
      <div class="fuyulev-topbar-inner">
        <a href="index.html" class="fuyulev-topbar-logo" aria-label="浮游Lev Home">F</a>
        <nav class="fuyulev-topbar-nav" aria-label="Site">
          ${LINKS.map(
            (l) =>
              `<a href="${l.href}" class="fuyulev-topbar-link${active(l.href) ? " is-active" : ""}">${l.label}</a>`
          ).join("")}
        </nav>
      </div>
    `;
    document.body.prepend(bar);

    ["pinnedTopLeft", "pinnedTopRight", "comp-imytorpi", "comp-inhcr2i9"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  }

  inject();
  document.addEventListener("DOMContentLoaded", inject);
})();
