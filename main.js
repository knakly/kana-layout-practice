"use strict";

const LAYOUT_PATH = "layouts/best_layout_char_to_position.tsv";

const DEFAULT_LAYOUT_TSV = `文字	配置位置
゛	l
゜	kz
あ	kf
い	;
う	m
え	dk
お	ks
ぁ	kt
ぃ	d.
ぅ	dy
ぇ	kq
ぉ	d,
か	s
き	h
く	p
け	ds
こ	v
さ	t
し	i
す	c
せ	x
そ	ka
た	f
ち	dm
つ	kj
て	g
と	a
っ	u
な	r
に	w
ぬ	kw
ね	kc
の	o
は	e
ひ	dj
ふ	kg
へ	kx
ほ	kr
ま	z
み	dp
む	du
め	dn
も	kd
や	dh
ゆ	ke
よ	kb
ゃ	di
ゅ	df
ょ	b
ら	q
り	kl
る	n
れ	y
ろ	kv
わ	do
を	dl
ん	j
ー	d;
、	,
。	.`;

const lessons = [
  "はこにはかさたな",
  "こんにちは。",
  "かなのれんしゅうをします。",
  "がぎぐげご、ざじずぜぞ。",
  "ぱぴぷぺぽ、ばびぶべぼ。",
  "きょうはよいひです。",
  "じぶんのかなはいれつをれんしゅうします。"
];

const dakutenMap = {
  "か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご",
  "さ": "ざ", "し": "じ", "す": "ず", "せ": "ぜ", "そ": "ぞ",
  "た": "だ", "ち": "ぢ", "つ": "づ", "て": "で", "と": "ど",
  "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ"
};

const handakutenMap = {
  "は": "ぱ", "ひ": "ぴ", "ふ": "ぷ", "へ": "ぺ", "ほ": "ぽ"
};

const reverseDakutenMap = invertMap(dakutenMap);
const reverseHandakutenMap = invertMap(handakutenMap);

const keyTokenToCode = {
  q: "KeyQ", w: "KeyW", e: "KeyE", r: "KeyR", t: "KeyT",
  y: "KeyY", u: "KeyU", i: "KeyI", o: "KeyO", p: "KeyP",
  a: "KeyA", s: "KeyS", d: "KeyD", f: "KeyF", g: "KeyG",
  h: "KeyH", j: "KeyJ", k: "KeyK", l: "KeyL", ";": "Semicolon",
  z: "KeyZ", x: "KeyX", c: "KeyC", v: "KeyV", b: "KeyB",
  n: "KeyN", m: "KeyM", ",": "Comma", ".": "Period", "/": "Slash",
  " ": "Space"
};

const codeToKeyToken = invertMap(keyTokenToCode);
const prefixTokens = new Set(["d", "k"]);
const keyboardRows = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"]
];

const STORAGE_KEY = "kanaLayoutPracticeStats:v1";

let charToStroke = new Map();
let strokeToChar = new Map();
let state = makeInitialState();

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  collectElements();
  attachEvents();
  const tsv = await loadLayoutTsv();
  setLayout(parseLayoutTsv(tsv));
  renderTotals();
  startPractice(lessons[0], 0);
  setInterval(renderLiveMetrics, 250);
}

function collectElements() {
  Object.assign(els, {
    totalSessions: document.getElementById("totalSessions"),
    totalKeystrokes: document.getElementById("totalKeystrokes"),
    totalMisses: document.getElementById("totalMisses"),
    prevLessonButton: document.getElementById("prevLessonButton"),
    nextLessonButton: document.getElementById("nextLessonButton"),
    restartButton: document.getElementById("restartButton"),
    lessonName: document.getElementById("lessonName"),
    practiceArea: document.getElementById("practiceArea"),
    warningBox: document.getElementById("warningBox"),
    targetText: document.getElementById("targetText"),
    typedText: document.getElementById("typedText"),
    nextKey: document.getElementById("nextKey"),
    nextStroke: document.getElementById("nextStroke"),
    prefixState: document.getElementById("prefixState"),
    missCount: document.getElementById("missCount"),
    progressBar: document.getElementById("progressBar"),
    lastMiss: document.getElementById("lastMiss"),
    keyboard: document.getElementById("keyboard"),
    customStartButton: document.getElementById("customStartButton"),
    customText: document.getElementById("customText"),
    elapsedTime: document.getElementById("elapsedTime"),
    accuracy: document.getElementById("accuracy"),
    keystrokeCount: document.getElementById("keystrokeCount"),
    kanaCount: document.getElementById("kanaCount"),
    keysPerMinute: document.getElementById("keysPerMinute"),
    kanaPerMinute: document.getElementById("kanaPerMinute"),
    resultDetails: document.getElementById("resultDetails")
  });
}

