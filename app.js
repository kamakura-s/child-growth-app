const STORAGE_KEY = "childGrowthMvpData";
const ONBOARDING_SEEN_KEY = "childGrowthOnboardingSeen";
const SCHEMA_VERSION = 3;
const MAX_IMAGE_MB = 2;

const CONDITION_LABELS = {
  good: "元気",
  normal: "ふつう",
  tired: "つかれ気味",
  sick: "体調不良",
};

const TAG_SUGGESTIONS = {
  growth: ["発熱", "病院", "食欲", "お昼寝", "予防接種", "検診"],
  diary: ["公園", "友だち", "家族", "おでかけ", "誕生日", "習いごと"],
};

const CATEGORY_LABELS = {
  health: "健康",
  meal: "食事",
  sleep: "睡眠",
  play: "遊び",
  event: "イベント",
  other: "その他",
};

const state = {
  schemaVersion: SCHEMA_VERSION,
  profile: null,
  growthRecords: [],
  diaries: [],
  ui: {
    continuousGrowthInput: false,
    largeText: false,
    theme: "light",
  },
  filters: {
    growth: { from: "", to: "", category: "", keyword: "", tag: "" },
    diary: { from: "", to: "", category: "", keyword: "", tag: "" },
  },
};

const $ = (id) => document.getElementById(id);

const els = {
  appError: $("appError"),
  saveStatus: $("saveStatus"),
  srAnnouncer: $("srAnnouncer"),

  tabButtons: Array.from(document.querySelectorAll(".tab-btn")),
  tabPanels: Array.from(document.querySelectorAll(".tab-panel")),

  profileForm: $("profileForm"),
  childName: $("childName"),
  birthDate: $("birthDate"),
  profileNote: $("profileNote"),
  profileView: $("profileView"),
  profileError: $("profileError"),

  growthForm: $("growthForm"),
  recordDate: $("recordDate"),
  growthCategory: $("growthCategory"),
  height: $("height"),
  weight: $("weight"),
  growthTags: $("growthTags"),
  growthMemo: $("growthMemo"),
  growthConditionChoices: $("growthConditionChoices"),
  growthTagSuggestions: $("growthTagSuggestions"),
  continuousGrowthMode: $("continuousGrowthMode"),
  growthList: $("growthList"),
  growthError: $("growthError"),

  growthFilterForm: $("growthFilterForm"),
  growthFilterFrom: $("growthFilterFrom"),
  growthFilterTo: $("growthFilterTo"),
  growthFilterCategory: $("growthFilterCategory"),
  growthFilterKeyword: $("growthFilterKeyword"),
  growthFilterTag: $("growthFilterTag"),

  diaryForm: $("diaryForm"),
  diaryDate: $("diaryDate"),
  diaryTitle: $("diaryTitle"),
  diaryCategory: $("diaryCategory"),
  diaryTags: $("diaryTags"),
  diaryTagSuggestions: $("diaryTagSuggestions"),
  diaryText: $("diaryText"),
  diaryPhoto: $("diaryPhoto"),
  diaryList: $("diaryList"),
  diaryError: $("diaryError"),

  diaryFilterForm: $("diaryFilterForm"),
  diaryFilterFrom: $("diaryFilterFrom"),
  diaryFilterTo: $("diaryFilterTo"),
  diaryFilterCategory: $("diaryFilterCategory"),
  diaryFilterKeyword: $("diaryFilterKeyword"),
  diaryFilterTag: $("diaryFilterTag"),

  chart: $("growthChart"),
  monthlyCountChart: $("monthlyCountChart"),
  categoryRatioChart: $("categoryRatioChart"),
  analysisCards: $("analysisCards"),
  reportMonth: $("reportMonth"),
  monthlyReport: $("monthlyReport"),

  exportJson: $("exportJson"),
  importJsonFile: $("importJsonFile"),
  importJsonText: $("importJsonText"),
  importJsonTextBtn: $("importJsonTextBtn"),
  settingsError: $("settingsError"),
  clearAll: $("clearAll"),
  largeTextToggle: $("largeTextToggle"),
  themeToggle: $("themeToggle"),

  growthTpl: $("growthItemTpl"),
  diaryTpl: $("diaryItemTpl"),

  onboardingModal: $("onboardingModal"),
  onboardingStepNow: $("onboardingStepNow"),
  onboardingPrev: $("onboardingPrev"),
  onboardingNext: $("onboardingNext"),
  onboardingClose: $("onboardingClose"),
  onboardingSteps: [$("onboardingStep1"), $("onboardingStep2"), $("onboardingStep3")],
};

