/* =========================================================
   ЗАЛІЗО — щоденник силових тренувань
   Дані зберігаються локально на пристрої (localStorage)
   ========================================================= */

const STORE_KEYS = {
  programs: "zalizo:programs",
  sessions: "zalizo:sessions",
  active: "zalizo:activeSession",
};

const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  programs() { return this.get(STORE_KEYS.programs, []); },
  setPrograms(p) { this.set(STORE_KEYS.programs, p); },
  sessions() { return this.get(STORE_KEYS.sessions, []); },
  setSessions(s) { this.set(STORE_KEYS.sessions, s); },
  active() { return this.get(STORE_KEYS.active, null); },
  setActive(s) { this.set(STORE_KEYS.active, s); },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
}

function fmtDateLong(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/* ---------------- Router ---------------- */
let currentTab = "today";
const viewEl = document.getElementById("view");

function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  render();
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => setTab(btn.dataset.tab));
});

function render() {
  if (currentTab === "today") renderToday();
  else if (currentTab === "programs") renderPrograms();
  else if (currentTab === "history") renderHistory();
  window.scrollTo(0, 0);
}

/* =========================================================
   ВКЛАДКА «СЬОГОДНІ»
   ========================================================= */

function renderToday() {
  const active = Store.active();
  if (!active) {
    renderProgramPicker();
    return;
  }
  renderActiveSession(active);
}

function renderProgramPicker() {
  const programs = Store.programs();
  let html = "";

  if (programs.length === 0) {
    html += `
      <div class="empty">
        <div class="empty-title">Ще немає жодної програми</div>
        <p>Створи свою першу програму тренувань на вкладці «Програми», або почни довільне тренування без плану.</p>
      </div>
      <button class="btn" id="freeStartBtn">Почати довільне тренування</button>
    `;
  } else {
    html += `<div class="section-title">Обери програму</div>`;
    programs.forEach(p => {
      html += `
        <div class="card">
          <div class="exercise-head">
            <span class="exercise-name">${escapeHtml(p.name)}</span>
            <span class="exercise-rest">${p.exercises.length} вправ</span>
          </div>
          <button class="btn" data-start="${p.id}">Почати тренування</button>
        </div>
      `;
    });
    html += `<button class="btn ghost" id="freeStartBtn" style="margin-top:6px;">Довільне тренування без програми</button>`;
  }

  viewEl.innerHTML = html;

  viewEl.querySelectorAll("[data-start]").forEach(btn => {
    btn.addEventListener("click", () => startSession(btn.dataset.start));
  });
  const freeBtn = document.getElementById("freeStartBtn");
  if (freeBtn) freeBtn.addEventListener("click", () => startSession(null));
}

function startSession(programId) {
  const programs = Store.programs();
  const program = programs.find(p => p.id === programId);

  const session = {
    id: uid(),
    programId: programId || null,
    programName: program ? program.name : "Довільне тренування",
    date: new Date().toISOString(),
    exercises: program
      ? program.exercises.map(ex => ({
          name: ex.name,
          restSec: ex.restSec || 90,
          sets: ex.sets.map(s => ({ reps: s.reps, weight: s.weight, done: false })),
        }))
      : [],
  };
  Store.setActive(session);
  render();
}

