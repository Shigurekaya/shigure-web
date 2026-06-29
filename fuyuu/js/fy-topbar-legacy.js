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

  function isFyPage() {
    return [...document.body.classList].some((c) => c.startsWith("fy-page-"));
  }

  function inject() {
    if (!isFyPage()) return;
    if (document.getElementById("fy-topbar")) return;

    const bar = document.createElement("header");
    bar.id = "fy-topbar";
    bar.className = "fy-topbar";
    bar.innerHTML = `
      <div class="fy-topbar-inner">
        <a href="index.html" class="fy-topbar-logo" aria-label="浮游Lev Home">F</a>
        <nav class="fy-topbar-nav" aria-label="Site">
          ${LINKS.map(
            (l) =>
              `<a href="${l.href}" class="fy-topbar-link${active(l.href) ? " is-active" : ""}">${l.label}</a>`
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
