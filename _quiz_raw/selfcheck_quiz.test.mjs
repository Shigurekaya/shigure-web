/**
 * Runtime self-test for gal-quiz logic (node --test)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataJs = fs.readFileSync(path.join(root, "js/gal-quiz-data.js"), "utf8");
const quizJs = fs.readFileSync(path.join(root, "js/gal-quiz.js"), "utf8");
const html = fs.readFileSync(path.join(root, "gal-quiz.html"), "utf8");

eval(dataJs.replace("window.GAL_QUIZ_BANK", "globalThis.GAL_QUIZ_BANK"));
const bank = globalThis.GAL_QUIZ_BANK;

function normalize(s) {
  return String(s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000]/g, "")
    .replace(/[「」『』【】\[\]()（）"'""''.,。，!！?？~～・·♥♡★☆†‡=＝:：;；]/g, "")
    .replace(/ー/g, "")
    .replace(/〜/g, "");
}

function checkText(user, answers) {
  const u = normalize(user);
  if (!u) return false;
  return (answers || []).some((a) => {
    const n = normalize(a);
    if (!n) return false;
    if (u === n) return true;
    if (u.length < 2 || n.length < 2) return false;
    return u.includes(n) || n.includes(u);
  });
}

function correctAnswerText(q) {
  if (q.type === "choice") {
    const idxs = Array.isArray(q.answer) ? q.answer : [q.answer];
    return idxs.map((i) => q.options[i]).filter(Boolean).join(" / ");
  }
  return (q.answers || []).join(" / ");
}

test("bank loaded", () => {
  assert.equal(bank.length, 119);
});

test("every question has valid structure", () => {
  const ids = new Set();
  for (const q of bank) {
    assert.ok(q.id, "missing id");
    assert.ok(!ids.has(q.id), `duplicate ${q.id}`);
    ids.add(q.id);
    assert.ok(q.question && q.question.trim(), `${q.id} empty question`);
    if (q.type === "choice") {
      assert.ok(Array.isArray(q.options) && q.options.length >= 2, q.id);
      const ans = Array.isArray(q.answer) ? q.answer : [q.answer];
      ans.forEach((i) => assert.ok(i < q.options.length, q.id));
    } else {
      assert.ok(Array.isArray(q.answers) && q.answers.length >= 1, q.id);
    }
  }
});

test("no answer text embedded in question stem", () => {
  const leaks = [];
  for (const q of bank) {
    const text = normalize(q.question);
    if (q.type === "choice") {
      const idxs = Array.isArray(q.answer) ? q.answer : [q.answer];
      for (const i of idxs) {
        const a = normalize(q.options[i]);
        if (a.length >= 3 && text.includes(a)) leaks.push(`${q.id}:${q.options[i]}`);
      }
      const hits = q.options.filter((o) => {
        const n = normalize(o);
        return n.length >= 3 && text.includes(n);
      });
      if (hits.length >= 2) leaks.push(`${q.id}:multi_opts`);
    } else {
      for (const a of q.answers) {
        const n = normalize(a);
        if (n.length >= 3 && text.includes(n)) leaks.push(`${q.id}:${a}`);
      }
    }
  }
  assert.deepEqual(leaks, []);
});

test("all media files exist on disk", () => {
  const missing = [];
  for (const q of bank) {
    for (const rel of [...(q.images || []), ...(q.audio || []), ...(q.video || [])]) {
      const p = path.join(root, rel.replace(/^\//, ""));
      if (!fs.existsSync(p)) missing.push(`${q.id}:${rel}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("checkText accepts single-char and multi-char answers", () => {
  const textQ = bank.find((q) => q.id === "s1-09");
  assert.ok(textQ);
  assert.equal(checkText("②③①", textQ.answers), true);
  assert.equal(checkText("231", textQ.answers), true);
  assert.equal(checkText("", textQ.answers), false);
  assert.equal(checkText("②", bank.find((q) => q.id === "s3-20").answers), true);
  assert.equal(checkText("左", bank.find((q) => q.id === "s5-13").answers), true);
  const choiceQ = bank.find((q) => q.id === "s1-05");
  assert.equal(choiceQ.options[choiceQ.answer], "CROSS†CHANNEL");
});

test("correctAnswerText returns non-empty for all questions", () => {
  for (const q of bank) {
    const t = correctAnswerText(q);
    assert.ok(t && t.trim(), q.id);
  }
});

test("gal-quiz.html wiring", () => {
  assert.match(html, /共 119 题/);
  assert.match(html, /id="quiz-next"/);
  assert.match(html, /id="quiz-review-list"/);
  assert.match(html, /id="quiz-review-title"/);
  assert.match(html, /data-kaya-page="quiz"/);
  assert.doesNotMatch(html, /quiz-submit/);
  assert.doesNotMatch(html, /quiz-live-review/);
});

test("gal-quiz.js has deferred review flow", () => {
  assert.match(quizJs, /recordCurrent/);
  assert.match(quizJs, /mountMedia/);
  assert.doesNotMatch(quizJs, /renderLiveReview/);
  assert.doesNotMatch(quizJs, /quiz-submit/);
  assert.doesNotMatch(quizJs, /loading="lazy"/);
});