function renderActiveSession(session) {
  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;

  const plateOn = pct > 0;
  let html = `
    <div class="barbell">
      <div class="barbell-plate ${plateOn ? "filled" : ""}"></div>
      <div class="barbell-bar"><div class="barbell-bar-fill" style="width:${pct}%"></div></div>
      <div class="barbell-plate ${pct === 100 ? "filled" : ""}"></div>
    </div>
    <div class="barbell-label">${doneSets} / ${totalSets} підходів · ${session.programName}</div>
  `;

  session.exercises.forEach((ex, exi) => {
    html += `
      <div class="card exercise-card" data-exi="${exi}">
        <div class="exercise-head">
          <span class="exercise-name">${escapeHtml(ex.name)}</span>
          <span class="exercise-rest">відпочинок ${ex.restSec}с</span>
        </div>
    `;
    ex.sets.forEach((s, si) => {
      html += `
        <div class="set-row ${s.done ? "done" : ""}" data-exi="${exi}" data-si="${si}">
          <div class="set-idx">${si + 1}</div>
          <div class="unit-input">
            <input type="number" inputmode="decimal" class="weight-input" value="${s.weight ?? ""}" placeholder="0">
            <span>кг</span>
          </div>
          <div class="unit-input">
            <input type="number" inputmode="numeric" class="reps-input" value="${s.reps ?? ""}" placeholder="0">
            <span>повт</span>
          </div>
          <button class="set-check" data-toggle>${s.done ? "✓" : ""}</button>
        </div>
      `;
    });
    html += `
        <button class="btn secondary small" data-add-set="${exi}" style="margin-top:4px;">+ підхід</button>
      </div>
    `;
  });

  html += `
    <button class="btn secondary" id="addExerciseBtn" style="margin-bottom:14px;">+ Додати вправу</button>
    <button class="btn" id="finishSessionBtn">Завершити тренування</button>
    <button class="btn danger" id="cancelSessionBtn" style="margin-top:10px;">Скасувати тренування</button>
  `;

  viewEl.innerHTML = html;

  // bind inputs
  viewEl.querySelectorAll(".set-row").forEach(row => {
    const exi = +row.dataset.exi, si = +row.dataset.si;
    row.querySelector(".weight-input").addEventListener("input", (e) => {
      updateSetField(exi, si, "weight", e.target.value === "" ? null : parseFloat(e.target.value));
    });
    row.querySelector(".reps-input").addEventListener("input", (e) => {
      updateSetField(exi, si, "reps", e.target.value === "" ? null : parseInt(e.target.value, 10));
    });
    row.querySelector("[data-toggle]").addEventListener("click", () => toggleSet(exi, si));
  });

  viewEl.querySelectorAll("[data-add-set]").forEach(btn => {
    btn.addEventListener("click", () => addSetToActive(+btn.dataset.addSet));
  });

  const addExBtn = document.getElementById("addExerciseBtn");
  if (addExBtn) addExBtn.addEventListener("click", openAddExerciseToSessionModal);

  document.getElementById("finishSessionBtn").addEventListener("click", finishSession);
  document.getElementById("cancelSessionBtn").addEventListener("click", cancelSession);
}

function updateSetField(exi, si, field, value) {
  const session = Store.active();
  session.exercises[exi].sets[si][field] = value;
  Store.setActive(session);
}

function addSetToActive(exi) {
  const session = Store.active();
  const sets = session.exercises[exi].sets;
  const last = sets[sets.length - 1];
  sets.push({ reps: last ? last.reps : null, weight: last ? last.weight : null, done: false });
  Store.setActive(session);
  render();
}

function toggleSet(exi, si) {
  const session = Store.active();
  const set = session.exercises[exi].sets[si];
  set.done = !set.done;
  Store.setActive(session);
  render();
  if (set.done) {
    startRestTimer(session.exercises[exi].restSec || 90);
  }
}