function attachEvents() {
  document.addEventListener("keydown", handleKeyDown);

  els.prevLessonButton.addEventListener("click", () => {
    const nextIndex = (state.lessonIndex - 1 + lessons.length) % lessons.length;
    startPractice(lessons[nextIndex], nextIndex);
  });

  els.nextLessonButton.addEventListener("click", () => {
    const nextIndex = (state.lessonIndex + 1) % lessons.length;
    startPractice(lessons[nextIndex], nextIndex);
  });

  els.restartButton.addEventListener("click", () => {
    startPractice(state.practiceText, state.lessonIndex);
  });

  els.customStartButton.addEventListener("click", () => {
    const customText = els.customText.value.trim();
    if (!customText) {
      setLastMiss("練習文が空です。");
      return;
    }
    startPractice(customText, -1);
  });

  document.querySelectorAll(".face-switch button").forEach((button) => {
    button.addEventListener("click", () => {
      state.keyboardFace = button.dataset.face || "";
      renderKeyboard();
    });
  });

  els.practiceArea.addEventListener("click", () => els.practiceArea.focus());
}

async function loadLayoutTsv() {
  if (window.location.protocol === "file:") {
    return DEFAULT_LAYOUT_TSV;
  }

  try {
    const response = await fetch(LAYOUT_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    console.warn("Failed to load layout TSV. Falling back to embedded layout.", error);
    return DEFAULT_LAYOUT_TSV;
  }
}

function parseLayoutTsv(tsv) {
  const rows = tsv.trim().split(/\r?\n/);
  const parsed = [];

  for (const row of rows) {
    const [char, stroke] = row.split("\t");
    if (!char || !stroke || char === "文字") continue;
    parsed.push({ char, stroke });
  }

  return parsed;
}

function setLayout(entries) {
  charToStroke = new Map();
  strokeToChar = new Map();

  for (const entry of entries) {
    charToStroke.set(entry.char, entry.stroke);
    strokeToChar.set(entry.stroke, entry.char);
  }

  charToStroke.set(" ", " ");
  strokeToChar.set(" ", " ");
}

function startPractice(text, lessonIndex) {
  if (state.missFlashTimer) {
    window.clearTimeout(state.missFlashTimer);
  }

  const model = buildPracticeModel(text);
  state = {
    ...makeInitialState(),
    lessonIndex,
    practiceText: text,
    chars: Array.from(text),
    targetUnits: model.units,
    expectedStrokes: model.expectedStrokes,
    displayMeta: model.displayMeta,
    unsupportedChars: model.unsupportedChars
  };

  els.lastMiss.textContent = "ミスなし";
  els.practiceArea.classList.remove("is-miss");
  els.lessonName.textContent = lessonIndex >= 0 ? `Lesson ${lessonIndex + 1} / ${lessons.length}` : "Custom";
  renderAll();
  requestAnimationFrame(() => els.practiceArea.focus());
}

function buildPracticeModel(text) {
  const chars = Array.from(text);
  const units = [];
  const expectedStrokes = [];
  const displayMeta = chars.map((char) => ({
    char,
    unsupported: false,
    startStroke: Number.POSITIVE_INFINITY,
    endStroke: Number.NEGATIVE_INFINITY
  }));
  const unsupportedChars = [];
  let strokeCursor = 0;

  chars.forEach((displayChar, displayIndex) => {
    const decomposed = decomposeChar(displayChar);
    if (!decomposed) {
      displayMeta[displayIndex].unsupported = true;
      unsupportedChars.push(displayChar);
      return;
    }

    for (const inputChar of decomposed) {
      const sequence = charToStroke.get(inputChar);
      if (!sequence) {
        displayMeta[displayIndex].unsupported = true;
        unsupportedChars.push(displayChar);
        continue;
      }

      const unitIndex = units.length;
      const tokens = Array.from(sequence);
      const unit = {
        index: unitIndex,
        char: inputChar,
        displayChar,
        displayIndex,
        sequence,
        startStroke: strokeCursor,
        endStroke: strokeCursor + tokens.length
      };
      units.push(unit);

      displayMeta[displayIndex].startStroke = Math.min(displayMeta[displayIndex].startStroke, unit.startStroke);
      displayMeta[displayIndex].endStroke = Math.max(displayMeta[displayIndex].endStroke, unit.endStroke);

      tokens.forEach((token, offset) => {
        expectedStrokes.push({
          token,
          offset,
          unitIndex,
          sequence,
          displayChar
        });
      });

      strokeCursor += tokens.length;
    }
  });

  return {
    units,
    expectedStrokes,
    displayMeta,
    unsupportedChars: [...new Set(unsupportedChars)]
  };
}

function decomposeChar(char) {
  if (charToStroke.has(char)) return [char];
  if (reverseDakutenMap[char]) return [reverseDakutenMap[char], "゛"];
  if (reverseHandakutenMap[char]) return [reverseHandakutenMap[char], "゜"];
  return null;
}

function handleKeyDown(event) {
  if (!shouldHandleKeyEvent(event)) return;

  if (event.key === "Backspace") {
    event.preventDefault();
    handleBackspace();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    clearPrefixState();
    renderAll();
    return;
  }

  const token = codeToKeyToken[event.code];
  if (!token) return;

  event.preventDefault();

  if (state.finishedAt || state.unsupportedChars.length > 0) {
    return;
  }

  ensureStarted();
  state.stats.keystrokes += 1;

  const expectedStroke = state.expectedStrokes[state.strokeIndex];
  if (!expectedStroke) {
    renderAll();
    return;
  }

  if (token !== expectedStroke.token) {
    recordMiss(token, expectedStroke);
    renderAll();
    return;
  }

  acceptCorrectToken(token, expectedStroke);
  renderAll();
}

function shouldHandleKeyEvent(event) {
  if (event.isComposing) return false;

  const target = event.target;
  const editable = target.closest?.("textarea, input, select, button, a");
  if (editable) return false;

  if (event.ctrlKey || event.metaKey || event.altKey) {
    if (document.activeElement === els.practiceArea) event.preventDefault();
    return false;
  }

  return document.activeElement === els.practiceArea || document.activeElement === document.body;
}

function ensureStarted() {
  if (state.startedAt) return;
  const now = performance.now();
  state.startedAt = now;
  state.displayStartedAt = now;
}

function acceptCorrectToken(token, expectedStroke) {
  const unit = state.targetUnits[expectedStroke.unitIndex];

  if (isPrefixStart(token, expectedStroke, unit)) {
    state.prefixState = token;
    state.strokeIndex += 1;
    return;
  }

  const stroke = state.prefixState ? state.prefixState + token : token;
  const outputChar = strokeToChar.get(stroke);

  if (!outputChar) {
    recordMiss(token, expectedStroke);
    return;
  }

  const previousDisplayIndex = getActiveDisplayIndex();
  const historyEntry = {
    typedChars: [...state.typedChars],
    strokeIndex: unit.startStroke,
    prefixState: null,
    displayStartedAt: state.displayStartedAt
  };

  if (!applyOutputChar(outputChar)) {
    recordMiss(token, expectedStroke, "修飾できない文字です");
    return;
  }

  state.history.push(historyEntry);
  state.strokeIndex += 1;
  state.prefixState = null;
  recordDisplayReaction(previousDisplayIndex, performance.now());

  if (state.strokeIndex >= state.expectedStrokes.length) {
    finishPractice();
  }
}

function isPrefixStart(token, expectedStroke, unit) {
  return prefixTokens.has(token) && expectedStroke.offset === 0 && unit.sequence.length > 1;
}

function applyOutputChar(char) {
  if (char === "゛") {
    return applyModifier(dakutenMap);
  }

  if (char === "゜") {
    return applyModifier(handakutenMap);
  }

  state.typedChars.push(char);
  return true;
}

function applyModifier(map) {
  const lastIndex = state.typedChars.length - 1;
  if (lastIndex < 0) return false;

  const previous = state.typedChars[lastIndex];
  const modified = map[previous];
  if (!modified) return false;

  state.typedChars[lastIndex] = modified;
  return true;
}

function recordDisplayReaction(displayIndex, now) {
  if (displayIndex < 0) return;
  const meta = state.displayMeta[displayIndex];
  if (!meta || meta.unsupported || meta.endStroke > state.strokeIndex) return;

  const elapsed = Math.max(0, now - state.displayStartedAt);
  const key = meta.char;
  const current = state.stats.reactionTimes.get(key) || { total: 0, count: 0 };
  current.total += elapsed;
  current.count += 1;
  state.stats.reactionTimes.set(key, current);
  state.displayStartedAt = now;
}

function recordMiss(token, expectedStroke, reason = "") {
  const unit = state.targetUnits[expectedStroke.unitIndex];
  const actualStroke = state.prefixState ? state.prefixState + token : token;
  const expectedSequence = unit?.sequence || expectedStroke.sequence;
  const displayChar = unit?.displayChar || expectedStroke.displayChar || "";
  const expectedTokenLabel = keyLabel(expectedStroke.token);
  const actualTokenLabel = keyLabel(token);

  state.stats.misses += 1;
  incrementMap(state.stats.missedChars, displayChar || "不明");
  incrementMap(state.stats.missedStrokes, `${expectedSequence} / ${actualStroke}`);

  if (unit && (unit.sequence.length > 1 || state.prefixState || prefixTokens.has(token))) {
    state.stats.prefixMisses += 1;
  }

  const actualChar = strokeToChar.get(actualStroke);
  if (unit && (unit.char === "゛" || unit.char === "゜" || actualChar === "゛" || actualChar === "゜")) {
    state.stats.modifierMisses += 1;
  }

  if (state.prefixState) {
    state.strokeIndex = unit ? unit.startStroke : state.strokeIndex;
    state.prefixState = null;
  }

  const suffix = reason ? ` (${reason})` : "";
  setLastMiss(`期待 ${expectedTokenLabel} / 入力 ${actualTokenLabel}${suffix}`);
}

function handleBackspace() {
  if (state.finishedAt) return;

  if (state.prefixState) {
    clearPrefixState();
    renderAll();
    return;
  }

  const previous = state.history.pop();
  if (!previous) return;

  state.typedChars = [...previous.typedChars];
  state.strokeIndex = previous.strokeIndex;
  state.prefixState = previous.prefixState;
  state.displayStartedAt = performance.now();
  setLastMiss("1文字戻しました。");
  renderAll();
}

function clearPrefixState() {
  if (!state.prefixState) return;

  const currentUnit = getCurrentUnit();
  if (currentUnit) {
    state.strokeIndex = currentUnit.startStroke;
  }
  state.prefixState = null;
}

function finishPractice() {
  if (state.finishedAt) return;
  state.finishedAt = performance.now();
  updateStoredTotals();
}

function renderAll() {
  renderWarning();
  renderTargetText();
  renderTypedText();
  renderStatus();
  renderKeyboard();
  renderLiveMetrics();
  renderResultDetails();
  renderTotals();
}

function renderWarning() {
  if (state.unsupportedChars.length === 0) {
    els.warningBox.hidden = true;
    els.warningBox.textContent = "";
    return;
  }

  els.warningBox.hidden = false;
  els.warningBox.textContent = `未対応文字: ${state.unsupportedChars.join(" ")}`;
}

function renderTargetText() {
  els.targetText.textContent = "";
  const activeDisplayIndex = getActiveDisplayIndex();

  state.chars.forEach((char, index) => {
    const meta = state.displayMeta[index];
    const span = document.createElement("span");
    span.className = "target-char";
    span.textContent = char === " " ? "\u00a0" : char;

    if (meta?.unsupported) {
      span.classList.add("is-unsupported");
    } else if (meta && meta.endStroke <= state.strokeIndex) {
      span.classList.add("is-done");
    } else if (index === activeDisplayIndex && !state.finishedAt) {
      span.classList.add("is-active");
    }

    els.targetText.appendChild(span);
  });
}

function renderTypedText() {
  els.typedText.textContent = state.typedChars.join("") || "\u00a0";
}

function renderStatus() {
  const expectedStroke = state.expectedStrokes[state.strokeIndex];
  const currentUnit = getCurrentUnit();
  const progress = state.expectedStrokes.length
    ? Math.min(100, (state.strokeIndex / state.expectedStrokes.length) * 100)
    : 0;

  if (state.finishedAt) {
    els.nextKey.textContent = "完了";
    els.nextStroke.textContent = "-";
  } else if (expectedStroke) {
    els.nextKey.textContent = `${keyLabel(expectedStroke.token)} (${keyTokenToCode[expectedStroke.token]})`;
    els.nextStroke.textContent = currentUnit ? formatSequence(currentUnit.sequence) : "-";
  } else {
    els.nextKey.textContent = "-";
    els.nextStroke.textContent = "-";
  }

  els.prefixState.textContent = state.prefixState ? `${state.prefixState.toUpperCase()} シフト` : "なし";
  els.missCount.textContent = String(state.stats.misses);
  els.progressBar.style.width = `${progress}%`;
}

function renderKeyboard() {
  const effectiveFace = state.prefixState || state.keyboardFace;
  const expectedStroke = state.expectedStrokes[state.strokeIndex];

  document.querySelectorAll(".face-switch button").forEach((button) => {
    const face = button.dataset.face || "";
    button.classList.toggle("is-active", face === effectiveFace);
  });

  els.keyboard.textContent = "";

  for (const row of keyboardRows) {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";

    for (const token of row) {
      const keyEl = document.createElement("div");
      keyEl.className = "key";
      keyEl.classList.toggle("is-next", expectedStroke?.token === token);
      keyEl.classList.toggle("is-prefix", state.prefixState === token);

      const label = document.createElement("span");
      label.className = "key-label";
      label.textContent = keyLabel(token);

      const kana = document.createElement("span");
      kana.className = "key-kana";
      kana.textContent = getKeyboardKana(effectiveFace, token);

      keyEl.append(label, kana);
      rowEl.appendChild(keyEl);
    }

    els.keyboard.appendChild(rowEl);
  }
}

function getKeyboardKana(face, token) {
  if (!face) {
    if (prefixTokens.has(token)) return "前置";
    return strokeToChar.get(token) || "·";
  }

  return strokeToChar.get(face + token) || "·";
}

function renderLiveMetrics() {
  if (!els.elapsedTime) return;

  const elapsedSeconds = getElapsedSeconds();
  const kanaCount = state.chars.length;
  const minutes = elapsedSeconds > 0 ? elapsedSeconds / 60 : 0;
  const accuracy = getAccuracy();

  els.elapsedTime.textContent = `${elapsedSeconds.toFixed(1)} 秒`;
  els.accuracy.textContent = `${accuracy.toFixed(1)}%`;
  els.keystrokeCount.textContent = String(state.stats.keystrokes);
  els.kanaCount.textContent = String(kanaCount);
  els.keysPerMinute.textContent = minutes ? (state.stats.keystrokes / minutes).toFixed(1) : "0.0";
  els.kanaPerMinute.textContent = minutes ? (kanaCount / minutes).toFixed(1) : "0.0";
}

function renderResultDetails() {
  els.resultDetails.textContent = "";

  if (!state.finishedAt) {
    els.resultDetails.textContent = state.unsupportedChars.length > 0
      ? "未対応文字を含むため、この練習文は開始できません。"
      : "練習終了後に表示します。";
    return;
  }

  const dl = document.createElement("dl");
  dl.className = "result-list";

  const rows = [
    ["経過時間", `${getElapsedSeconds().toFixed(1)} 秒`],
    ["正確率", `${getAccuracy().toFixed(1)}%`],
    ["ミス数", String(state.stats.misses)],
    ["打鍵数", String(state.stats.keystrokes)],
    ["仮名数", String(state.chars.length)],
    ["打鍵/分", els.keysPerMinute.textContent],
    ["仮名/分", els.kanaPerMinute.textContent],
    ["ミスした文字", formatMap(state.stats.missedChars)],
    ["ミスした打鍵列", formatMap(state.stats.missedStrokes)],
    ["前置シフトミス数", String(state.stats.prefixMisses)],
    ["濁点/半濁点ミス数", String(state.stats.modifierMisses)]
  ];

  for (const [label, value] of rows) {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value || "なし";
    wrapper.append(dt, dd);
    dl.appendChild(wrapper);
  }

  els.resultDetails.appendChild(dl);
}

function renderTotals() {
  const totals = loadStoredTotals();
  els.totalSessions.textContent = String(totals.sessions);
  els.totalKeystrokes.textContent = String(totals.totalKeystrokes);
  els.totalMisses.textContent = String(totals.totalMisses);
}

function getActiveDisplayIndex() {
  const expectedStroke = state.expectedStrokes[state.strokeIndex];
  if (!expectedStroke) return state.chars.length;
  const unit = state.targetUnits[expectedStroke.unitIndex];
  return unit ? unit.displayIndex : state.chars.length;
}

function getCurrentUnit() {
  const expectedStroke = state.expectedStrokes[state.strokeIndex];
  return expectedStroke ? state.targetUnits[expectedStroke.unitIndex] : null;
}

function getElapsedSeconds() {
  if (!state.startedAt) return 0;
  const end = state.finishedAt || performance.now();
  return Math.max(0, (end - state.startedAt) / 1000);
}

function getAccuracy() {
  if (state.stats.keystrokes === 0) return 100;
  const correct = Math.max(0, state.stats.keystrokes - state.stats.misses);
  return (correct / state.stats.keystrokes) * 100;
}

function setLastMiss(message) {
  els.lastMiss.textContent = message;
  els.practiceArea.classList.add("is-miss");
  window.clearTimeout(state.missFlashTimer);
  state.missFlashTimer = window.setTimeout(() => {
    els.practiceArea.classList.remove("is-miss");
  }, 160);
}

function updateStoredTotals() {
  const totals = loadStoredTotals();
  totals.sessions += 1;
  totals.totalKeystrokes += state.stats.keystrokes;
  totals.totalMisses += state.stats.misses;

  for (const [char, count] of state.stats.missedChars) {
    totals.charMissCounts[char] = (totals.charMissCounts[char] || 0) + count;
  }

  for (const [char, data] of state.stats.reactionTimes) {
    const current = totals.reactionTimes[char] || { total: 0, count: 0 };
    current.total += data.total;
    current.count += data.count;
    totals.reactionTimes[char] = current;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(totals));
  } catch (error) {
    console.warn("Failed to save local practice totals.", error);
  }
}

