(function () {
  "use strict";

  var lightbox = document.getElementById("wiki-lightbox");
  var lightboxImg = document.getElementById("wiki-lightbox-img");
  var lightboxCap = document.getElementById("wiki-lightbox-cap");
  var closeBtn = document.getElementById("wiki-lightbox-close");
  var header = document.getElementById("wiki-header");
  var progress = document.getElementById("wiki-progress");
  var topBtn = document.getElementById("wiki-top");
  var sections = document.querySelectorAll(".wiki-section");

  /* ── 灯箱 ── */
  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || "";
    if (lightboxCap) lightboxCap.textContent = alt || "";
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (closeBtn) closeBtn.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  document.querySelectorAll(".wiki-gallery img, .wiki-infobox-img img").forEach(function (img) {
    img.addEventListener("click", function () {
      openLightbox(img.src, img.alt);
    });
  });

  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLightbox();
  });

  /* ── 阅读进度 & 回到顶部 ── */
  function onScroll() {
    var scrollY = window.scrollY || document.documentElement.scrollTop;
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docH > 0 ? (scrollY / docH) * 100 : 0;

    if (progress) progress.style.width = pct + "%";
    if (header) header.classList.toggle("is-scrolled", scrollY > 8);
    if (topBtn) topBtn.classList.toggle("is-visible", scrollY > 400);
    updateTocActive();
  }

  function revealSectionsInView() {
    sections.forEach(function (sec) {
      var rect = sec.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92) sec.classList.add("is-visible");
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (topBtn) {
    topBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ── 章节淡入 ── */
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.body.classList.add("wiki-animate");
    var fadeObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            fadeObs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    sections.forEach(function (sec) {
      fadeObs.observe(sec);
    });
  } else {
    document.body.classList.remove("wiki-animate");
    sections.forEach(function (sec) {
      sec.classList.add("is-visible");
    });
  }

  revealSectionsInView();

  /* ── 目录高亮（按滚动位置取最近章节） ── */
  var tocLinks = document.querySelectorAll(".wiki-toc a[href^='#']");
  var tocSections = [];

  tocLinks.forEach(function (link) {
    var id = link.getAttribute("href").slice(1);
    var el = document.getElementById(id);
    if (el) tocSections.push({ link: link, el: el });
  });

  function updateTocActive() {
    if (!tocSections.length) return;
    var marker = window.innerHeight * 0.32;
    var current = tocSections[0];

    tocSections.forEach(function (item) {
      var top = item.el.getBoundingClientRect().top;
      if (top <= marker) current = item;
    });

    tocLinks.forEach(function (l) {
      l.classList.toggle("is-active", l === current.link);
    });
  }

  /* ── 外链标记 ── */
  document.querySelectorAll('.wiki-nav a[target="_blank"], .wiki-links a[target="_blank"]').forEach(function (a) {
    a.setAttribute("rel", "noopener noreferrer");
  });
})();