let onboardingStepIndex = 0;
let saveStatusTimer = null;

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toTags(input) {
  if (!input) return [];
  const arr = String(input)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.slice(0, 20).toLowerCase());
  return [...new Set(arr)].slice(0, 8);
}

function normalizeCategory(value, fallback = "other") {
  return CATEGORY_LABELS[value] ? value : fallback;
}

function normalizeCondition(value) {
  return CONDITION_LABELS[value] ? value : "normal";
}

function getGrowthConditionValue() {
  const selected = document.querySelector('input[name="growthCondition"]:checked');
  return normalizeCondition(selected?.value);
}

function setGrowthConditionValue(value = "normal") {
  const v = normalizeCondition(value);
  const target = document.querySelector(`input[name="growthCondition"][value="${v}"]`);
  if (target) target.checked = true;
}

function setAppError(msg = "") {
  if (!msg) {
    els.appError.textContent = "";
    els.appError.classList.remove("show");
    return;
  }
  els.appError.textContent = msg;
  els.appError.classList.add("show");
}

function setSaveStatus(status, text) {
  if (!els.saveStatus) return;
  els.saveStatus.className = `save-status ${status}`;
  els.saveStatus.textContent = text;
}

function queueIdleStatus() {
  clearTimeout(saveStatusTimer);
  saveStatusTimer = setTimeout(() => setSaveStatus("idle", "保存準備完了"), 1300);
}

function snapshot() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: state.profile,
    growthRecords: state.growthRecords,
    diaries: state.diaries,
    ui: state.ui,
  };
}

function save() {
  setSaveStatus("saving", "保存中...");
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
    setAppError("");
    setSaveStatus("success", "保存済み");
    queueIdleStatus();
    return true;
  } catch (e) {
    console.error("保存失敗", e);
    setAppError("保存に失敗しました。画像サイズやブラウザ容量を確認してください。");
    setSaveStatus("error", "保存エラー");
    return false;
  }
}

function migrateGrowthRecord(rec) {
  return {
    id: rec.id || uid(),
    date: rec.date || "",
    height: Number(rec.height),
    weight: Number(rec.weight),
    memo: rec.memo || "",
    category: normalizeCategory(rec.category, "health"),
    condition: normalizeCondition(rec.condition),
    tags: Array.isArray(rec.tags) ? toTags(rec.tags.join(",")) : [],
  };
}

function migrateDiary(diary) {
  return {
    id: diary.id || uid(),
    date: diary.date || "",
    title: diary.title || "",
    text: diary.text || "",
    photoDataUrl: diary.photoDataUrl || "",
    category: normalizeCategory(diary.category, "event"),
    tags: Array.isArray(diary.tags) ? toTags(diary.tags.join(",")) : [],
  };
}

function applyData(parsed) {
  state.schemaVersion = Number.isInteger(parsed.schemaVersion) ? parsed.schemaVersion : SCHEMA_VERSION;
  state.profile = parsed.profile || null;
  state.growthRecords = Array.isArray(parsed.growthRecords) ? parsed.growthRecords.map(migrateGrowthRecord) : [];
  state.diaries = Array.isArray(parsed.diaries) ? parsed.diaries.map(migrateDiary) : [];
  const ui = parsed.ui || {};
  state.ui = {
    continuousGrowthInput: Boolean(ui.continuousGrowthInput),
    largeText: Boolean(ui.largeText),
    theme: ui.theme === "dark" ? "dark" : "light",
  };
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    applyData(JSON.parse(raw));
  } catch (e) {
    console.warn("データ読込失敗", e);
    setAppError("保存データの読み込みに失敗しました。設定からJSONインポートで復旧できます。");
    setSaveStatus("error", "保存データ読込エラー");
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ja-JP");
}

function calcAge(birthDate) {
  const b = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${Math.max(years, 0)}歳 ${Math.max(months, 0)}か月`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setError(el, msg = "") {
  el.textContent = msg;
}

function isFutureDate(dateStr) {
  const today = new Date();
  const d = new Date(dateStr);
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d > today;
}

function switchTab(tabName) {
  els.tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
    btn.setAttribute("tabindex", active ? "0" : "-1");
  });
  els.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tabName}`));
  if (els.srAnnouncer) els.srAnnouncer.textContent = `${tabName}タブを表示`;
}

