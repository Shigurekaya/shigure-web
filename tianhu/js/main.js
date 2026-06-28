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

  /* ── 阅读进度 & 顶栏阴影 & 回到顶部 ── */
  function onScroll() {
    var scrollY = window.scrollY || document.documentElement.scrollTop;
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docH > 0 ? (scrollY / docH) * 100 : 0;

    if (progress) progress.style.width = pct + "%";
    if (header) header.classList.toggle("is-scrolled", scrollY > 8);
    if (topBtn) topBtn.classList.toggle("is-visible", scrollY > 400);
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

  /* ── 章节淡入（JS 失败时 CSS 仍保证可见） ── */
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

  /* ── 目录高亮当前章节 ── */
  var tocLinks = document.querySelectorAll(".wiki-toc a[href^='#']");
  var headings = [];
  tocLinks.forEach(function (link) {
    var id = link.getAttribute("href").slice(1);
    var el = document.getElementById(id);
    if (el) headings.push({ link: link, el: el });
  });

  if ("IntersectionObserver" in window && headings.length) {
    var tocObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var activeId = entry.target.id;
            tocLinks.forEach(function (l) {
              l.classList.toggle("is-active", l.getAttribute("href") === "#" + activeId);
            });
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    headings.forEach(function (h) {
      tocObs.observe(h.el);
    });
  }
})();
