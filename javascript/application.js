const LEVELS_PER_ROW = 4;
const TURN_LENGTH = 0;
const WORDS_PER_LEVEL = 10;

let HSK = [];
let revealIndex = 0;

async function loadHSK() {
  const res = await fetch("./data/result_shuffled.json");
  HSK = await res.json();
}


(function initPreviewSettings() {
  if (localStorage.getItem("usePolish") === null) {
    localStorage.setItem("usePolish", "false");
  }
})();

const app = document.getElementById("app");

function router() {
  const hash = location.hash;
  const srsBtn = document.getElementById("srs-btn");


  if (!hash || hash === "#") {
    renderPath();
    if (srsBtn) {
      srsBtn.style.display = "block";
    }
    return;
  }

  if (hash === "#/srs") {
    renderSrs();
    return;
  }

  const levelMatch = hash.match(/^#\/level\/(\d+)(?:\/(\d+))?/);

  if (levelMatch) {
    const level = parseInt(levelMatch[1], 10);
    const index = parseInt(levelMatch[2] || "0", 10);
    renderLevel(level, index);
    if (srsBtn) srsBtn.style.display = "none";
    return;
  }
}

window.addEventListener("hashchange", router);

function getProgress() {
  return JSON.parse(localStorage.getItem("progress") || "{}");
}

function saveProgress(progress) {
  localStorage.setItem("progress", JSON.stringify(progress));
}

function markLevelCompleted(level) {
  const progress = getProgress();
  progress.completedLevels ||= {};
  progress.completedLevels[level] = true;
  saveProgress(progress);
}

function isLevelCompleted(level) {
  const progress = getProgress();
  return !!progress.completedLevels?.[level];
}

function toggleRestore() {
  const panel = document.getElementById("restore-panel");
  panel.style.display =
    panel.style.display === "none" ? "block" : "none";
}

function restoreFromInput() {
  const level = parseInt(
    document.getElementById("restore-level").value,
    10
  );

  if (!level || level < 1) return;

  restoreProgressToLevel(level);
}

function restoreProgressToLevel(level) {
  const progress = getProgress();
  progress.completedLevels ||= {};

  for (let i = 1; i < level; i++) {
    progress.completedLevels[i] = true;
  }

  saveProgress(progress);
  location.hash = "#";
  window.location.reload();
}
function getHumanSrsLimit() {
  const limit = getSrsLimit();
  return limit == 9999999 ? 'All' : limit;
}

function getSrsLimit() {
  const progress = getProgress();
  return progress.settings?.srsLimit || 10;
}

function setSrsLimit(value) {
  const progress = getProgress();
  progress.settings ||= {};
  progress.settings.srsLimit = value == 'All' ? 9999999 : value;
  saveProgress(progress);
}
function toggleSrsSize() {
  const menu = document.getElementById("srs-size-menu");
  menu.style.display =
    menu.style.display === "none" ? "block" : "none";
}
function selectSrsSize(value) {
  setSrsLimit(value);

  document.getElementById("srs-size-btn").textContent = `${value}`;

  document.getElementById("srs-size-menu").style.display = "none";
}

function revealWordStep(usage, word, step) {
  if (!usage || !word) return usage;

  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const revealed =
    word.slice(0, step) + "*".repeat(Math.max(0, word.length - step));

  const regex = new RegExp(escaped, "gi");
  return usage.replace(regex, revealed);
}


function renderPath() {
  const maxId = Math.max(...HSK.map(c => c.id));
  const totalLevels = Math.ceil(maxId / WORDS_PER_LEVEL);

  const visibleLevels = [];
  for (let lvl = 1; lvl <= totalLevels; lvl++) {
    if (!isLevelEmpty(lvl)) {
      visibleLevels.push(lvl);
    }
  }

  app.innerHTML = `
    <div class="fixed-bottom">
      <button id='srs-btn' onclick='startSrsSession()'>SRS</button>
      <button class="stats-toggle" onclick="toggleSrsCalendar()">▦</button>
      <button class="dev-toggle" onclick="toggleRestore()">⚙︎</button>
      <button class="toggle-translations" onclick="toggleHomeTranslations()">🅰︎</button>
      <button class="srs-size-btn" onclick="toggleSrsSize()" id="srs-size-btn">${getHumanSrsLimit()}</button>
    </div>

    <div id="srs-calendar" style="display:none"></div>

    <div id="restore-panel" style="display:none">
      <h1>Open levels til</h1>
      <input type="number" id="restore-level" placeholder="Open levels til" min="1"/>
      <button class="restore-rom-input-btn" onclick="restoreFromInput()">Save</button>

      <h1>Ignore levels til</h1>
      <input type="number" id="ignore-level" placeholder="Ignore levels til" min="1"/>
      <button class="ignore-rom-input-btn" onclick="ignoreSrsUntilLevel()">Save</button>
    </div>

    <div id="srs-size-menu" class="srs-size-menu" style="display:none">
      <button class="select-srs-size-btn" onclick="selectSrsSize(5)">5</button>
      <button class="select-srs-size-btn" onclick="selectSrsSize(10)">10</button>
      <button class="select-srs-size-btn" onclick="selectSrsSize(25)">25</button>
      <button class="select-srs-size-btn" onclick="selectSrsSize(50)">50</button>
      <button class="select-srs-size-btn" onclick="selectSrsSize('All')">All</button>
      <button class="srs-reset-ignored" onclick="resetIgnoredSrs()">Reset ignored</button>
    </div>


    <div class='path' id='path'></div>
  `;

  const path = document.getElementById("path");

  let index = 0;
  let direction = "forward";

  while (index < visibleLevels.length) {
    const rowLevels = visibleLevels.slice(
      index,
      index + LEVELS_PER_ROW
    );

    createRowFromLevels(path, direction, rowLevels);
    index += rowLevels.length;

    if (index >= visibleLevels.length) break;

    if (TURN_LENGTH > 0) {
      const turnLevels = visibleLevels.slice(index, index + TURN_LENGTH);
      createTurnFromLevels(path, direction, turnLevels);
      index += turnLevels.length;
    }

    direction = direction === "forward" ? "backward" : "forward";
  }
}


function ignoreSrsUntilLevel() {
  const level = parseInt(
    document.getElementById("ignore-level")?.value,
    10
  )

  if (!Number.isInteger(level) || level < 2) return

  const progress = getProgress()

  progress.ignoredFromSrs ||= {}
  progress.completedLevels ||= {};

  for (let i = 1; i < level; i++) {
    progress.completedLevels[i] = true;

    for (const char of getCharsForLevel(i)) {
      progress.ignoredFromSrs[char.polish_word] = true
    }
  }

  saveProgress(progress)
  location.hash = "#";
  window.location.reload();
}

function getPolishPreviewForLevel(level) {
  return getCharsForLevel(level)
    .filter(c => !isIgnoredFromSrs(c.polish_word))
    .map(c => c.polish_word)
    .join("");
}


function getCharsForLevel(level) {
  const startId = (level - 1) * WORDS_PER_LEVEL + 1;
  const endId = startId + WORDS_PER_LEVEL - 1;
  return HSK.filter(c => c.id >= startId && c.id <= endId);
}

function isLevelEmpty(level) {
  return getWordsPreviewForLevel(level).length === 0;
}

function toggleHomeTranslations() {
  const current = localStorage.getItem("usePolish") !== "false";
  localStorage.setItem("usePolish", current ? "false" : "true");
  renderPath();
}

function getWordsPreviewForLevel(level) {
  let usePolish = localStorage.getItem("usePolish") !== "false";
  let filtered = getCharsForLevel(level).filter(c => !isIgnoredFromSrs(c.polish_word))

  return filtered.map((c, i) =>
      usePolish ? `<div>${c.polish_word}</div>` : `<div>${c.russian_translation}</div>`
    ).join("");
}

function resetIgnoredSrs() {
  const progress = getProgress();

  if (progress.ignoredFromSrs) {
    delete progress.ignoredFromSrs;
    saveProgress(progress);
  }
  document.getElementById("srs-size-menu").style.display = "none";

  location.hash = "#";
  window.location.reload();
}

function createRowFromLevels(container, direction, levels) {
  const row = document.createElement("div");
  row.className = "row";

  const orderedLevels =
    direction === "forward"
      ? levels
      : [...levels].reverse();

  const count = orderedLevels.length;
  const nextAvailable = getNextAvailableLevel();

  orderedLevels.forEach((lvl, index) => {
    if (lvl > nextAvailable) {
      return;
    }
    const cell = document.createElement("div");
    cell.className = "cell";

    const btn = document.createElement("button");

    const levelNum = document.createElement("div");
    levelNum.className = "level-number";
    levelNum.textContent = lvl;
    btn.appendChild(levelNum);

    if (isLevelCompleted(lvl)) {
      const polish = document.createElement("div");
      polish.innerHTML = getWordsPreviewForLevel(lvl);
      btn.appendChild(polish);
    }

    // 🔹 zigzag offset (same logic, just array-based)
    if (direction !== "forward") {
      const step = 20;
      const offset =
        direction === "forward"
          ? index * step
          : (count - 1 - index) * step;

      btn.style.marginTop = `${offset}px`;
    }

    if (isLevelCompleted(lvl)) {
      btn.classList.add("completed");
    }

    if (lvl > nextAvailable) {
      btn.classList.add("locked");
      btn.disabled = true;
    } else {
      btn.onclick = () => {
        location.hash = `/level/${lvl}`;
        window.location.reload();
      };
    }

    cell.appendChild(btn);
    row.appendChild(cell);
  });
  if (row.innerHTML) {
    container.appendChild(row);
  }
}

function scrollBottom() {
  window.scrollTo({
    top: 999999,
    behavior: "instant"
  });
}
function createRow(container, direction, start, end) {
  const row = document.createElement("div");
  row.className = "row";

  const levels =
    direction === "forward"
      ? range(start, end)
      : range(start, end).reverse();

  const count = levels.length;

  levels.forEach((lvl, index) => {
    const cell = document.createElement("div");
    cell.className = "cell";

    const btn = document.createElement("button");

    if (isLevelCompleted(lvl)) {
      const polish = document.createElement("div");
      polish.className = "level-polish";
      polish.innerHTML = getWordsPreviewForLevel(lvl);
      btn.appendChild(polish);
    } else {
      btn.textContent = lvl;
    }

    // 🔹 zigzag offset (same logic, just array-based)
    if (direction !== "forward") {
      const step = 20;
      const offset =
        direction === "forward"
          ? index * step
          : (count - 1 - index) * step;

      btn.style.marginTop = `${offset}px`;
    }


    if (isLevelCompleted(lvl)) {
      btn.classList.add("completed");
    }

    const nextAvailable = getNextAvailableLevel();

    if (lvl > nextAvailable) {
      btn.classList.add("locked");
      btn.disabled = true;
    } else {
      btn.onclick = () => {
        location.hash = `/level/${lvl}`;
        window.location.reload();
      };
    }

    cell.appendChild(btn);
    row.appendChild(cell);
  });

  container.appendChild(row);
}

function getNextAvailableLevel() {
  const progress = getProgress();
  const completed = Object.keys(progress.completedLevels || {})
    .map(Number);

  if (completed.length === 0) return 1;

  return Math.max(...completed) + 1;
}

function getAllLearnedChars() {
  const progress = getProgress();
  const completedLevels = Object.keys(progress.completedLevels || {}).map(Number);

  const chars = [];
  completedLevels.forEach(level => {
    chars.push(...getCharsForLevel(level));
  });

  return chars.filter(c => !isIgnoredFromSrs(c.polish_word));
}


function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}
function startSrsSession() {
  const limit = getSrsLimit();
  const all = shuffle(getAllLearnedChars());
  const session = all.slice(0, limit);

  localStorage.setItem("srsSession", JSON.stringify({
    chars: session,
    index: 0
  }));

  location.hash = "#/srs";
}
function createTurn(container, direction, startLevel) {
  for (let i = 0; i < TURN_LENGTH; i++) {
    const lvl = startLevel + i;

    const row = document.createElement("div");
    row.className = "row turn";

    const cell = document.createElement("div");
    cell.className = "cell";

    const btn = document.createElement("button");
    btn.className = "secondary";
    btn.textContent = lvl;
    if (isLevelCompleted(lvl)) {
      btn.classList.add("completed");
    }
    const nextAvailable = getNextAvailableLevel();

    if (lvl > nextAvailable) {
      btn.classList.add("locked");
      btn.disabled = true;
    } else {
      btn.onclick = () => {
        location.hash = `/level/${lvl}`;
        window.location.reload();
      };
    }

    cell.appendChild(btn);
    row.appendChild(cell);

    row.style.justifyContent =
      direction === "forward" ? "flex-end" : "flex-start";

    container.appendChild(row);
  }
}