function openAddExerciseToSessionModal() {
  openModal(`
    <h2>Додати вправу</h2>
    <div class="field"><label>Назва вправи</label><input type="text" id="mExName" placeholder="напр. Жим лежачи"></div>
    <div class="row">
      <div class="field"><label>Підходів</label><input type="number" id="mExSets" value="3"></div>
      <div class="field"><label>Повторень</label><input type="number" id="mExReps" value="10"></div>
      <div class="field"><label>Вага, кг</label><input type="number" id="mExWeight" value="0"></div>
    </div>
    <div class="field"><label>Відпочинок, сек</label><input type="number" id="mExRest" value="90"></div>
    <button class="btn" id="mExSave">Додати</button>
  `);
  document.getElementById("mExSave").addEventListener("click", () => {
    const name = document.getElementById("mExName").value.trim();
    if (!name) { toast("Введи назву вправи"); return; }
    const setsCount = parseInt(document.getElementById("mExSets").value, 10) || 1;
    const reps = parseInt(document.getElementById("mExReps").value, 10) || null;
    const weight = parseFloat(document.getElementById("mExWeight").value) || null;
    const rest = parseInt(document.getElementById("mExRest").value, 10) || 90;

    const session = Store.active();
    session.exercises.push({
      name, restSec: rest,
      sets: Array.from({ length: setsCount }, () => ({ reps, weight, done: false })),
    });
    Store.setActive(session);
    closeModal();
    render();
  });
}

function finishSession() {
  const session = Store.active();
  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  if (doneSets === 0) {
    toast("Відміть хоч один підхід перед завершенням");
    return;
  }
  const sessions = Store.sessions();
  sessions.unshift(session);
  Store.setSessions(sessions);
  Store.setActive(null);
  toast(`Тренування збережено · ${doneSets}/${totalSets} підходів`);
  render();
}

function cancelSession() {
  confirmDialog("Скасувати тренування?", "Прогрес цього тренування не буде збережено.", () => {
    Store.setActive(null);
    render();
  });
}

/* ---------------- Rest timer ---------------- */
let restInterval = null;

function startRestTimer(seconds) {
  const overlay = document.createElement("div");
  overlay.className = "rest-overlay";
  overlay.id = "restOverlay";
  overlay.innerHTML = `
    <div class="rest-label">Відпочинок</div>
    <div class="rest-time" id="restTime">${formatTime(seconds)}</div>
    <div class="rest-actions">
      <button class="btn secondary small" id="restMinus15">−15с</button>
      <button class="btn secondary small" id="restPlus15">+15с</button>
      <button class="btn small" id="restSkip">Пропустити</button>
    </div>
  `;
  document.body.appendChild(overlay);

  let remaining = seconds;
  const timeEl = () => document.getElementById("restTime");

  clearInterval(restInterval);
  restInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(restInterval);
      endRestTimer(true);
      return;
    }
    if (timeEl()) timeEl().textContent = formatTime(remaining);
  }, 1000);

  document.getElementById("restMinus15").addEventListener("click", () => {
    remaining = Math.max(0, remaining - 15);
    if (timeEl()) timeEl().textContent = formatTime(remaining);
  });
  document.getElementById("restPlus15").addEventListener("click", () => {
    remaining += 15;
    if (timeEl()) timeEl().textContent = formatTime(remaining);
  });
  document.getElementById("restSkip").addEventListener("click", () => {
    clearInterval(restInterval);
    endRestTimer(false);
  });
}

function endRestTimer(finished) {
  const overlay = document.getElementById("restOverlay");
  if (overlay) overlay.remove();
  if (finished) {
    if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
    beep();
    toast("Час вийшов — наступний підхід!");
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.5);
  } catch (e) { /* audio not available */ }
}

/* =========================================================
   ВКЛАДКА «ПРОГРАМИ»
   ========================================================= */