function renderProfile() {
  const p = state.profile;
  if (!p) {
    els.profileView.innerHTML = `
      <div class="empty-guide">
        <strong>まだプロフィールが未登録です。</strong>
        <ul>
          <li>名前と生年月日を入力して保存</li>
          <li>登録後は現在の年齢が自動表示されます</li>
        </ul>
      </div>
    `;
    return;
  }
  els.profileView.innerHTML = `
    <strong>${escapeHtml(p.name)}</strong><br>
    生年月日: ${formatDate(p.birthDate)}（${calcAge(p.birthDate)}）<br>
    メモ: ${escapeHtml(p.note || "なし")}
  `;
}

function chipsHtml(category, tags = []) {
  const tagHtml = tags.map((tag) => `<span class="chip">#${escapeHtml(tag)}</span>`).join("");
  return `<span class="chip category-chip">${escapeHtml(CATEGORY_LABELS[category] || "その他")}</span>${tagHtml}`;
}

function inDateRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function filterGrowthRecords(records) {
  const f = state.filters.growth;
  return records.filter((r) => {
    if (!inDateRange(r.date, f.from, f.to)) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.tag && !r.tags.some((t) => t.includes(f.tag.toLowerCase()))) return false;
    if (f.keyword) {
      const hay = `${r.memo} ${r.tags.join(" ")} ${CATEGORY_LABELS[r.category] || ""}`.toLowerCase();
      if (!hay.includes(f.keyword.toLowerCase())) return false;
    }
    return true;
  });
}

function filterDiaries(diaries) {
  const f = state.filters.diary;
  return diaries.filter((d) => {
    if (!inDateRange(d.date, f.from, f.to)) return false;
    if (f.category && d.category !== f.category) return false;
    if (f.tag && !d.tags.some((t) => t.includes(f.tag.toLowerCase()))) return false;
    if (f.keyword) {
      const hay = `${d.title} ${d.text} ${d.tags.join(" ")} ${CATEGORY_LABELS[d.category] || ""}`.toLowerCase();
      if (!hay.includes(f.keyword.toLowerCase())) return false;
    }
    return true;
  });
}

function renderGrowthList() {
  els.growthList.innerHTML = "";
  const sorted = filterGrowthRecords([...state.growthRecords]).sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    els.growthList.innerHTML = `<div class="empty-guide"><strong>条件に一致する記録がありません。</strong></div>`;
    return;
  }
  for (const rec of sorted) {
    const node = els.growthTpl.content.firstElementChild.cloneNode(true);
    node.querySelector(".date").textContent = formatDate(rec.date);
    const cond = CONDITION_LABELS[rec.condition] || CONDITION_LABELS.normal;
    node.querySelector(".meta").textContent = `身長 ${rec.height} cm / 体重 ${rec.weight} kg / 体調 ${cond}${rec.memo ? ` / ${rec.memo}` : ""}`;
    node.querySelector(".chips").innerHTML = chipsHtml(rec.category, rec.tags);
    node.querySelector(".delete-growth").addEventListener("click", () => {
      if (!confirm("この記録を削除しますか？")) return;
      state.growthRecords = state.growthRecords.filter((r) => r.id !== rec.id);
      save();
      renderAll();
    });
    els.growthList.appendChild(node);
  }
}

function renderDiaryList() {
  els.diaryList.innerHTML = "";
  const sorted = filterDiaries([...state.diaries]).sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    els.diaryList.innerHTML = `<div class="empty-guide"><strong>条件に一致する日記がありません。</strong></div>`;
    return;
  }
  for (const diary of sorted) {
    const node = els.diaryTpl.content.firstElementChild.cloneNode(true);
    node.querySelector(".date").textContent = formatDate(diary.date);
    node.querySelector(".title").textContent = diary.title;
    node.querySelector(".text").textContent = diary.text;
    node.querySelector(".chips").innerHTML = chipsHtml(diary.category, diary.tags);
    const img = node.querySelector(".photo");
    if (diary.photoDataUrl) {
      img.src = diary.photoDataUrl;
      img.style.display = "block";
    } else {
      img.style.display = "none";
    }
    node.querySelector(".delete-diary").addEventListener("click", () => {
      if (!confirm("この日記を削除しますか？")) return;
      state.diaries = state.diaries.filter((d) => d.id !== diary.id);
      save();
      renderAll();
    });
    els.diaryList.appendChild(node);
  }
}