function range(a, b) {
  const res = [];
  for (let i = a; i <= b; i++) res.push(i);
  return res;
}

function getCharsForLevel(level) {
  const startId = (level - 1) * WORDS_PER_LEVEL + 1;
  const endId = startId + WORDS_PER_LEVEL - 1;
  return HSK.filter(c => c.id >= startId && c.id <= endId);
}

function goBack(level, index) {
  if (index > 0) {
    location.hash = `#/level/${level}/${index - 1}`;
  } else {
    location.hash = "#";
    setTimeout(scrollBottom, 0);
  }
}

function finishLevel(level) {
  markLevelCompleted(level);
  location.hash = "#";
  // window.location.reload();
  setTimeout(scrollBottom, 0);
}

function renderLevel(level, index = 0) {
  const chars = getCharsForLevel(level);
  const c = chars[index];

  const isLast = index >= chars.length - 1;

  app.innerHTML = `
    <div class="fixed-bottom">
      <button class="back-btn" onclick="goBack(${level}, ${index})">←</button>
      ${
        !isLast
          ? `<button class="next-btn" onclick="location.hash='#/level/${level}/${index + 1}'">→</button>`
          : `<button class="next-btn" onclick="finishLevel(${level})">✓</button>`
      }
      <button class="speak-btn" onclick="speak('${c.polish_word}')">🔊</button>
    </div>

    <h1>Level ${level}</h1>

    <div class="char-card">
      <div class="progress">${index + 1} / ${chars.length}</div>
      <div class="russian_translation">${c.russian_translation}</div>
      <div class="polish_word-row">
        <button id="reveal-letter" class="secondary-btn">+</button>
        <button id="toggle-meaning" class="secondary-btn">Open</button>
      </div>

      <div id="example-masked" style="display:block">
        <p class="section">${maskWordInUsage(c.usage_example, c.polish_word) || ""}</p>
      </div>

      <div id="meaning-full" style="display:none">
        <p class="section">${c.usage_example || ""}</p>

        <h1>Description</h1>
        <p class="section">${c.polish_description || ""}</p>

        <h1>Description</h1>
        <p class="section">${c.russian_description || ""}</p>
      </div>
    </div>
  `;

  const toggleBtn = document.getElementById("toggle-meaning");
  const revealBtn = document.getElementById("reveal-letter");
  const masked = document.getElementById("example-masked");
  const full = document.getElementById("meaning-full");

  toggleBtn.onclick = () => {
    speak(c.polish_word);
    masked.style.display = "none";
    full.style.display = "block";
    toggleBtn.style.display = "none";
    revealBtn.style.display = "none";
  };

  revealIndex = 0;

  revealBtn.onclick = () => {
    revealIndex++;

    const text = revealWordStep(
      c.usage_example,
      c.polish_word,
      revealIndex
    );

    masked.innerHTML = `<p class="section">${text}</p>`;

    // если слово раскрыто полностью — прячем кнопку
    if (revealIndex >= c.polish_word.length) {
      revealBtn.style.display = "none";
      toggleBtn.click();
    }
  };

}

