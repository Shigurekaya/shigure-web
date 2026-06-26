/** 首页图片：仅映射 Wix 哈希路径，不做懒加载 defer */
(() => {
  window.FUYULEV_IMAGE_MAP = window.FUYULEV_IMAGE_MAP || {
    "6604cd_634729c4c4d64e6da9921b0b35afd0a2~mv2.jpg": "image/alice.png",
    "6604cd_634729c4c4d64e6da9921b0b35afd0a2.jpg": "image/q.png",
    "6604cd_618208bc28264ee9b9cd212d492d1df2.jpg": "image/rance.png",
    "6604cd_1a57124a052f4e79849853d718c1d93d.jpg": "image/shining2.png",
    "6604cd_d5fae8f268994925992539eefc41bc27.jpg": "image/yiji.png",
    "6604cd_fad989c05c254dc4ac16383c78753701.jpg": "image/白琴里.png",
    "6604cd_341c947ada2f4cb688307e70c9e3eddc.jpg": "image/椿.png",
    "6604cd_60e355dcf12e426e9813216a54acf6f0.jpg": "image/风莉.png",
    "6604cd_ded274efde094cffb700fcf86451f5b2.jpg": "image/抚子.png",
    "6604cd_1baf5db5f04e46a4a86f052175d2b90e.jpg": "image/格蕾修.png",
    "6604cd_a5ce1dde345f4598a6108f92dca1840f.jpg": "image/光刀.png",
    "6604cd_486e951473794fa3946a798d47b085f6.jpg": "image/红叶.png",
    "6604cd_10b7f3f288414ea0a27f4561d124980e.jpg": "image/加奈美.png",
    "6604cd_8c03514ba1dc41d2996177a6daf2be96.jpg": "image/库尼.png",
    "6604cd_fe5cb80da84043aa9e777bdc5705328e.jpg": "image/莱娜异画.png",
    "6604cd_83ba88c1065d41f489b54c2814419bff.jpg": "image/礼服睦月.png",
    "6604cd_21a10095f65a4b8f86463c2a15a9943a.jpg": "image/礼服泉奈.png",
    "6604cd_64ababdf31fe4048917d4eeb0a36d45a.jpg": "image/立华奏.png",
    "6604cd_f6eb49c33b3a495aabd712324f479cc5.jpg": "image/莉莉丝.png",
    "6604cd_898553a044f94ce2912db72d5e34f613.jpg": "image/莉赛特.png",
    "6604cd_6cb27ba2ee36495a817992b4ee0d024d.jpg": "image/铃女.png",
    "6604cd_bd87404892684bea8fd182825769ce21.jpg": "image/码丽丝白兔.png",
    "6604cd_4501acde74b34f5295ff7a7c0a1fab4c.jpg": "image/美羽&艾莉娜w.png",
    "6604cd_1cb36266656049d2b59475ff2eed4d96.jpg": "image/缪缪.png",
    "6604cd_36e9392a7a04476aa135aac4c9fc6d07.jpg": "image/缪缪c.png",
    "6604cd_e72ac1f5516f4a15a77160f1ffde0d02.jpg": "image/琴里.png",
    "6604cd_74f436d591bb4541aa01d734251c5bbe.jpg": "image/塞拉.png",
    "6604cd_05c56ac5ecc9448d935f071f8e9eb7d9_7Emv2.png": "assets/images/avatar.jpg",
    "6604cd_c5d2efae557548819b3a46966d545aa6_7Emv2.jpg": "assets/images/avatar.jpg",
    "buna_gasyu.jpg": "image/alice.png",
    "buna_fan.jpg": "image/key.png",
    "buna_melo.jpg": "image/q.png",
    "buna_don.jpg": "image/rance.png",
    "buna_dl.jpg": "image/shining2.png",
    "buna_line.jpg": "image/yiji.png",
    "buna_ama.jpg": "image/白琴里.png",
    "buna_kakuu.jpg": "image/椿.png",
  };

  function basename(path) {
    if (!path) return "";
    return decodeURIComponent(String(path).split("/").pop().split("?")[0]);
  }

  function lookup(key) {
    const map = window.FUYULEV_IMAGE_MAP || {};
    if (!key) return "";
    if (map[key]) return map[key];
    const noExt = key.replace(/\.(jpg|jpeg|png|webp)$/i, "");
    return map[noExt] || "";
  }

  function resolveSrc(raw, idx) {
    if (!raw || raw.startsWith("data:")) return raw;
    const gallery = window.HOME_GALLERY || [];
    const file = basename(raw);
    if (typeof idx === "number" && !Number.isNaN(idx) && gallery[idx]) return gallery[idx];
    if (file.includes("6604cd_")) return lookup(file) || raw;
    return lookup(file) || raw;
  }

  function setImg(img, src) {
    if (!src) return;
    img.src = src;
    img.srcset = `${src} 1x, ${src} 2x`;
    img.removeAttribute("data-src");
    img.removeAttribute("data-srcset");
    img.loading = "lazy";
    img.decoding = "async";
  }

  function fixImg(img) {
    const idxAttr = img.getAttribute("data-idx");
    const idx = idxAttr != null ? parseInt(idxAttr, 10) : NaN;
    const raw = img.getAttribute("src") || img.getAttribute("data-src") || "";
    const next = resolveSrc(raw, Number.isNaN(idx) ? undefined : idx);
    if (next) setImg(img, next);
  }

  function run() {
    document.querySelectorAll("img[src*='6604cd_'], img[data-src*='6604cd_'], img[srcset*='6604cd_']").forEach(fixImg);
    document.querySelectorAll("[data-hook='gallery-item-image-img']").forEach(fixImg);
  }

  window.FuyulevImageFix = { resolveSrc, run, fixImg, setImg };
  run();
  document.addEventListener("DOMContentLoaded", run, { once: true });
  window.addEventListener("load", run, { once: true });
})();
