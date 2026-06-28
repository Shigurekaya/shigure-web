(function () {
  "use strict";

  function init() {
    var bar = document.getElementById("th-disclaimer");
    var hint = document.getElementById("th-disclaimer-hint");
    if (!bar || !hint) return;

    var timer = null;
    var visible = false;
    var mx = 0;
    var my = 0;
    var DELAY = 700;
    var OFFSET_X = 14;
    var OFFSET_Y = 18;

    function overBar() {
      var r = bar.getBoundingClientRect();
      return mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
    }

    function placeHint() {
      var x = mx + OFFSET_X;
      var y = my + OFFSET_Y;
      hint.style.left = x + "px";
      hint.style.top = y + "px";

      var rect = hint.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) {
        x = mx - rect.width - OFFSET_X;
      }
      if (rect.bottom > window.innerHeight - 8) {
        y = my - rect.height - OFFSET_Y;
      }
      hint.style.left = Math.max(8, x) + "px";
      hint.style.top = Math.max(8, y) + "px";
    }

    function show() {
      visible = true;
      hint.hidden = false;
      hint.classList.remove("is-visible");
      hint.setAttribute("aria-hidden", "false");
      placeHint();
      requestAnimationFrame(function () {
        if (!visible) return;
        placeHint();
        requestAnimationFrame(function () {
          if (visible) hint.classList.add("is-visible");
        });
      });
    }

    function hide() {
      visible = false;
      clearTimeout(timer);
      timer = null;
      hint.classList.remove("is-visible");
      hint.setAttribute("aria-hidden", "true");
      hint.hidden = true;
    }

    function scheduleShow() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        if (overBar()) show();
      }, DELAY);
    }

    hint.hidden = true;

    document.addEventListener("mousemove", function (e) {
      mx = e.clientX;
      my = e.clientY;

      if (visible) {
        if (!overBar()) {
          hide();
          return;
        }
        placeHint();
        return;
      }

      if (overBar()) {
        if (!timer) scheduleShow();
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    });

    window.addEventListener("blur", hide);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