function renderPrograms() {
  const programs = Store.programs();
  let html = `<div class="section-title">Мої програми</div>`;

  if (programs.length === 0) {
    html += `
      <div class="empty">
        <div class="empty-title">Немає жодної програми</div>
        <p>Створи програму зі списком вправ, підходів і повторень — і швидко стартуй тренування з неї.</p>
      </div>
    `;
  } else {
    programs.forEach(p => {
      html += `
        <div class="card">
          <div class="exercise-head">
            <span class="exercise-name">${escapeHtml(p.name)}</span>
          </div>
          <div class="exercise-rest" style="margin-bottom:12px;">${p.exercises.map(e => escapeHtml(e.name)).join(" · ") || "Без вправ"}</div>
          <div class="row">
            <button class="btn secondary small" data-edit="${p.id}">Редагувати</button>
            <button class="btn danger small" data-del="${p.id}">Видалити</button>
          </div>
        </div>
      `;
    });
  }

  html += `<button class="btn" id="newProgramBtn" style="margin-top:6px;">+ Нова програма</button>`;
  viewEl.innerHTML = html;

  viewEl.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openProgramEditor(btn.dataset.edit)));
  viewEl.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", () => {
      confirmDialog("Видалити програму?", "Цю дію не можна скасувати.", () => {
        Store.setPrograms(Store.programs().filter(p => p.id !== btn.dataset.del));
        renderPrograms();
      });
    }));
  document.getElementById("newProgramBtn").addEventListener("click", () => openProgramEditor(null));
}

function openProgramEditor(programId) {
  const programs = Store.programs();
  let program = programId ? programs.find(p => p.id === programId) : null;
  // work on a deep copy
  const draft = program
    ? JSON.parse(JSON.stringify(program))
    : { id: uid(), name: "", exercises: [] };

  function renderEditor() {
    let html = `
      <h2>${program ? "Редагувати програму" : "Нова програма"}</h2>
      <div class="field"><label>Назва програми</label><input type="text" id="progName" value="${escapeAttr(draft.name)}" placeholder="напр. День ніг"></div>
      <div class="section-title" style="margin-top:6px;">Вправи</div>
      <div id="exList"></div>
      <button class="btn secondary" id="addExDraft" style="margin:10px 0 16px;">+ Додати вправу</button>
      <button class="btn" id="saveProgram">Зберегти програму</button>
    `;
    modalBody.innerHTML = html;

    const exList = document.getElementById("exList");
    if (draft.exercises.length === 0) {
      exList.innerHTML = `<p style="color:var(--text-dim);font-size:13px;">Ще немає вправ. Додай першу нижче.</p>`;
    }
    draft.exercises.forEach((ex, i) => {
      const div = document.createElement("div");
      div.className = "ex-editor";
      div.innerHTML = `
        <div class="ex-editor-head">
          <input type="text" value="${escapeAttr(ex.name)}" data-field="name" data-i="${i}" placeholder="Назва вправи">
          <button class="icon-btn" data-remove-ex="${i}">✕</button>
        </div>
        <div class="row">
          <div class="field"><label>Підходів</label><input type="number" data-field="setsCount" data-i="${i}" value="${ex.sets.length}"></div>
          <div class="field"><label>Повторень</label><input type="number" data-field="reps" data-i="${i}" value="${ex.sets[0]?.reps ?? 10}"></div>
        </div>
        <div class="row">
          <div class="field"><label>Стартова вага, кг</label><input type="number" data-field="weight" data-i="${i}" value="${ex.sets[0]?.weight ?? 0}"></div>
          <div class="field"><label>Відпочинок, сек</label><input type="number" data-field="restSec" data-i="${i}" value="${ex.restSec}"></div>
        </div>
      `;
      exList.appendChild(div);
    });

    exList.querySelectorAll("[data-field]").forEach(input => {
      input.addEventListener("input", () => {
        const i = +input.dataset.i;
        const field = input.dataset.field;
        const ex = draft.exercises[i];
        if (field === "name") ex.name = input.value;
        else if (field === "restSec") ex.restSec = parseInt(input.value, 10) || 90;
        else if (field === "setsCount") {
          const n = Math.max(1, parseInt(input.value, 10) || 1);
          const reps = ex.sets[0]?.reps ?? 10;
          const weight = ex.sets[0]?.weight ?? 0;
          ex.sets = Array.from({ length: n }, () => ({ reps, weight }));
        } else if (field === "reps") {
          const v = parseInt(input.value, 10) || 0;
          ex.sets.forEach(s => s.reps = v);
        } else if (field === "weight") {
          const v = parseFloat(input.value) || 0;
          ex.sets.forEach(s => s.weight = v);
        }
      });
    });

    exList.querySelectorAll("[data-remove-ex]").forEach(btn => {
      btn.addEventListener("click", () => {
        draft.exercises.splice(+btn.dataset.removeEx, 1);
        renderEditor();
      });
    });

    document.getElementById("progName").addEventListener("input", (e) => {
      draft.name = e.target.value;
    });

    document.getElementById("addExDraft").addEventListener("click", () => {
      draft.exercises.push({ name: "", restSec: 90, sets: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }] });
      renderEditor();
    });

    document.getElementById("saveProgram").addEventListener("click", () => {
      if (!draft.name.trim()) { toast("Введи назву програми"); return; }
      draft.exercises = draft.exercises.filter(ex => ex.name.trim());
      const all = Store.programs();
      const idx = all.findIndex(p => p.id === draft.id);
      if (idx >= 0) all[idx] = draft; else all.push(draft);
      Store.setPrograms(all);
      closeModal();
      renderPrograms();
      toast("Програму збережено");
    });
  }

  const modalBody = openModal("");
  renderEditor();
}