function ignoreCurrentSrsChar() {
  const session = JSON.parse(localStorage.getItem("srsSession"));
  if (!session) return;

  const c = session.chars[session.index];

  ignoreCharFromSrs(c.polish_word);

  // сразу убираем из текущей сессии
  session.chars.splice(session.index, 1);

  if (session.index >= session.chars.length) {
    finishSrsSession();
  } else {
    localStorage.setItem("srsSession", JSON.stringify(session));
    renderSrs();
  }
}


function renderSrs() {
  const session = JSON.parse(localStorage.getItem("srsSession"));
  if (!session) {
    app.innerHTML = "<p>No SRS session</p>";
    return;
  }

  const { chars, index } = session;
  const c = chars[index];

  if (!c) {
    return;
  }
  const isLast = index >= chars.length - 1;

  app.innerHTML = `
    <div class="fixed-bottom">
      <button class="back-btn" onclick="location.hash = '#';setTimeout(scrollBottom, 0);">←</button>
      <button class="ignore-btn" onclick="ignoreCurrentSrsChar()">
        -
      </button>
      <button class="next-srs-btn"  onclick="nextSrs()">
        ${isLast ? "✓" : "→"}
      </button>
      <button class="speak-btn" onclick="speak('${c.polish_word}')">🔊</button>
    </div>

    <h1>SRS</h1>

    <div class="char-card">
      <div class="progress">${index + 1} / ${chars.length}</div>
      <div class="russian_translation">${c.russian_translation}</div>
      <div class="polish_word-row">
        <button id="reveal-letter" class="secondary-btn">+</button>
        <button id="toggle-meaning" class="secondary-btn">Open</button>
      </div>

      <div id="example-masked" style="display:block">
        <p class="section">${maskWordInUsage(c.usage_example, c.polish_word) || ""}</p>
      </div>

      <div id="meaning-full" style="display:none">
        <p class="section">${c.usage_example || ""}</p>

        <h1>Description</h1>
        <p class="section">${c.polish_description || ""}</p>

        <h1>Description</h1>
        <p class="section">${c.russian_description || ""}</p>
      </div>
    </div>
  `;

  const toggleBtn = document.getElementById("toggle-meaning");
  const revealBtn = document.getElementById("reveal-letter");
  const masked = document.getElementById("example-masked");
  const full = document.getElementById("meaning-full");

  toggleBtn.onclick = () => {
    speak(c.polish_word);
    masked.style.display = "none";
    full.style.display = "block";
    toggleBtn.style.display = "none";
    revealBtn.style.display = "none";
  };

  revealIndex = 0;

  revealBtn.onclick = () => {
    revealIndex++;

    const text = revealWordStep(
      c.usage_example,
      c.polish_word,
      revealIndex
    );

    masked.innerHTML = `<p class="section">${text}</p>`;

    // если слово раскрыто полностью — прячем кнопку
    if (revealIndex >= c.polish_word.length) {
      revealBtn.style.display = "none";
      toggleBtn.click();
    }
  };
}

