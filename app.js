const STORAGE_KEY = "childGrowthMvpData";
const MAX_IMAGE_MB = 2;

const state = {
  profile: null,
  growthRecords: [],
  diaries: [],
};

const $ = (id) => document.getElementById(id);

const els = {
  profileForm: $("profileForm"),
  childName: $("childName"),
  birthDate: $("birthDate"),
  profileNote: $("profileNote"),
  profileView: $("profileView"),
  profileError: $("profileError"),

  growthForm: $("growthForm"),
  recordDate: $("recordDate"),
  height: $("height"),
  weight: $("weight"),
  growthMemo: $("growthMemo"),
  growthList: $("growthList"),
  growthError: $("growthError"),

  diaryForm: $("diaryForm"),
  diaryDate: $("diaryDate"),
  diaryTitle: $("diaryTitle"),
  diaryText: $("diaryText"),
  diaryPhoto: $("diaryPhoto"),
  diaryList: $("diaryList"),
  diaryError: $("diaryError"),

  chart: $("growthChart"),
  clearAll: $("clearAll"),

  growthTpl: $("growthItemTpl"),
  diaryTpl: $("diaryItemTpl"),
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.profile = parsed.profile || null;
    state.growthRecords = Array.isArray(parsed.growthRecords) ? parsed.growthRecords : [];
    state.diaries = Array.isArray(parsed.diaries) ? parsed.diaries : [];
  } catch (e) {
    console.warn("データ読込失敗", e);
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

function renderProfile() {
  const p = state.profile;
  if (!p) {
    els.profileView.innerHTML = `<p class="empty">未登録です。まずはプロフィールを保存してください。</p>`;
    return;
  }
  els.profileView.innerHTML = `
    <strong>${escapeHtml(p.name)}</strong><br>
    生年月日: ${formatDate(p.birthDate)}（${calcAge(p.birthDate)}）<br>
    メモ: ${escapeHtml(p.note || "なし")}
  `;
}

function renderGrowthList() {
  els.growthList.innerHTML = "";
  const sorted = [...state.growthRecords].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    els.growthList.innerHTML = `<p class="empty">記録がまだありません。最初の身長・体重を登録してみましょう。</p>`;
    return;
  }
  for (const rec of sorted) {
    const node = els.growthTpl.content.firstElementChild.cloneNode(true);
    node.querySelector(".date").textContent = formatDate(rec.date);
    node.querySelector(".meta").textContent = `身長 ${rec.height} cm / 体重 ${rec.weight} kg${rec.memo ? ` / ${rec.memo}` : ""}`;
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
  const sorted = [...state.diaries].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    els.diaryList.innerHTML = `<p class="empty">日記がまだありません。写真付きで今日の思い出を残してみましょう。</p>`;
    return;
  }
  for (const diary of sorted) {
    const node = els.diaryTpl.content.firstElementChild.cloneNode(true);
    node.querySelector(".date").textContent = formatDate(diary.date);
    node.querySelector(".title").textContent = diary.title;
    node.querySelector(".text").textContent = diary.text;
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

function drawChart() {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const data = [...state.growthRecords].sort((a, b) => a.date.localeCompare(b.date));
  if (!data.length) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "16px sans-serif";
    ctx.fillText("記録が追加されるとグラフが表示されます", 20, 40);
    return;
  }

  const pad = { left: 52, right: 20, top: 20, bottom: 38 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const heights = data.map((d) => Number(d.height));
  const weights = data.map((d) => Number(d.weight));
  const allVals = [...heights, ...weights].filter(Number.isFinite);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = Math.max(maxV - minV, 1);

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();

    const val = (maxV - (range * i) / 4).toFixed(1);
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px sans-serif";
    ctx.fillText(val, 6, y + 4);
  }

  const xFor = (idx) => pad.left + (data.length === 1 ? plotW / 2 : (plotW * idx) / (data.length - 1));
  const yFor = (val) => pad.top + ((maxV - val) / range) * plotH;

  function drawSeries(values, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = xFor(i);
      const y = yFor(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (values.length >= 2) ctx.stroke();

    values.forEach((v, i) => {
      const x = xFor(i);
      const y = yFor(v);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawSeries(heights, "#4f46e5");
  drawSeries(weights, "#059669");

  ctx.fillStyle = "#4f46e5";
  ctx.fillRect(w - 180, 10, 14, 4);
  ctx.fillStyle = "#111827";
  ctx.font = "12px sans-serif";
  ctx.fillText("身長", w - 160, 16);

  ctx.fillStyle = "#059669";
  ctx.fillRect(w - 100, 10, 14, 4);
  ctx.fillStyle = "#111827";
  ctx.fillText("体重", w - 80, 16);

  ctx.fillStyle = "#6b7280";
  ctx.font = "11px sans-serif";
  data.forEach((d, i) => {
    const x = xFor(i);
    const label = d.date.slice(5);
    ctx.fillText(label, x - 16, h - 14);
  });
}

function renderAll() {
  renderProfile();
  renderGrowthList();
  renderDiaryList();
  drawChart();
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

function setupEvents() {
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
    save();
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
      height: Number(els.height.value),
      weight: Number(els.weight.value),
      memo: els.growthMemo.value.trim(),
    });
    save();
    els.growthForm.reset();
    els.recordDate.valueAsDate = new Date();
    renderAll();
  });

  els.diaryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = els.diaryPhoto.files[0];
    const err = validateDiary(file);
    setError(els.diaryError, err);
    if (err) return;

    const photoDataUrl = await fileToDataUrl(file);

    state.diaries.push({
      id: uid(),
      date: els.diaryDate.value,
      title: els.diaryTitle.value.trim(),
      text: els.diaryText.value.trim(),
      photoDataUrl,
    });
    save();
    els.diaryForm.reset();
    els.diaryDate.valueAsDate = new Date();
    renderAll();
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
}

function initDefaults() {
  const today = new Date();
  els.recordDate.valueAsDate = today;
  els.diaryDate.valueAsDate = today;
}

load();
setupEvents();
initDefaults();
renderAll();
