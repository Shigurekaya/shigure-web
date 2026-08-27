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

  /** @type {Animation | null} */
  let activePinWa = null;
  /** @type {HTMLElement | null} */
  let pinnedAvatar = null;
  /** @type {{ parent: Element, next: ChildNode | null, placeholder: HTMLElement | null } | null} */
  let avatarHome = null;
  /** @type {{ w: number, h: number }} */
  let avatarNatural = { w: 128, h: 128 };
  /** 与原 WAAPI cubic-bezier(0.22, 1, 0.36, 1) 对齐 */
  const PIN_EASE = "cubicBezier(0.22, 1, 0.36, 1)";

  function isLite() {
    if (window.KayaPerfGovernor?.isPhoneLike?.()) return true;
    if (window.matchMedia("(max-width: 720px)").matches) return true;
    if (window.matchMedia("(prefers-reduced-data: reduce)").matches) return true;
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
    return [...document.querySelectorAll(".page-home .home-section--more .home-card")];
  }

  function socialPills() {
    return [...document.querySelectorAll(".page-home .social-pill")];
  }

  function navLinkEls() {
    return navEls().map((el) => el.querySelector("a") || el);
  }

  function prepNavClosed() {
    navEls().forEach((el) => {
      el.style.overflow = "visible";
      el.style.maxWidth = "";
      el.style.opacity = "1";
      el.style.transform = "";
    });
    navLinkEls().forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translate3d(-8px,0,0)";
      el.style.willChange = "opacity, transform";
      el.style.whiteSpace = "nowrap";
    });
  }

  function setBrandLabel(open) {
    const text = brandTextEl();
    if (text) text.textContent = open ? BRAND_OPEN : BRAND_CLOSED;
  }

  function killActive() {
    cancelPinMotion();
    if (pinnedAvatar) {
      pinnedAvatar.style.transform = "none";
      clearInline(pinnedAvatar);
      restoreAvatarHome();
    }
    pinnedAvatar = null;
    document.body.classList.remove("is-avatar-pinned");
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
    "position", "left", "top", "zIndex", "margin",
    "transition", "transformOrigin", "contain",
  ];

  function clearInline(el) {
    if (!(el instanceof HTMLElement)) return;
    for (let i = 0; i < INLINE_KEYS.length; i++) el.style[INLINE_KEYS[i]] = "";
  }

  function clearAllInline() {
    cancelPinMotion();
    restoreAvatarHome();
    unpinAvatar(pinnedAvatar);
    pinnedAvatar = null;
    avatarHome = null;
    document.body.classList.remove("is-avatar-pinned");
    sectionEls().forEach(clearInline);
    navEls().forEach(clearInline);
    navLinkEls().forEach(clearInline);
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

  function cancelPinMotion() {
    if (activePinWa) {
      try { activePinWa.cancel(); } catch { /* ignore */ }
      activePinWa = null;
    }
  }

  function avatarCenter(rect) {
    return { cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2 };
  }

  /** 固定层：left/top 锚在 first 中心，位移/缩放只写 transform */
  function applyPinFrame(avatar, first, target, progress) {
    if (!avatar || !first || !target) return;
    if (avatar !== pinnedAvatar) return;
    if (avatar.style.position !== "fixed") return;
    const f = avatarCenter(first);
    const l = avatarCenter(target);
    const s0 = first.w / avatarNatural.w;
    const s1 = target.w / Math.max(avatarNatural.w, 1);
    const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
    const dx = (l.cx - f.cx) * p;
    const dy = (l.cy - f.cy) * p;
    const s = s0 + (s1 - s0) * p;
    avatar.style.transform = `translate(-50%, -50%) translate3d(${dx}px, ${dy}px, 0) scale(${s})`;
  }

  /** 脱离 profile-hero；占位 div 防止名字/签名顶上来与飞入头像重叠 */
  function detachAvatar(avatar) {
    if (!avatar || avatarHome) return;
    const parent = avatar.parentElement;
    if (!parent) return;
    const placeholder = document.createElement("div");
    placeholder.className = "profile-avatar-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.style.width = `${avatarNatural.w}px`;
    placeholder.style.height = `${avatarNatural.h}px`;
    placeholder.style.margin = "0 auto 1.35rem";
    parent.replaceChild(placeholder, avatar);
    avatarHome = { parent, next: placeholder.nextSibling, placeholder };
    document.body.appendChild(avatar);
  }

  function restoreAvatarHome(avatar) {
    const el = avatar || pinnedAvatar;
    if (!el || !avatarHome?.parent) {
      avatarHome?.placeholder?.remove();
      avatarHome = null;
      return;
    }
    const { parent, placeholder } = avatarHome;
    if (placeholder?.isConnected) {
      parent.replaceChild(el, placeholder);
    } else {
      parent.insertBefore(el, avatarHome.next);
    }
    avatarHome = null;
  }

  /** 固定真实 .profile-avatar：保持自然尺寸，中心对齐 + scale 匹配目标框 */
  function pinAvatar(avatar, targetRect) {
    detachAvatar(avatar);
    const { w: nw, h: nh } = avatarNatural;
    const { cx, cy } = avatarCenter(targetRect);
    const scale = targetRect.w / nw;
    avatar.style.position = "fixed";
    avatar.style.left = `${cx}px`;
    avatar.style.top = `${cy}px`;
    avatar.style.width = `${nw}px`;
    avatar.style.height = `${nh}px`;
    avatar.style.margin = "0";
    avatar.style.transformOrigin = "50% 50%";
    avatar.style.transform = `translate(-50%, -50%) scale(${scale})`;
    avatar.style.zIndex = "240";
    avatar.style.opacity = "1";
    avatar.style.visibility = "visible";
    avatar.style.pointerEvents = "none";
    avatar.style.willChange = "transform";
  }

  function unpinAvatar(avatar) {
    cancelPinMotion();
    if (!avatar) return;
    clearInline(avatar);
  }

  /** 落地前读取占位槽，与飞入终点对齐 */
  function readSlotRect() {
    const ph = avatarHome?.placeholder;
    return ph ? readRect(ph) : null;
  }

  /**
   * 飞向「实时目标」：每帧读 getLast()，避免预测量 last 与落地 slot 不一致导致残跳。
   * @param {() => ({ x: number, y: number, w: number, h: number } | null)} getLast
   * @param {(() => void) | null} [onPinComplete]
   */
  function syncPinMotion(tl, avatar, first, getLast, duration, at, onPinComplete) {
    if (!avatar || !first || !duration) return null;
    const resolveLast = typeof getLast === "function" ? getLast : () => getLast;
    const seed = resolveLast();
    if (!seed) return null;
    cancelPinMotion();
    applyPinFrame(avatar, first, seed, 0);

    const state = { p: 0 };
    const tick = () => {
      const target = resolveLast() || seed;
      applyPinFrame(avatar, first, target, state.p);
    };

    tl.add(state, {
      p: [0, 1],
      duration,
      ease: PIN_EASE,
      onUpdate: tick,
      onComplete: () => {
        const target = resolveLast() || seed;
        applyPinFrame(avatar, first, target, 1);
        onPinComplete?.();
      },
    }, at);
    return state;
  }

  /**
   * 落地：先记 fixed 视觉框，还原 DOM 后同帧 FLIP（无第二段动画）。
   * 飞入已实时追 slot，正常情况 delta≈0，不会触发 invert。
   */
  function releasePinnedAvatar(avatar, { restore = true } = {}) {
    cancelPinMotion();

    const hero = document.getElementById("profile-hero");
    if (hero) {
      hero.style.transform = "none";
      hero.style.contain = "none";
    }

    if (!avatar) {
      avatarHome?.placeholder?.remove();
      avatarHome = null;
      if (restore) pinnedAvatar = null;
      document.body.classList.remove("is-avatar-pinned");
      return;
    }

    avatar.style.transition = "none";

    if (!restore) {
      document.body.classList.remove("is-avatar-pinned");
      return;
    }

    const fromRect = avatar.style.position === "fixed" ? readRect(avatar) : null;

    restoreAvatarHome(avatar);
    pinnedAvatar = null;
    document.body.classList.remove("is-avatar-pinned");

    clearInline(avatar);
    avatar.style.transition = "none";

    const toRect = readRect(avatar);
    if (fromRect && toRect) {
      const f = avatarCenter(fromRect);
      const t = avatarCenter(toRect);
      const dx = f.cx - t.cx;
      const dy = f.cy - t.cy;
      const sx = fromRect.w / Math.max(toRect.w, 1);
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || Math.abs(sx - 1) > 0.01) {
        avatar.style.transformOrigin = "50% 50%";
        avatar.style.transform = `translate(${dx}px, ${dy}px) scale(${sx})`;
        void avatar.offsetWidth;
        avatar.style.transform = "";
        avatar.style.transformOrigin = "";
      }
    }

    avatar.style.transition = "";
  }

  /** 关闭时：在 brand 位置隐藏，保持 fixed，finish 再还原 DOM */
  function hidePinnedAvatar(avatar) {
    cancelPinMotion();
    if (avatar) {
      avatar.style.transition = "none";
      avatar.style.opacity = "0";
      avatar.style.visibility = "hidden";
      avatar.style.pointerEvents = "none";
    }
    document.body.classList.remove("is-avatar-pinned");
  }

  function removeLegacyFlyer() {
    document.getElementById("avatar-flyer")?.remove();
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
      const h = Math.round(el.getBoundingClientRect().height || el.scrollHeight || 0);
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
      pointerEvents: hero.style.pointerEvents,
    };
    const prevAv = {
      opacity: wrap.style.opacity,
      transform: wrap.style.transform,
      visibility: wrap.style.visibility,
    };
    /* 保持与 profile-animating 相同的合成环境，勿强行清 transform（避免 last≠slot） */
    hero.style.height = `${heroH}px`;
    hero.style.opacity = "1";
    hero.style.overflow = "visible";
    hero.style.visibility = "hidden";
    hero.style.pointerEvents = "none";
    wrap.style.opacity = "1";
    wrap.style.transform = "none";
    wrap.style.visibility = "visible";
    void hero.offsetHeight;
    const rect = readRect(wrap);
    if (rect) avatarNatural = { w: rect.w, h: rect.h };
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

  function prepClosedVisual(el, { skipY = false } = {}) {
    el.style.overflow = "hidden";
    el.style.height = "0px";
    el.style.opacity = "0";
    el.style.visibility = "visible";
    el.style.pointerEvents = "none";
    el.style.transform = skipY ? "none" : "translate3d(0,-16px,0)";
    el.style.willChange = skipY ? "height, opacity" : "height, opacity, transform";
  }

  function snapOpen() {
    document.body.classList.add("profile-open");
    document.body.classList.remove("profile-animating", "is-avatar-flying", "is-avatar-pinned");
    removeLegacyFlyer();
    clearAllInline();
    setBrandLabel(true);
    openState = true;
    brandEl()?.setAttribute("aria-expanded", "true");
  }

  function snapClosed() {
    document.body.classList.remove("profile-open", "profile-animating", "is-avatar-flying", "is-avatar-pinned");
    removeLegacyFlyer();
    clearAllInline();
    setBrandLabel(false);
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
    removeLegacyFlyer();
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
      const navLinks = navLinkEls();
      const hero = document.getElementById("profile-hero");
      const kids = heroChildren(hero);
      const cards = cardChildren();
      const pills = lite ? [] : socialPills();
      const avatar = heroAvatarWrap();
      const restKids = kids.filter((el) => el !== avatar);

      sections.forEach((el) => prepClosedVisual(el));
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
      prepNavClosed();

      const heights = measureHeights(sections);
      const last = measureHeroAvatarRect(heights[0]) || first;
      const usePinFly = !lite && first && last && avatar;
      if (usePinFly && hero) prepClosedVisual(hero, { skipY: true });

      let avatarReleased = false;
      const releaseOnce = (av) => {
        if (avatarReleased) return;
        avatarReleased = true;
        releasePinnedAvatar(av);
      };

      if (usePinFly) {
        document.body.classList.add("is-avatar-flying", "is-avatar-pinned");
        if (brandAv) brandAv.style.opacity = "0";
        avatar.style.opacity = "1";
        avatar.style.visibility = "visible";
        avatar.style.transition = "none";
        pinAvatar(avatar, first);
        pinnedAvatar = avatar;
      }

      const durSection = lite ? 420 : 620;
      const durPinFly = lite ? 0 : 720;
      const staggerGap = lite ? 40 : 70;

      const finish = () => {
        if (token !== gen) return;
        sections.forEach((el) => {
          /* 先锁当前像素高再切 auto，避免 ceil/合成层差值造成二次位移 */
          const h = Math.round(el.getBoundingClientRect().height || 0);
          if (h > 0) el.style.height = `${h}px`;
        });
        void document.body.offsetHeight;
        sections.forEach((el) => {
          el.style.height = "auto";
          el.style.overflow = "visible";
          el.style.transform = "";
          el.style.contain = "";
          el.style.opacity = "1";
          el.style.pointerEvents = "";
          el.style.willChange = "";
        });
        kids.forEach(clearInline);
        cards.forEach(clearInline);
        pills.forEach(clearInline);
        nav.forEach(clearInline);
        navLinkEls().forEach(clearInline);
        if (brandAv) brandAv.style.opacity = "";
        setBrandLabel(true);
        releaseOnce(avatar);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (token !== gen) return;
            document.body.classList.remove("profile-animating", "is-avatar-flying");
            activeTl = null;
            busy = false;
            openState = true;
            resolve();
          });
        });
      };

      const tl = createTimeline({
        defaults: { ease: EASE_OUT },
        onComplete: finish,
      });
      activeTl = tl;

      morphBrandLabel(true, tl, usePinFly ? durPinFly - 80 : 20);

      if (usePinFly) {
        const getFlyTarget = () => readSlotRect() || last;
        syncPinMotion(tl, avatar, first, getFlyTarget, durPinFly, 0, () => releaseOnce(avatar));
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
        const skipHeroY = usePinFly && el === hero;
        const props = {
          height: [`0px`, `${heights[i]}px`],
          opacity: [0, 1],
          duration: durSection,
          ease: EASE_OUT,
        };
        if (!skipHeroY) props.y = [-16, 0];
        tl.add(el, props, i * staggerGap);
      });

      const textRevealAt = usePinFly ? durPinFly + 64 : (lite ? 120 : 200);
      const pillsRevealAt = usePinFly ? durPinFly + 140 : 280;

      if (restKids.length) {
        tl.add(restKids, {
          opacity: [0, 1],
          y: [16, 0],
          delay: stagger(lite ? 40 : 60),
          duration: lite ? 360 : 480,
          ease: EASE_SOFT,
        }, textRevealAt);
      }

      if (pills.length) {
        tl.add(pills, {
          opacity: [0, 1],
          y: [8, 0],
          scale: [0.88, 1],
          delay: stagger(40),
          duration: 360,
          ease: EASE_SOFT,
        }, pillsRevealAt);
      }

      if (navLinks.length) {
        tl.add(navLinks, {
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
      const navLinks = navLinkEls();
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
        const h = Math.round(el.getBoundingClientRect().height || heightCache.get(el) || el.scrollHeight || 0);
        el.style.height = `${h}px`;
        el.style.overflow = "hidden";
        el.style.willChange = "height, opacity, transform";
        return h;
      });

      nav.forEach((el) => {
        el.style.overflow = "visible";
        el.style.maxWidth = "";
      });
      navLinks.forEach((el) => {
        el.style.whiteSpace = "nowrap";
        el.style.willChange = "opacity, transform";
      });

      const usePinFly = !lite && first && last && avatar;
      const durPinClose = lite ? 0 : 520;
      if (usePinFly) {
        document.body.classList.add("is-avatar-flying", "is-avatar-pinned");
        avatar.style.opacity = "1";
        avatar.style.visibility = "visible";
        avatar.style.transition = "none";
        pinAvatar(avatar, first);
        pinnedAvatar = avatar;
        if (brandAv) brandAv.style.opacity = "0";
      }

      const finish = () => {
        if (token !== gen) return;
        if (avatar && avatarHome) releasePinnedAvatar(avatar);
        document.body.classList.remove("profile-open", "profile-animating", "is-avatar-flying", "is-avatar-pinned");
        clearAllInline();
        setBrandLabel(false);
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

      if (usePinFly) {
        const getFlyTarget = () => readRect(brandAv) || last;
        syncPinMotion(tl, avatar, first, getFlyTarget, durPinClose, 20);
        if (brandAv) {
          tl.add(brandAv, {
            opacity: [0, 1],
            duration: 160,
            ease: EASE_SOFT,
          }, 20 + durPinClose - 48);
        }
        tl.call(() => hidePinnedAvatar(avatar), 20 + durPinClose);
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

      if (navLinks.length) {
        tl.add(navLinks, {
          opacity: 0,
          x: -8,
          delay: stagger(24, { reversed: true }),
          duration: 220,
          ease: EASE_IN,
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

  removeLegacyFlyer();

  window.KayaProfileReveal = {
    setOpen,
    syncFromDom,
    isBusy: () => busy,
    isOpen: () => openState,
  };
})();
