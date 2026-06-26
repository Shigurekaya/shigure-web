/** fuyulev 运行时补丁 */
(() => {
  const BAND = [
    ["mqk7r3rt", "image/alice.png"],
    ["lstqan4q6", "image/key.png"],
    ["lstqan4n1", "image/q.png"],
    ["lstqan4o4", "image/rance.png"],
    ["lstqan4p1", "image/shining2.png"],
    ["lstqan4p8", "image/yiji.png"],
    ["lstqan4s", "image/白琴里.png"],
  ];

  const fix = () => {
    document.querySelectorAll('a[href*="kakuu"]').forEach((a) => {
      const li = a.closest("li");
      if (li && (li.closest("nav") || li.closest(".wixui-dropdown-menu"))) {
        li.remove();
        return;
      }
      a.setAttribute("href", "index.html");
    });

    document.querySelectorAll("nav a, nav li, .wixui-dropdown-menu a").forEach((el) => {
      if (el.textContent && el.textContent.includes("ああああ")) {
        const li = el.closest("li");
        if (li) li.remove();
        else el.remove();
      }
    });

    ["comp-l76czo62", "comp-l797z95r"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    BAND.forEach(([suffix, src]) => {
      const img = document.getElementById(`img_comp-${suffix}`);
      if (!img) return;
      img.src = src;
      img.srcset = `${src} 1x, ${src} 2x`;
    });
  };

  fix();
  document.addEventListener("DOMContentLoaded", fix);
  window.addEventListener("load", fix);
  setTimeout(fix, 500);
  setTimeout(fix, 1500);
})();