function loadStoredTotals() {
  const fallback = {
    sessions: 0,
    totalKeystrokes: 0,
    totalMisses: 0,
    charMissCounts: {},
    reactionTimes: {}
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function makeInitialState() {
  return {
    lessonIndex: 0,
    practiceText: "",
    chars: [],
    targetUnits: [],
    expectedStrokes: [],
    displayMeta: [],
    unsupportedChars: [],
    typedChars: [],
    strokeIndex: 0,
    prefixState: null,
    keyboardFace: "",
    startedAt: null,
    finishedAt: null,
    displayStartedAt: null,
    history: [],
    missFlashTimer: 0,
    stats: {
      keystrokes: 0,
      misses: 0,
      prefixMisses: 0,
      modifierMisses: 0,
      missedChars: new Map(),
      missedStrokes: new Map(),
      reactionTimes: new Map()
    }
  };
}

function invertMap(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [value, key]));
}

function incrementMap(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function formatMap(map) {
  if (!map || map.size === 0) return "なし";
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .map(([key, count]) => `${key}: ${count}`)
    .join("、");
}

function formatSequence(sequence) {
  return Array.from(sequence).map(keyLabel).join(" → ");
}

function keyLabel(token) {
  if (token === " ") return "Space";
  if (token === ";") return ";";
  if (token === ",") return ",";
  if (token === ".") return ".";
  if (token === "/") return "/";
  return token.toUpperCase();
}

window.kanaPracticeApp = {
  lessons,
  dakutenMap,
  handakutenMap,
  getState: () => state,
  startPractice,
  parseLayoutTsv,
  buildPracticeModel
};
