/** 离线验证 WAAPI flyer 位移是否生效 */
import { chromium } from "playwright";

const html = `<!doctype html><meta charset=utf-8>
<div id=f style="position:fixed;left:200px;top:50px;width:30px;height:30px;background:red;transform-origin:0 0"></div>
<script>
window.run = () => {
  const el = document.getElementById('f');
  const wa = el.animate([
    { transform: 'translate3d(0px,0px,0) scale(1)', opacity: 1, offset: 0 },
    { transform: 'translate3d(380px,130px,0) scale(4.27)', opacity: 1, offset: 0.86 },
    { transform: 'translate3d(380px,130px,0) scale(4.27)', opacity: 0, offset: 1 },
  ], { duration: 720, fill: 'forwards' });
  return wa;
};
</script>`;

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
await page.setContent(html);
await page.evaluate(() => window.run());
await page.waitForTimeout(360);
const mid = await page.evaluate(() => {
  const cs = getComputedStyle(document.getElementById('f'));
  const m = new DOMMatrixReadOnly(cs.transform);
  return { transform: cs.transform, tx: Math.round(m.m41), ty: Math.round(m.m42) };
});
await browser.close();
console.log(JSON.stringify(mid, null, 2));
const ok = Math.abs(mid.tx) > 100;
process.exit(ok ? 0 : 1);
