/**
 * 榧 · 资料区展开 / 收回（性能优先）
 * anime.js v4：少用 blur/clip-path；手机走 lite；测高批量读写
 */
(() => {
  const api = window.anime;
  if (!api?.animate || !api?.createTimeline || !api?.stagger) {
    console.warn("[kaya] anime.js missing; profile reveal falls back to CSS");
    window.KayaProfileReveal = null;
    return;
  }

  const { animate, createTimeline, stagger } = api;

  /** @type {{ pause?: Function, cancel?: Function } | null} */
  let activeTl = null;
  let openState = false;
  let busy = false;
  let gen = 0;

  const BRAND_CLOSED = "榧";
  const BRAND_OPEN = "时雨榧";
  const EASE_OUT = "out(3)";
  const EASE_IN = "in(2)";
  const EASE_SOFT = "out(2)";

  /** @type {{ x: number, y: number, w: number, h: number } | null} */
  let savedBrandRect = null;
  /** @type {WeakMap<Element, number>} */
  const heightCache = new WeakMap();

  function prefersReduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isLite() {
    if (window.KayaPerfGovernor?.isPhoneLike?.()) return true;
    if (window.matchMedia("(max-width: 720px)").matches) return true;
    if (window.matchMedia("(prefers-reduced-data: reduce)").matches) return true;
    try {
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return true;
    } catch { /* ignore */ }
    return false;
  }

  function brandEl() {
    return document.querySelector(".site-header .brand[data-profile-toggle]");
  }

  function brandTextEl() {
    return brandEl()?.querySelector(".brand-text");
  }

  function brandAvatarEl() {
    return document.getElementById("brand-avatar");
  }

  function heroAvatarWrap() {
    return document.querySelector("#profile-hero .profile-avatar");
  }

  function sectionEls() {
    const hero = document.getElementById("profile-hero");
    const gated = [...document.querySelectorAll(".page-home .profile-gated")];
    return [hero, ...gated].filter(Boolean);
  }

  function navEls() {
    return [...document.querySelectorAll(".page-home .nav-gated")];
  }

  function heroChildren(hero) {
    if (!hero) return [];
    return [
      hero.querySelector(".profile-avatar"),
      hero.querySelector(".profile-name"),
      hero.querySelector(".profile-roman"),
      hero.querySelector(".profile-sign"),
      hero.querySelector(".social-row"),
    ].filter(Boolean);
  }

  function cardChildren() {
    return [...document.querySelectorAll(".page-home .home-cards.profile-gated .home-card")];
  }

  function socialPills() {
    return [...document.querySelectorAll(".page-home .social-row .social-pill")];
  }

  function setBrandLabel(open) {
    const text = brandTextEl();
    if (text) text.textContent = open ? BRAND_OPEN : BRAND_CLOSED;
  }

  function killActive() {
    if (!activeTl) return;
    try {
      activeTl.pause?.();
      activeTl.cancel?.();
    } catch { /* ignore */ }
    activeTl = null;
  }

  const INLINE_KEYS = [
    "height", "opacity", "transform", "overflow", "visibility",
    "pointerEvents", "maxWidth", "willChange", "width", "borderWidth",
  ];

  function clearInline(el) {
    if (!(el instanceof HTMLElement)) return;
    for (let i = 0; i < INLINE_KEYS.length; i++) el.style[INLINE_KEYS[i]] = "";
  }

  function clearAllInline() {
    sectionEls().forEach(clearInline);
    navEls().forEach(clearInline);
    heroChildren(document.getElementById("profile-hero")).forEach(clearInline);
    cardChildren().forEach(clearInline);
    socialPills().forEach(clearInline);
    clearInline(brandAvatarEl());
  }

  function readRect(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  function ensureFlyer() {
    let flyer = document.getElementById("avatar-flyer");
    if (!flyer) {
      flyer = document.createElement("div");
      flyer.id = "avatar-flyer";
      flyer.className = "avatar-flyer";
      flyer.setAttribute("aria-hidden", "true");
      flyer.innerHTML = "<img alt=\"\" decoding=\"async\" />";
      document.body.appendChild(flyer);
    }
    const img = flyer.querySelector("img");
    const src = brandAvatarEl()?.currentSrc
      || brandAvatarEl()?.src
      || document.getElementById("hero-avatar")?.currentSrc
      || document.getElementById("hero-avatar")?.src
      || "assets/images/avatar.jpg";
    if (img && img.getAttribute("src") !== src) img.src = src;
    return flyer;
  }

  function placeFlyer(flyer, rect) {
    flyer.style.left = `${rect.x}px`;
    flyer.style.top = `${rect.y}px`;
    flyer.style.width = `${rect.w}px`;
    flyer.style.height = `${rect.h}px`;
    flyer.style.transform = "translateZ(0)";
    flyer.style.opacity = "1";
    flyer.style.visibility = "visible";
    flyer.style.willChange = "left, top, width, height";
    flyer.classList.add("is-on");
  }

  function hideFlyer(flyer) {
    if (!flyer) flyer = document.getElementById("avatar-flyer");
    if (!flyer) return;
    flyer.classList.remove("is-on");
    flyer.style.opacity = "0";
    flyer.style.visibility = "hidden";
    flyer.style.willChange = "auto";
  }

  /** 批量测高：一次写、一次读，减少 reflow */
  function measureHeights(els) {
    const prev = els.map((el) => ({
      height: el.style.height,
      opacity: el.style.opacity,
      overflow: el.style.overflow,
      visibility: el.style.visibility,
      position: el.style.position,
      pointerEvents: el.style.pointerEvents,
      transform: el.style.transform,
    }));
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      el.style.visibility = "hidden";
      el.style.pointerEvents = "none";
      el.style.position = "static";
      el.style.height = "auto";
      el.style.opacity = "1";
      el.style.overflow = "visible";
      el.style.transform = "none";
    }
    const heights = els.map((el) => {
      const h = Math.ceil(el.getBoundingClientRect().height || el.scrollHeight || 0);
      const out = Math.max(h, 1);
      heightCache.set(el, out);
      return out;
    });
    for (let i = 0; i < els.length; i++) Object.assign(els[i].style, prev[i]);
    return heights;
  }

  function measureHeroAvatarRect(heroH) {
    const hero = document.getElementById("profile-hero");
    const wrap = heroAvatarWrap();
    if (!hero || !wrap) return null;
    const prev = {
      height: hero.style.height,
      opacity: hero.style.opacity,
      overflow: hero.style.overflow,
      visibility: hero.style.visibility,
      transform: hero.style.transform,
      pointerEvents: hero.style.pointerEvents,
    };
    const prevAv = {
      opacity: wrap.style.opacity,
      transform: wrap.style.transform,
      visibility: wrap.style.visibility,
    };
    hero.style.height = `${heroH}px`;
    hero.style.opacity = "1";
    hero.style.overflow = "visible";
    hero.style.visibility = "hidden";
    hero.style.transform = "none";
    hero.style.pointerEvents = "none";
    wrap.style.opacity = "1";
    wrap.style.transform = "none";
    wrap.style.visibility = "visible";
    void hero.offsetHeight;
    const rect = readRect(wrap);
    Object.assign(hero.style, prev);
    Object.assign(wrap.style, prevAv);
    return rect;
  }

  function ensureBloom(brand) {
    if (!brand) return null;
    let bloom = brand.querySelector(".brand-bloom");
    if (!bloom) {
      bloom = document.createElement("span");
      bloom.className = "brand-bloom";
      bloom.setAttribute("aria-hidden", "true");
      brand.appendChild(bloom);
    }
    return bloom;
  }

  function pulseBrand(open) {
    const brand = brandEl();
    if (!brand) return;
    const text = brandTextEl() || brand;
    animate(text, {
      opacity: [1, 0.45, 1],
      scale: open ? [1, 0.94, 1] : [1, 0.96, 1],
      duration: open ? 420 : 340,
      ease: EASE_SOFT,
    });
    if (!isLite()) {
      const bloom = ensureBloom(brand);
      if (bloom) {
        animate(bloom, {
          opacity: [0.45, 0],
          scale: [0.4, 2.2],
          duration: 560,
          ease: EASE_OUT,
        });
      }
    }
  }

  function morphBrandLabel(open, tl, at) {
    const text = brandTextEl();
    if (!text) {
      setBrandLabel(open);
      return;
    }
    tl.add(text, {
      opacity: [1, 0],
      duration: 140,
      ease: EASE_IN,
      onComplete: () => { setBrandLabel(open); },
    }, at);
    tl.add(text, {
      opacity: [0, 1],
      duration: 200,
      ease: EASE_SOFT,
    }, at + 130);
  }

  function prepClosedVisual(el) {
    el.style.overflow = "hidden";
    el.style.height = "0px";
    el.style.opacity = "0";
    el.style.visibility = "visible";
    el.style.pointerEvents = "none";
    el.style.transform = "translate3d(0,-16px,0)";
    el.style.willChange = "height, opacity, transform";
  }

  function snapOpen() {
    document.body.classList.add("profile-open");
    document.body.classList.remove("profile-animating", "is-avatar-flying");
    clearAllInline();
    setBrandLabel(true);
    hideFlyer();
    openState = true;
    brandEl()?.setAttribute("aria-expanded", "true");
  }

  function snapClosed() {
    document.body.classList.remove("profile-open", "profile-animating", "is-avatar-flying");
    clearAllInline();
    setBrandLabel(false);
    hideFlyer();
    openState = false;
    brandEl()?.setAttribute("aria-expanded", "false");
  }

  /**
   * @param {boolean} open
   * @returns {Promise<void>}
   */
  function setOpen(open) {
    if (open === openState && !busy) return Promise.resolve();
    if (prefersReduced()) {
      killActive();
      busy = false;
      if (open) snapOpen();
      else snapClosed();
      return Promise.resolve();
    }

    killActive();
    const token = ++gen;
    busy = true;
    document.body.classList.add("profile-animating");
    pulseBrand(open);

    if (open) return playOpen(token);
    return playClose(token);
  }

  function playOpen(token) {
    return new Promise((resolve) => {
      const lite = isLite();
      document.body.classList.add("profile-open");
      brandEl()?.setAttribute("aria-expanded", "true");

      const brandAv = brandAvatarEl();
      const first = readRect(brandAv) || savedBrandRect;
      if (first) savedBrandRect = { ...first };

      const sections = sectionEls();
      const nav = navEls();
      const hero = document.getElementById("profile-hero");
      const kids = heroChildren(hero);
      const cards = cardChildren();
      const pills = lite ? [] : socialPills();
      const avatar = heroAvatarWrap();
      const restKids = kids.filter((el) => el !== avatar);

      sections.forEach(prepClosedVisual);
      kids.forEach((el) => {
        el.style.opacity = "0";
        el.style.transform = el === avatar ? "none" : "translate3d(0,18px,0)";
        el.style.willChange = "opacity, transform";
      });
      cards.forEach((el) => {
        el.style.opacity = "0";
        el.style.transform = "translate3d(0,24px,0)";
      });
      pills.forEach((el) => {
        el.style.opacity = "0";
        el.style.transform = "translate3d(0,10px,0) scale(0.85)";
      });
      nav.forEach((el) => {
        el.style.maxWidth = "0px";
        el.style.opacity = "0";
        el.style.overflow = "hidden";
        el.style.transform = "translate3d(-8px,0,0)";
        el.style.visibility = "visible";
      });

      const heights = measureHeights(sections);
      const last = measureHeroAvatarRect(heights[0]) || first;
      const useFlyer = !lite && first && last;
      const flyer = useFlyer ? ensureFlyer() : null;
      if (flyer && first) {
        document.body.classList.add("is-avatar-flying");
        if (brandAv) brandAv.style.opacity = "0";
        if (avatar) avatar.style.opacity = "0";
        placeFlyer(flyer, first);
      }

      const durSection = lite ? 420 : 620;
      const durFlyer = lite ? 0 : 720;
      const staggerGap = lite ? 40 : 70;

      const finish = () => {
        if (token !== gen) return;
        sections.forEach((el) => {
          el.style.height = "auto";
          el.style.overflow = "visible";
          el.style.transform = "";
          el.style.opacity = "1";
          el.style.pointerEvents = "";
          el.style.willChange = "";
        });
        kids.forEach(clearInline);
        cards.forEach(clearInline);
        pills.forEach(clearInline);
        nav.forEach(clearInline);
        if (brandAv) brandAv.style.opacity = "";
        setBrandLabel(true);
        hideFlyer(flyer);
        document.body.classList.remove("profile-animating", "is-avatar-flying");
        activeTl = null;
        busy = false;
        openState = true;
        resolve();
      };

      const tl = createTimeline({
        defaults: { ease: EASE_OUT },
        onComplete: finish,
      });
      activeTl = tl;

      morphBrandLabel(true, tl, 20);

      if (flyer && first && last) {
        tl.add(flyer, {
          left: [`${first.x}px`, `${last.x}px`],
          top: [`${first.y}px`, `${last.y}px`],
          width: [`${first.w}px`, `${last.w}px`],
          height: [`${first.h}px`, `${last.h}px`],
          duration: durFlyer,
          ease: EASE_OUT,
        }, 0);
        if (avatar) {
          tl.add(avatar, {
            opacity: [0, 1],
            duration: 160,
            ease: EASE_SOFT,
          }, Math.max(0, durFlyer - 140));
        }
      } else if (avatar) {
        tl.add(avatar, {
          opacity: [0, 1],
          scale: [0.88, 1],
          y: [16, 0],
          duration: lite ? 360 : 520,
          ease: EASE_OUT,
        }, 60);
      }

      sections.forEach((el, i) => {
        tl.add(el, {
          height: [`0px`, `${heights[i]}px`],
          opacity: [0, 1],
          y: [-16, 0],
          duration: durSection,
          ease: EASE_OUT,
        }, i * staggerGap);
      });

      if (restKids.length) {
        tl.add(restKids, {
          opacity: [0, 1],
          y: [16, 0],
          delay: stagger(lite ? 40 : 60),
          duration: lite ? 360 : 480,
          ease: EASE_SOFT,
        }, lite ? 120 : 200);
      }

      if (pills.length) {
        tl.add(pills, {
          opacity: [0, 1],
          y: [8, 0],
          scale: [0.88, 1],
          delay: stagger(40),
          duration: 360,
          ease: EASE_SOFT,
        }, 280);
      }

      if (nav.length) {
        tl.add(nav, {
          maxWidth: ["0px", "5.5rem"],
          opacity: [0, 1],
          x: [-8, 0],
          delay: stagger(40),
          duration: 360,
          ease: EASE_SOFT,
        }, 120);
      }

      if (cards.length) {
        tl.add(cards, {
          opacity: [0, 1],
          y: [22, 0],
          delay: stagger(lite ? 50 : 80),
          duration: lite ? 400 : 520,
          ease: EASE_OUT,
        }, lite ? 160 : 240);
      }
    });
  }

  function playClose(token) {
    return new Promise((resolve) => {
      const lite = isLite();
      brandEl()?.setAttribute("aria-expanded", "false");

      const sections = sectionEls();
      const nav = navEls();
      const kids = heroChildren(document.getElementById("profile-hero"));
      const cards = cardChildren();
      const pills = lite ? [] : socialPills();
      const avatar = heroAvatarWrap();
      const brandAv = brandAvatarEl();
      const restKids = kids.filter((el) => el !== avatar);

      const first = readRect(avatar);
      if (brandAv) {
        brandAv.style.opacity = "0";
        brandAv.style.width = "1.85rem";
        brandAv.style.margin = "";
        brandAv.style.borderWidth = "";
        brandAv.style.transform = "none";
      }
      void brandAv?.offsetWidth;
      const last = readRect(brandAv) || savedBrandRect || first;

      const heights = sections.map((el) => {
        const h = Math.ceil(el.getBoundingClientRect().height || heightCache.get(el) || el.scrollHeight || 0);
        el.style.height = `${h}px`;
        el.style.overflow = "hidden";
        el.style.willChange = "height, opacity, transform";
        return h;
      });

      nav.forEach((el) => {
        el.style.maxWidth = `${Math.ceil(el.getBoundingClientRect().width || 72)}px`;
        el.style.overflow = "hidden";
      });

      const useFlyer = !lite && first && last;
      const flyer = useFlyer ? ensureFlyer() : null;
      if (flyer && first) {
        document.body.classList.add("is-avatar-flying");
        if (avatar) avatar.style.opacity = "0";
        if (brandAv) brandAv.style.opacity = "0";
        placeFlyer(flyer, first);
      }

      const finish = () => {
        if (token !== gen) return;
        document.body.classList.remove("profile-open", "profile-animating", "is-avatar-flying");
        clearAllInline();
        setBrandLabel(false);
        hideFlyer(flyer);
        activeTl = null;
        busy = false;
        openState = false;
        resolve();
      };

      const tl = createTimeline({
        defaults: { ease: EASE_IN },
        onComplete: finish,
      });
      activeTl = tl;

      morphBrandLabel(false, tl, 40);

      if (flyer && first && last) {
        tl.add(flyer, {
          left: [`${first.x}px`, `${last.x}px`],
          top: [`${first.y}px`, `${last.y}px`],
          width: [`${first.w}px`, `${last.w}px`],
          height: [`${first.h}px`, `${last.h}px`],
          duration: 520,
          ease: EASE_OUT,
        }, 20);
        if (brandAv) {
          tl.add(brandAv, {
            opacity: [0, 1],
            duration: 160,
            ease: EASE_SOFT,
          }, 480);
        }
      }

      if (cards.length) {
        tl.add(cards, {
          opacity: 0,
          y: 16,
          delay: stagger(30, { reversed: true }),
          duration: 240,
          ease: EASE_IN,
        }, 0);
      }

      if (pills.length) {
        tl.add(pills, {
          opacity: 0,
          y: 8,
          delay: stagger(24, { reversed: true }),
          duration: 200,
        }, 20);
      }

      if (restKids.length) {
        tl.add(restKids, {
          opacity: 0,
          y: -12,
          delay: stagger(28, { reversed: true }),
          duration: 260,
          ease: EASE_IN,
        }, 40);
      }

      if (nav.length) {
        tl.add(nav, {
          maxWidth: "0px",
          opacity: 0,
          x: -8,
          delay: stagger(24, { reversed: true }),
          duration: 220,
        }, 50);
      }

      sections.forEach((el, i) => {
        const h = heights[i] || 0;
        tl.add(el, {
          height: [`${h}px`, "0px"],
          opacity: 0,
          y: -12,
          duration: lite ? 320 : 420,
          ease: EASE_IN,
        }, 80 + (sections.length - 1 - i) * 40);
      });
    });
  }

  function syncFromDom() {
    openState = document.body.classList.contains("profile-open");
    setBrandLabel(openState);
  }

  window.KayaProfileReveal = {
    setOpen,
    syncFromDom,
    isBusy: () => busy,
    isOpen: () => openState,
  };
})();