function maskWordInUsage(usage, word) {
  if (!usage || !word) return usage;

  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mask = "*".repeat(word.length);

  const regex = new RegExp(escaped, "gi");
  return usage.replace(regex, mask);
}

function nextSrs() {
  const session = JSON.parse(localStorage.getItem("srsSession"));
  markSrsSeen();
  session.index++;

  if (session.index >= session.chars.length) {
    finishSrsSession();
  } else {
    localStorage.setItem("srsSession", JSON.stringify(session));
    renderSrs();
  }
}
function markSrsSeen() {
  const today = new Date().toISOString().slice(0, 10);
  const progress = getProgress();

  progress.srsHistory ||= {};
  progress.srsHistory[today] ||= 0;
  progress.srsHistory[today]++;

  saveProgress(progress);
}

function finishSrsSession() {
  localStorage.removeItem("srsSession");
  location.hash = "#";
  // window.location.reload();
  setTimeout(scrollBottom, 0);
}

function toggleSrsCalendar() {
  const el = document.getElementById("srs-calendar");
  if (!el.innerHTML) {
    el.innerHTML = renderSrsMonth();
  }
  el.style.display = el.style.display === "none" ? "block" : "none";
}

function renderSrsMonth() {
  const history = getProgress().srsHistory || {};
  const now = new Date();

  const year = now.getFullYear();
  const month = now.getMonth(); // текущий

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay() || 7;

  let html = `<h1>SRS Calendar</h1><div class="calendar-grid">`;

  // пустые ячейки перед началом месяца
  for (let i = 1; i < firstDay; i++) {
    html += `<div class="day empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const count = history[date] || 0;

    html += `
      <div class="day" title="${date}: ${count}">${count}
      </div>
    `;
  }

  html += `</div>`;
  return html;
}
function ignoreCharFromSrs(polish_word) {
  const progress = getProgress();
  progress.ignoredFromSrs ||= {};
  progress.ignoredFromSrs[polish_word] = true;
  saveProgress(progress);
}

function isIgnoredFromSrs(polish_word) {
  const progress = getProgress();
  return !!progress.ignoredFromSrs?.[polish_word];
}

(async function init() {
  await loadHSK();
  router();
})();