function movingAverage(values, window = 3) {
  return values.map((_, i) => {
    const start = Math.max(0, i - (window - 1));
    const subset = values.slice(start, i + 1).filter(Number.isFinite);
    if (!subset.length) return null;
    return subset.reduce((s, v) => s + v, 0) / subset.length;
  });
}

function drawChart() {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const css = getComputedStyle(document.body);
  const mutedColor = css.getPropertyValue("--muted").trim() || "#6b7280";
  const borderColor = css.getPropertyValue("--border").trim() || "#e5e7eb";

  const data = [...state.growthRecords].sort((a, b) => a.date.localeCompare(b.date));
  if (!data.length) {
    ctx.fillStyle = mutedColor;
    ctx.font = "16px sans-serif";
    ctx.fillText("記録が追加されるとグラフが表示されます", 20, 40);
    return;
  }

  const pad = { left: 52, right: 20, top: 20, bottom: 38 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const heights = data.map((d) => Number(d.height));
  const weights = data.map((d) => Number(d.weight));
  const hAvg = movingAverage(heights, 3);
  const wAvg = movingAverage(weights, 3);
  const allVals = [...heights, ...weights].filter(Number.isFinite);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = Math.max(maxV - minV, 1);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    const val = (maxV - (range * i) / 4).toFixed(1);
    ctx.fillStyle = mutedColor;
    ctx.font = "12px sans-serif";
    ctx.fillText(val, 6, y + 4);
  }

  const xFor = (idx) => pad.left + (data.length === 1 ? plotW / 2 : (plotW * idx) / (data.length - 1));
  const yFor = (val) => pad.top + ((maxV - val) / range) * plotH;

  function drawSeries(values, color, dashed = false, points = true) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [6, 4] : []);
    ctx.beginPath();
    values.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      const x = xFor(i);
      const y = yFor(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (values.length >= 2) ctx.stroke();
    ctx.setLineDash([]);

    if (!points) return;
    values.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      const x = xFor(i);
      const y = yFor(v);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawSeries(heights, "#4f46e5", false, true);
  drawSeries(hAvg, "#4f46e5", true, false);
  drawSeries(weights, "#059669", false, true);
  drawSeries(wAvg, "#059669", true, false);

  ctx.fillStyle = mutedColor;
  ctx.font = "11px sans-serif";
  data.forEach((d, i) => {
    const x = xFor(i);
    ctx.fillText(d.date.slice(5), x - 16, h - 14);
  });
}

function drawMonthlyCountChart() {
  const canvas = els.monthlyCountChart;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const css = getComputedStyle(document.body);
  const mutedColor = css.getPropertyValue("--muted").trim() || "#6b7280";
  const borderColor = css.getPropertyValue("--border").trim() || "#e5e7eb";

  const monthMap = new Map();
  state.growthRecords.forEach((r) => {
    const key = r.date.slice(0, 7);
    if (!key) return;
    monthMap.set(key, (monthMap.get(key) || 0) + 1);
  });
  const items = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  if (!items.length) {
    ctx.fillStyle = mutedColor;
    ctx.font = "14px sans-serif";
    ctx.fillText("記録が追加されると表示されます", 14, 28);
    return;
  }

  const max = Math.max(...items.map(([, c]) => c), 1);
  const pad = { left: 28, right: 8, top: 12, bottom: 30 };
  const barW = (w - pad.left - pad.right) / items.length - 8;
  items.forEach(([month, count], i) => {
    const x = pad.left + i * (barW + 8);
    const bh = ((h - pad.top - pad.bottom) * count) / max;
    const y = h - pad.bottom - bh;
    ctx.fillStyle = "#6366f1";
    ctx.fillRect(x, y, barW, bh);
    ctx.fillStyle = mutedColor;
    ctx.font = "11px sans-serif";
    ctx.fillText(String(count), x + 4, y - 4);
    ctx.fillText(month.slice(5), x + 2, h - 10);
  });
  ctx.strokeStyle = borderColor;
  ctx.strokeRect(pad.left - 2, pad.top - 2, w - pad.left - pad.right + 4, h - pad.top - pad.bottom + 4);
}