/* =========================================================
   ВКЛАДКА «ІСТОРІЯ»
   ========================================================= */

function sessionVolume(session) {
  return session.exercises.reduce((a, ex) =>
    a + ex.sets.filter(s => s.done).reduce((b, s) => b + (s.weight || 0) * (s.reps || 0), 0), 0);
}

function renderHistory() {
  const sessions = Store.sessions();

  let html = `<div class="section-title">Прогрес</div>`;

  const exerciseNames = Array.from(new Set(
    sessions.flatMap(s => s.exercises.map(e => e.name))
  )).sort();

  if (exerciseNames.length === 0) {
    html += `<div class="chart-wrap"><p style="color:var(--text-dim);font-size:13px;margin:0;">Завершуй тренування, щоб бачити графік прогресу за вправами.</p></div>`;
  } else {
    html += `
      <div class="chart-wrap">
        <select id="progressExSelect">
          ${exerciseNames.map(n => `<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`).join("")}
        </select>
        <div id="chartHolder"></div>
      </div>
    `;
  }

  html += `
    <div class="section-title">Резервна копія</div>
    <div class="card">
      <p style="color:var(--text-dim);font-size:13px;margin:0 0 12px;">Прогрес зберігається лише в цьому браузері. Збережи копію у файл, щоб не втратити дані або перенести їх на інший телефон.</p>
      <div class="row">
        <button class="btn secondary small" id="exportBtn" style="flex:1;">⬇ Зберегти копію</button>
        <button class="btn secondary small" id="importBtn" style="flex:1;">⬆ Відновити з файлу</button>
      </div>
      <input type="file" id="importFile" accept="application/json" hidden>
    </div>
  `;

  html += `<div class="section-title">Тренування</div>`;

  if (sessions.length === 0) {
    html += `
      <div class="empty">
        <div class="empty-title">Історія порожня</div>
        <p>Твої завершені тренування з'являться тут.</p>
      </div>
    `;
  } else {
    sessions.forEach(s => {
      const vol = sessionVolume(s);
      html += `
        <div class="session-item" data-session="${s.id}">
          <div>
            <div class="session-item-date">${fmtDate(s.date)} · ${escapeHtml(s.programName)}</div>
            <div class="session-item-sub">${s.exercises.length} вправ</div>
          </div>
          <div class="session-item-vol">${Math.round(vol)} кг</div>
        </div>
      `;
    });
  }

  viewEl.innerHTML = html;

  const select = document.getElementById("progressExSelect");
  if (select) {
    select.addEventListener("change", () => drawProgressChart(select.value));
    drawProgressChart(select.value);
  }

  viewEl.querySelectorAll("[data-session]").forEach(item => {
    item.addEventListener("click", () => openSessionDetail(item.dataset.session));
  });

  document.getElementById("exportBtn").addEventListener("click", exportBackup);
  document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", handleImportFile);
}

