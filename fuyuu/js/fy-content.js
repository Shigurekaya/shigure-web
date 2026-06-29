/** 浮游Lev 全站中文文案与页眉页脚修正 */
(() => {
  const DATA = window.SITE_DATA || {};
  const user = DATA.user || {};
  const BILIBILI = DATA.bilibili_url || "https://space.bilibili.com/353604313";

  const TEXT_MAP = [
    [/こもわた遙華/g, "浮游Lev"],
    [/こもわた/g, "浮游Lev"],
    [/Haruka Komowata/g, "浮游Lev"],
    [/Mini characters, illustrations & work/g, "Q版角色、插画与绘画过程"],
    [/Load More/g, "加载更多"],
    [/top of page/g, "回到顶部"],
    [/Use tab to navigate through the menu items\./g, "使用 Tab 键浏览菜单。"],
    [/LINK/g, "链接"],
    [/©KOMOWA\/Haruka Komowata/g, "©浮游Lev"],
    [/©KOMOWA\\/浮游Lev/g, "©浮游Lev"],
    [/©KOMOWA/g, "©浮游Lev"],
    [/Mail/g, "哔哩哔哩"],
    [/Twitter/g, "哔哩哔哩"],
  ];

  const fixTextNodes = () => {
    const keepEnglish = document.body.classList.contains("fy-page-index");
    document.querySelectorAll(
      ".wixui-rich-text__text, [data-testid='richTextElement'], .TvbeET, nav a, .wixui-dropdown-menu a"
    ).forEach((el) => {
      if (!el.textContent || el.closest("script, style, .fy-topbar, .fy-home-inject")) return;
      let html = el.innerHTML;
      let changed = false;
      for (const [pat, rep] of TEXT_MAP) {
        if (keepEnglish && (pat.source === "Load More" || pat.source === "LINK")) continue;
        if (pat.test(html)) {
          html = html.replace(pat, rep);
          changed = true;
        }
      }
      if (changed) el.innerHTML = html;
    });
  };

  const fixHero = () => {
    const name = user.name || "浮游Lev";
    const sign = user.sign || "梦想成为自由的旮旯给木画师";
    ["comp-j63afz3b", "comp-in9w3o9f"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML =
        '<p class="font_6 wixui-rich-text__text" style="text-align:center;">'
        + `<span class="wixui-rich-text__text"><a href="about.html">${name}</a></span></p>`;
    });
    ["comp-iszo71xz", "comp-j6397vpq"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML =
        '<p class="font_6 wixui-rich-text__text" style="text-align:center;">'
        + `<span class="wixui-rich-text__text">${sign}</span></p>`;
    });
    const av = document.getElementById("img_comp-imyso5rc");
    if (av && user.avatar) av.src = user.avatar;
    const av2 = document.getElementById("img_comp-l701c62k");
    if (av2) av2.src = "assets/images/avatar.jpg";
  };

  const fixFooter = () => {
    const isIndex = document.body.classList.contains("fy-page-index");
    const copy = document.getElementById("comp-l720aboy");
    if (copy) {
      copy.innerHTML =
        '<p class="font_8 wixui-rich-text__text" style="text-align:center;">'
        + '<span class="wixui-rich-text__text">©浮游Lev</span></p>';
    }
    const desc = document.getElementById("comp-l70jwtsp");
    if (desc) {
      const h = desc.querySelector("h5, .font_5");
      if (h) h.textContent = isIndex ? "LINK" : "链接";
    }
    const lead = document.getElementById("comp-l70mukcx4");
    if (lead) {
      lead.innerHTML =
        '<p class="font_8 wixui-rich-text__text">'
        + "绘画过程与投稿发布在哔哩哔哩。插画见首页，视频见「作品」与「作品集」。"
        + "</p>";
    }
  };

  const hasJapanese = (s) => /[぀-ゟ゠-ヿ]/.test(s || "");

  const fixNav = () => {
    const navMap = { HOME: "首页", WORK: "作品", ABOUT: "关于", PORTFOLIO: "作品集" };
    document.querySelectorAll("nav a, .wixui-dropdown-menu a").forEach((a) => {
      if (a.closest(".fy-topbar")) return;
      const t = (a.textContent || "").trim();
      const href = (a.getAttribute("href") || "").toLowerCase();
      if (href.includes("kakuu") || t === "KAKUU" || t === "原创") {
        const li = a.closest("li");
        if (li) li.remove();
        else a.remove();
        return;
      }
      if (navMap[t]) a.textContent = navMap[t];
      if (t.includes("ああああ")) {
        const li = a.closest("li");
        if (li) li.remove();
        else a.remove();
      }
    });
    document.querySelectorAll('nav[aria-label="サイト"]').forEach((n) => {
      n.setAttribute("aria-label", "网站导航");
    });
  };

  const fixIndexGallery = () => {
    if (!document.body.classList.contains("fy-page-index")) return;
    const gallery = window.HOME_GALLERY || [];
    document.querySelectorAll("#pro-gallery-comp-j3v9reg1 .info-element-title").forEach((el, i) => {
      const src = gallery[i % gallery.length];
      if (!src) return;
      const cap = src.split("/").pop().replace(/\.[^.]+$/, "");
      if (cap && (hasJapanese(el.textContent) || !el.textContent.trim())) {
        el.textContent = cap;
      }
    });
    document.querySelectorAll("#pro-gallery-comp-j3v9reg1 .info-element-description").forEach((el) => {
      if (hasJapanese(el.textContent) || /です|の|様/.test(el.textContent || "")) {
        el.textContent = "浮游Lev Q版插画作品。";
      }
    });
  };

  const fixLegacyLinks = () => {
    document.querySelectorAll("[data-legacy-link]").forEach((el) => {
      el.removeAttribute("data-legacy-link");
      if (el.tagName === "A" && !el.href.includes("bilibili")) {
        const href = el.getAttribute("href") || BILIBILI;
        if (href.includes("komowata") || href.includes("%E3%81%93%E3%82%82")) {
          el.setAttribute("href", BILIBILI);
        }
      }
    });
  };

    const fixAboutPicks = () => {
        if (!DATA.videos || !document.getElementById("fy-about-inject")) return;
        const ul = document.querySelector("#fy-about-inject .fy-about-picks");
        if (!ul || ul.children.length) return;
        ul.innerHTML = DATA.videos.slice(0, 8).map((v) =>
            `<li><a href="https://www.bilibili.com/video/${v.bvid}" target="_blank" rel="noopener">${v.title}</a></li>`
        ).join("");
    };

  const fixHeaderBanners = () => {
    if (!document.body.classList.contains("fy-page-index")) return;
    const lead = document.getElementById("comp-mqk7r3rt");
    const row = document.getElementById("comp-lstqan45");
    if (!lead || !row || document.getElementById("fy-header-banners")) return;
    const wrap = document.createElement("div");
    wrap.id = "fy-header-banners";
    wrap.className = "fy-header-banners";
    lead.parentNode.insertBefore(wrap, lead);
    wrap.appendChild(lead);
    wrap.appendChild(row);
  };

  const run = () => {
    fixTextNodes();
    fixHero();
    fixFooter();
    fixNav();
    fixLegacyLinks();
    fixAboutPicks();
    fixIndexGallery();
    fixHeaderBanners();
  };

  run();
  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("load", run);
  setTimeout(run, 400);
  setTimeout(run, 1200);
})();