function drawCategoryRatioChart() {
  const canvas = els.categoryRatioChart;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const css = getComputedStyle(document.body);
  const mutedColor = css.getPropertyValue("--muted").trim() || "#6b7280";
  const cats = {};
  state.growthRecords.forEach((r) => {
    cats[r.category] = (cats[r.category] || 0) + 1;
  });
  const entries = Object.entries(cats);
  if (!entries.length) {
    ctx.fillStyle = mutedColor;
    ctx.font = "14px sans-serif";
    ctx.fillText("カテゴリ記録があると表示されます", 14, 28);
    return;
  }

  const colors = ["#4f46e5", "#059669", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6"];
  const total = entries.reduce((s, [, c]) => s + c, 0);
  const cx = 90;
  const cy = h / 2;
  const r = 62;
  let start = -Math.PI / 2;
  entries.forEach(([cat, count], i) => {
    const angle = (count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    start += angle;
  });

  entries.forEach(([cat, count], i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(180, 24 + i * 28, 12, 12);
    ctx.fillStyle = mutedColor;
    const pct = ((count / total) * 100).toFixed(0);
    ctx.fillText(`${CATEGORY_LABELS[cat] || cat} ${pct}%`, 198, 34 + i * 28);
  });
}

function renderAnalysisCards() {
  if (!els.analysisCards) return;
  const data = [...state.growthRecords].sort((a, b) => a.date.localeCompare(b.date));
  if (!data.length) {
    els.analysisCards.innerHTML = "<p class='muted'>記録を追加すると分析が表示されます。</p>";
    return;
  }

  const latest = data[data.length - 1];
  const first = data[0];
  const diffHeight = (latest.height - first.height).toFixed(1);
  const diffWeight = (latest.weight - first.weight).toFixed(1);

  const avgDh = data.length > 1 ? ((latest.height - first.height) / (data.length - 1)).toFixed(2) : "0.00";
  const avgDw = data.length > 1 ? ((latest.weight - first.weight) / (data.length - 1)).toFixed(2) : "0.00";

  const recent = data.slice(-3);
  const trendH = recent.length >= 2 ? recent[recent.length - 1].height - recent[0].height : 0;
  const trendW = recent.length >= 2 ? recent[recent.length - 1].weight - recent[0].weight : 0;
  const trendText = `${trendH >= 0 ? "↗" : "↘"} 身長 ${trendH.toFixed(1)}cm / ${trendW >= 0 ? "↗" : "↘"} 体重 ${trendW.toFixed(1)}kg`;

  const month = els.reportMonth.value;
  let monthDiff = "データ不足";
  if (month) {
    const monthRows = data.filter((r) => r.date.startsWith(month));
    if (monthRows.length >= 2) {
      const mDiffH = (monthRows[monthRows.length - 1].height - monthRows[0].height).toFixed(1);
      const mDiffW = (monthRows[monthRows.length - 1].weight - monthRows[0].weight).toFixed(1);
      monthDiff = `身長 ${mDiffH >= 0 ? "+" : ""}${mDiffH}cm / 体重 ${mDiffW >= 0 ? "+" : ""}${mDiffW}kg`;
    }
  }

  els.analysisCards.innerHTML = `
    <article class="analysis-card"><div class="label">月次増減</div><div class="value">${monthDiff}</div></article>
    <article class="analysis-card"><div class="label">平均変化（1記録あたり）</div><div class="value">身長 ${avgDh}cm / 体重 ${avgDw}kg</div></article>
    <article class="analysis-card"><div class="label">直近トレンド（最新3件）</div><div class="value">${trendText}</div></article>
    <article class="analysis-card"><div class="label">累積増減（初回→最新）</div><div class="value">身長 ${diffHeight}cm / 体重 ${diffWeight}kg</div></article>
  `;
}

function renderMonthlyReport() {
  const month = els.reportMonth.value;
  if (!month) {
    els.monthlyReport.innerHTML = "<p class='muted'>対象月を選ぶと自動集計されます。</p>";
    return;
  }
  const [y, m] = month.split("-");
  const prefix = `${y}-${m}`;

  const growth = state.growthRecords.filter((r) => r.date.startsWith(prefix));
  const diaries = state.diaries.filter((d) => d.date.startsWith(prefix));

  const avgHeight = growth.length
    ? (growth.reduce((sum, r) => sum + Number(r.height || 0), 0) / growth.length).toFixed(1)
    : "-";
  const avgWeight = growth.length
    ? (growth.reduce((sum, r) => sum + Number(r.weight || 0), 0) / growth.length).toFixed(1)
    : "-";

  const highlights = [...growth.map((r) => ({ date: r.date, text: `成長: ${r.memo || "記録追加"}` })), ...diaries.map((d) => ({ date: d.date, text: `日記: ${d.title}` }))]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  els.monthlyReport.innerHTML = `
    <div class="report-grid">
      <p><strong>成長記録件数:</strong> ${growth.length}件</p>
      <p><strong>日記件数:</strong> ${diaries.length}件</p>
      <p><strong>平均身長:</strong> ${avgHeight === "-" ? "-" : `${avgHeight} cm`}</p>
      <p><strong>平均体重:</strong> ${avgWeight === "-" ? "-" : `${avgWeight} kg`}</p>
    </div>
    <div>
      <strong>最近のハイライト</strong>
      ${
        highlights.length
          ? `<ul>${highlights.map((h) => `<li>${formatDate(h.date)} - ${escapeHtml(h.text)}</li>`).join("")}</ul>`
          : "<p class='muted'>この月のハイライトはまだありません。</p>"
      }
    </div>
  `;
}

function applyTheme() {
  const theme = state.ui.theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = theme;
  if (els.themeToggle) els.themeToggle.checked = theme === "dark";
}

function renderAll() {
  renderProfile();
  renderGrowthList();
  renderDiaryList();
  drawChart();
  drawMonthlyCountChart();
  drawCategoryRatioChart();
  renderAnalysisCards();
  renderMonthlyReport();
  els.continuousGrowthMode.checked = state.ui.continuousGrowthInput;
  if (els.largeTextToggle) els.largeTextToggle.checked = state.ui.largeText;
  document.body.classList.toggle("large-text", state.ui.largeText);
  applyTheme();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function validateProfile() {
  const name = els.childName.value.trim();
  const birthDate = els.birthDate.value;
  if (!name) return "名前は必須です。";
  if (!birthDate) return "生年月日は必須です。";
  if (isFutureDate(birthDate)) return "生年月日に未来日は指定できません。";
  return "";
}

function validateGrowth() {
  const date = els.recordDate.value;
  const h = Number(els.height.value);
  const w = Number(els.weight.value);
  if (!date) return "日付は必須です。";
  if (isFutureDate(date)) return "未来日の記録はできません。";
  if (!Number.isFinite(h) || h < 30 || h > 220) return "身長は30〜220cmで入力してください。";
  if (!Number.isFinite(w) || w < 1 || w > 120) return "体重は1〜120kgで入力してください。";
  return "";
}

function validateDiary(file) {
  const date = els.diaryDate.value;
  const title = els.diaryTitle.value.trim();
  const text = els.diaryText.value.trim();
  if (!date) return "日付は必須です。";
  if (isFutureDate(date)) return "未来日の記録はできません。";
  if (!title) return "タイトルは必須です。";
  if (!text) return "内容は必須です。";
  if (file) {
    const validType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!validType) return "画像形式は JPG / PNG / WEBP のみ対応です。";
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `画像サイズは ${MAX_IMAGE_MB}MB 以下にしてください。`;
  }
  return "";
}

function validateImportObject(parsed) {
  if (!parsed || typeof parsed !== "object") throw new Error("JSONがオブジェクトではありません。");

  const hasLegacyShape = parsed.profile !== undefined || parsed.growthRecords !== undefined || parsed.diaries !== undefined;
  if (!hasLegacyShape) throw new Error("必要なデータ項目が見つかりません。");

  if (parsed.schemaVersion !== undefined && !Number.isInteger(parsed.schemaVersion)) {
    throw new Error("schemaVersion が不正です。");
  }
  if (parsed.growthRecords !== undefined && !Array.isArray(parsed.growthRecords)) {
    throw new Error("growthRecords は配列である必要があります。");
  }
  if (parsed.diaries !== undefined && !Array.isArray(parsed.diaries)) {
    throw new Error("diaries は配列である必要があります。");
  }
}

function exportJson() {
  try {
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `sukusuku-note-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setError(els.settingsError, "");
  } catch (e) {
    console.error("エクスポート失敗", e);
    setError(els.settingsError, "エクスポートに失敗しました。");
  }
}

function importJsonString(jsonText) {
  try {
    const parsed = JSON.parse(jsonText);
    validateImportObject(parsed);
    applyData(parsed);
    if (!save()) throw new Error("保存に失敗しました。");
    renderAll();
    setError(els.settingsError, "インポートが完了しました。");
  } catch (e) {
    console.error("インポート失敗", e);
    setError(els.settingsError, `インポートに失敗しました: ${e.message}`);
  }
}

function renderOnboardingStep() {
  const step = onboardingStepIndex + 1;
  els.onboardingStepNow.textContent = String(step);
  els.onboardingSteps.forEach((el, idx) => el.classList.toggle("active", idx === onboardingStepIndex));
  els.onboardingPrev.disabled = onboardingStepIndex === 0;
  els.onboardingNext.style.display = onboardingStepIndex >= 2 ? "none" : "inline-block";
  els.onboardingClose.style.display = onboardingStepIndex >= 2 ? "inline-block" : "none";
}

function closeOnboarding() {
  localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
  els.onboardingModal.hidden = true;
  els.onboardingModal.style.display = "none";
}

function maybeShowOnboarding() {
  const seen = localStorage.getItem(ONBOARDING_SEEN_KEY) === "1";
  if (seen) {
    els.onboardingModal.hidden = true;
    els.onboardingModal.style.display = "none";
    return;
  }
  onboardingStepIndex = 0;
  renderOnboardingStep();
  els.onboardingModal.hidden = false;
  els.onboardingModal.style.display = "grid";
}

function setupFilterEvents() {
  const bindGrowth = () => {
    state.filters.growth = {
      from: els.growthFilterFrom.value,
      to: els.growthFilterTo.value,
      category: els.growthFilterCategory.value,
      keyword: els.growthFilterKeyword.value.trim(),
      tag: els.growthFilterTag.value.trim().toLowerCase(),
    };
    renderGrowthList();
  };
  [els.growthFilterFrom, els.growthFilterTo, els.growthFilterCategory, els.growthFilterKeyword, els.growthFilterTag].forEach((el) =>
    el.addEventListener("input", bindGrowth)
  );
  els.growthFilterForm.addEventListener("reset", () => {
    setTimeout(() => {
      state.filters.growth = { from: "", to: "", category: "", keyword: "", tag: "" };
      renderGrowthList();
    }, 0);
  });

  const bindDiary = () => {
    state.filters.diary = {
      from: els.diaryFilterFrom.value,
      to: els.diaryFilterTo.value,
      category: els.diaryFilterCategory.value,
      keyword: els.diaryFilterKeyword.value.trim(),
      tag: els.diaryFilterTag.value.trim().toLowerCase(),
    };
    renderDiaryList();
  };
  [els.diaryFilterFrom, els.diaryFilterTo, els.diaryFilterCategory, els.diaryFilterKeyword, els.diaryFilterTag].forEach((el) =>
    el.addEventListener("input", bindDiary)
  );
  els.diaryFilterForm.addEventListener("reset", () => {
    setTimeout(() => {
      state.filters.diary = { from: "", to: "", category: "", keyword: "", tag: "" };
      renderDiaryList();
    }, 0);
  });
}

function appendTag(inputEl, tag) {
  const current = toTags(inputEl.value);
  const merged = [...new Set([...current, tag.toLowerCase()])];
  inputEl.value = merged.join(",");
}

function setupTagSuggestions(container, inputEl, tags) {
  if (!container || !inputEl) return;
  container.innerHTML = tags.map((tag) => `<button type="button" class="tag-chip" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("");
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".tag-chip");
    if (!btn) return;
    appendTag(inputEl, btn.dataset.tag || "");
  });
}