/* ---------------- Резервна копія ---------------- */

function exportBackup() {
  const data = {
    app: "zalizo",
    version: 1,
    exportedAt: new Date().toISOString(),
    programs: Store.programs(),
    sessions: Store.sessions(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `zalizo-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Файл копії збережено");
}

function handleImportFile(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (err) {
      toast("Файл пошкоджений або не є копією Залізо");
      return;
    }
    if (!data || !Array.isArray(data.programs) || !Array.isArray(data.sessions)) {
      toast("Це не файл резервної копії Залізо");
      return;
    }
    confirmImportDialog(data);
  };
  reader.readAsText(file);
}

function confirmImportDialog(data) {
  openModal(`
    <h2>Відновити з файлу?</h2>
    <p style="color:var(--text-dim);font-size:14px;margin-top:-6px;">
      У файлі: ${data.programs.length} програм, ${data.sessions.length} тренувань${data.exportedAt ? " · від " + fmtDate(data.exportedAt) : ""}.
    </p>
    <div class="field">
      <label>Як відновити?</label>
    </div>
    <button class="btn secondary" id="mergeBtn" style="margin-bottom:10px;">Додати до поточних даних</button>
    <button class="btn danger" id="replaceBtn">Замінити всі поточні дані</button>
  `);
  document.getElementById("mergeBtn").addEventListener("click", () => {
    const programs = Store.programs();
    const sessions = Store.sessions();
    const existingProgramIds = new Set(programs.map(p => p.id));
    const existingSessionIds = new Set(sessions.map(s => s.id));
    data.programs.forEach(p => { if (!existingProgramIds.has(p.id)) programs.push(p); });
    data.sessions.forEach(s => { if (!existingSessionIds.has(s.id)) sessions.push(s); });
    sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
    Store.setPrograms(programs);
    Store.setSessions(sessions);
    closeModal();
    renderHistory();
    toast("Дані додано");
  });
  document.getElementById("replaceBtn").addEventListener("click", () => {
    Store.setPrograms(data.programs);
    Store.setSessions(data.sessions);
    closeModal();
    renderHistory();
    toast("Дані відновлено");
  });
}

function drawProgressChart(exerciseName) {
  const sessions = Store.sessions().slice().reverse(); // chronological
  const points = [];
  sessions.forEach(s => {
    const ex = s.exercises.find(e => e.name === exerciseName);
    if (!ex) return;
    const doneSets = ex.sets.filter(x => x.done && x.weight != null);
    if (doneSets.length === 0) return;
    const maxW = Math.max(...doneSets.map(x => x.weight));
    points.push({ date: s.date, value: maxW });
  });

  const holder = document.getElementById("chartHolder");
  if (!holder) return;

  if (points.length === 0) {
    holder.innerHTML = `<p style="color:var(--text-dim);font-size:13px;">Ще немає завершених підходів для цієї вправи.</p>`;
    return;
  }
  if (points.length === 1) {
    holder.innerHTML = `<p style="font-family:var(--font-display);font-size:28px;color:var(--gold);">${points[0].value} кг</p><p style="color:var(--text-dim);font-size:12px;">Потрібно щонайменше 2 тренування для графіка</p>`;
    return;
  }

  const W = 300, H = 140, pad = 24;
  const values = points.map(p => p.value);
  const minV = Math.min(...values), maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const stepX = (W - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = H - pad - ((p.value - minV) / range) * (H - pad * 2);
    return [x, y];
  });

  const pathD = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
  const areaD = pathD + ` L${coords[coords.length - 1][0].toFixed(1)},${H - pad} L${coords[0][0].toFixed(1)},${H - pad} Z`;

  const last = points[points.length - 1];
  const first = points[0];
  const diff = last.value - first.value;
  const diffLabel = diff === 0 ? "без змін" : (diff > 0 ? `+${diff} кг` : `${diff} кг`);
  const diffColor = diff > 0 ? "var(--good)" : (diff < 0 ? "var(--accent)" : "var(--text-dim)");

  holder.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
      <span style="font-family:var(--font-display);font-size:26px;color:var(--gold);">${last.value} кг</span>
      <span style="font-size:12.5px;color:${diffColor};">${diffLabel} за період</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;overflow:visible;">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#C74E31" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#C74E31" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#areaGrad)"/>
      <path d="${pathD}" fill="none" stroke="#C74E31" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${coords.map(c => `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="3.5" fill="#E8B23D"/>`).join("")}
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-top:4px;">
      <span>${fmtDate(points[0].date)}</span>
      <span>${fmtDate(points[points.length - 1].date)}</span>
    </div>
  `;
}

function openSessionDetail(sessionId) {
  const session = Store.sessions().find(s => s.id === sessionId);
  if (!session) return;
  let html = `<h2>${escapeHtml(session.programName)}</h2>
    <p style="color:var(--text-dim);font-size:13px;margin-top:-8px;">${fmtDateLong(session.date)}</p>`;

  session.exercises.forEach(ex => {
    const done = ex.sets.filter(s => s.done);
    if (done.length === 0) return;
    html += `<div class="ex-editor"><div style="font-family:var(--font-display);margin-bottom:8px;">${escapeHtml(ex.name)}</div>`;
    done.forEach((s, i) => {
      html += `<div style="font-size:13.5px;color:var(--text-dim);margin-bottom:3px;">Підхід ${i + 1}: <span style="color:var(--text);">${s.weight ?? "–"} кг × ${s.reps ?? "–"}</span></div>`;
    });
    html += `</div>`;
  });

  html += `<button class="btn danger" id="deleteSessionBtn" style="margin-top:10px;">Видалити тренування</button>`;

  openModal(html);
  document.getElementById("deleteSessionBtn").addEventListener("click", () => {
    confirmDialog("Видалити тренування?", "Цю дію не можна скасувати.", () => {
      Store.setSessions(Store.sessions().filter(s => s.id !== sessionId));
      closeModal();
      renderHistory();
    });
  });
}

/* =========================================================
   МОДАЛЬНІ ВІКНА
   ========================================================= */

let modalRoot = null;

function openModal(innerHtml) {
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "modalBackdrop";
  backdrop.innerHTML = `<div class="modal" id="modalBody">${innerHtml}</div>`;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.body.appendChild(backdrop);
  modalRoot = backdrop;
  return document.getElementById("modalBody");
}

function closeModal() {
  if (modalRoot) { modalRoot.remove(); modalRoot = null; }
}

function confirmDialog(title, msg, onConfirm) {
  openModal(`
    <h2>${title}</h2>
    <p style="color:var(--text-dim);font-size:14px;margin-top:-6px;">${msg}</p>
    <div class="row" style="margin-top:16px;">
      <button class="btn secondary" id="confirmNo">Скасувати</button>
      <button class="btn danger" id="confirmYes">Так, видалити</button>
    </div>
  `);
  document.getElementById("confirmNo").addEventListener("click", closeModal);
  document.getElementById("confirmYes").addEventListener("click", () => {
    closeModal();
    onConfirm();
  });
}

/* ---------------- Helpers ---------------- */
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}
function escapeAttr(str) { return escapeHtml(str); }

/* =========================================================
   PWA: встановлення та service worker
   ========================================================= */

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById("installBtn").hidden = false;
});

document.getElementById("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) {
    toast("Відкрий меню браузера → «Додати на головний екран»");
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById("installBtn").hidden = true;
});

window.addEventListener("appinstalled", () => {
  document.getElementById("installBtn").hidden = true;
  toast("Додаток встановлено");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ---------------- Init ---------------- */
setTab("today");