function setupEvents() {
  els.tabButtons.forEach((btn, idx) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    btn.addEventListener("keydown", (e) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      let next = idx;
      if (e.key === "ArrowRight") next = (idx + 1) % els.tabButtons.length;
      if (e.key === "ArrowLeft") next = (idx - 1 + els.tabButtons.length) % els.tabButtons.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = els.tabButtons.length - 1;
      const nextBtn = els.tabButtons[next];
      switchTab(nextBtn.dataset.tab);
      nextBtn.focus();
    });
  });

  document.body.addEventListener("click", (e) => {
    const trigger = e.target.closest(".jump-tab");
    if (!trigger) return;
    const tab = trigger.dataset.goTab;
    if (tab) switchTab(tab);
  });

  els.profileForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = validateProfile();
    setError(els.profileError, err);
    if (err) return;

    state.profile = {
      name: els.childName.value.trim(),
      birthDate: els.birthDate.value,
      note: els.profileNote.value.trim(),
    };
    if (!save()) return;
    renderProfile();
  });

  els.growthForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = validateGrowth();
    setError(els.growthError, err);
    if (err) return;

    state.growthRecords.push({
      id: uid(),
      date: els.recordDate.value,
      category: normalizeCategory(els.growthCategory.value, "health"),
      condition: getGrowthConditionValue(),
      height: Number(els.height.value),
      weight: Number(els.weight.value),
      tags: toTags(els.growthTags.value),
      memo: els.growthMemo.value.trim(),
    });
    if (!save()) return;

    if (!state.ui.continuousGrowthInput) {
      els.growthForm.reset();
      els.recordDate.valueAsDate = new Date();
      els.continuousGrowthMode.checked = false;
      els.growthCategory.value = "health";
      setGrowthConditionValue("good");
    }

    renderAll();
  });

  els.continuousGrowthMode.addEventListener("change", () => {
    state.ui.continuousGrowthInput = els.continuousGrowthMode.checked;
    save();
  });

  if (els.largeTextToggle) {
    els.largeTextToggle.addEventListener("change", () => {
      state.ui.largeText = els.largeTextToggle.checked;
      document.body.classList.toggle("large-text", state.ui.largeText);
      save();
    });
  }

  if (els.themeToggle) {
    els.themeToggle.addEventListener("change", () => {
      state.ui.theme = els.themeToggle.checked ? "dark" : "light";
      applyTheme();
      save();
    });
  }

  els.diaryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = els.diaryPhoto.files[0];
    const err = validateDiary(file);
    setError(els.diaryError, err);
    if (err) return;

    try {
      const photoDataUrl = await fileToDataUrl(file);
      state.diaries.push({
        id: uid(),
        date: els.diaryDate.value,
        title: els.diaryTitle.value.trim(),
        category: normalizeCategory(els.diaryCategory.value, "event"),
        tags: toTags(els.diaryTags.value),
        text: els.diaryText.value.trim(),
        photoDataUrl,
      });
      if (!save()) return;
      els.diaryForm.reset();
      els.diaryDate.valueAsDate = new Date();
      els.diaryCategory.value = "event";
      renderAll();
    } catch (error) {
      console.error("画像読み込み失敗", error);
      setError(els.diaryError, "画像の読み込みに失敗しました。別の画像でお試しください。");
    }
  });

  els.clearAll.addEventListener("click", () => {
    const ok = confirm("全データ（プロフィール・成長記録・日記）を削除します。元に戻せません。よろしいですか？");
    if (!ok) return;

    state.profile = null;
    state.growthRecords = [];
    state.diaries = [];
    save();
    renderAll();
  });

  els.exportJson.addEventListener("click", exportJson);

  els.importJsonFile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importJsonString(text);
    } catch (error) {
      console.error("ファイル読み込み失敗", error);
      setError(els.settingsError, "JSONファイルを読み込めませんでした。");
    } finally {
      els.importJsonFile.value = "";
    }
  });

  els.importJsonTextBtn.addEventListener("click", () => {
    const jsonText = els.importJsonText.value.trim();
    if (!jsonText) {
      setError(els.settingsError, "インポートするJSONテキストを入力してください。");
      return;
    }
    importJsonString(jsonText);
  });

  if (els.reportMonth) {
    els.reportMonth.addEventListener("input", () => {
      renderMonthlyReport();
      renderAnalysisCards();
    });
  }

  setupTagSuggestions(els.growthTagSuggestions, els.growthTags, TAG_SUGGESTIONS.growth);
  setupTagSuggestions(els.diaryTagSuggestions, els.diaryTags, TAG_SUGGESTIONS.diary);

  els.onboardingPrev.addEventListener("click", () => {
    onboardingStepIndex = Math.max(0, onboardingStepIndex - 1);
    renderOnboardingStep();
  });

  els.onboardingNext.addEventListener("click", () => {
    onboardingStepIndex = Math.min(2, onboardingStepIndex + 1);
    renderOnboardingStep();
  });

  els.onboardingClose.addEventListener("click", closeOnboarding);

  setupFilterEvents();
}

function initDefaults() {
  const today = new Date();
  els.recordDate.valueAsDate = today;
  els.diaryDate.valueAsDate = today;
  if (els.growthCategory) els.growthCategory.value = "health";
  setGrowthConditionValue("good");
  if (els.diaryCategory) els.diaryCategory.value = "event";
  if (els.reportMonth) {
    els.reportMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  }
  setSaveStatus("idle", "保存準備完了");
}

load();
setupEvents();
initDefaults();
renderAll();
maybeShowOnboarding();
