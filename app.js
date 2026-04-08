
let weeklyChartInstance = null;


/* ===================== DOM ===================== */
const projectList = document.getElementById("projectList");
const activityList = document.getElementById("activityList");

const modalBackdrop = document.getElementById("modalBackdrop");
const inputModal = document.getElementById("inputModal");
const modalInput = document.getElementById("modalInput");
const modalTitle = document.getElementById("modalTitle");
const modalActions = document.querySelector(".modal-actions");
const searchToggle = document.getElementById("searchToggle");
const searchInput = document.getElementById("searchInput");
const searchBarContainer = document.getElementById("searchBarContainer");
/* ===================== STATE ===================== */
let resources, wallets;

try {
  resources = JSON.parse(localStorage.getItem("resources")) || [];
} catch {
  resources = [];
}

try {
  wallets = JSON.parse(localStorage.getItem("wallets")) || [];
} catch {
  wallets = [];
}


function saveWallets() {
  localStorage.setItem("wallets", JSON.stringify(wallets));
}

function saveResources() {
  localStorage.setItem("resources", JSON.stringify(resources));
}

let projects;

try {
  const data = JSON.parse(localStorage.getItem("projects"));
  projects = Array.isArray(data) ? data : [];
} catch {
  projects = [];
}

let lastDeletedProject = null;

let activeProjectIndex = null;
let modalMode = null;
let modalPayload = null;
let isLongPress = false;
let showArchived = false;

/* ===================== HELPERS ===================== */
function formatLocalDate(d) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

function today() {
  return formatLocalDate(new Date());
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day;
  const start = new Date(d.setDate(diff));
  return formatLocalDate(start);
}

function getStreak(history) {
  let streak = 0;
  let d = new Date();

  while (true) {
    const dateStr = formatLocalDate(d);

    if (history?.[dateStr]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

function checkDailyReminder() {
  if (Notification.permission !== "granted") return;

  const t = today();
  const lastNudge = localStorage.getItem("protocol_last_nudge");

  if (lastNudge === t) return;

  let unfinishedTasks = 0;

  projects.forEach(p => {
    if (p.archived) return;

    p.activities.forEach(a => {
      if (a.frequency === "daily" && !(t in (a.history || {}))) {
        unfinishedTasks++;
      }
    });
  });

  if (unfinishedTasks > 0) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return;

      reg.showNotification("Protocol Desk Reminder", {
        body: `You still have ${unfinishedTasks} tasks left today`,
        icon: "favicon.png"
      });
    });

    localStorage.setItem("protocol_last_nudge", t);
  }
}

function last7Days() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(formatLocalDate(d));
  }
  return days;
}

function getCurrentWeekDates() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = now.getDate() - day;

  const start = new Date(now.setDate(diff));

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(formatLocalDate(d));
  }

  return days;
}

function generateWeeklyInsights() {
  const insights = [];
  const week = getCurrentWeekDates();
  const t = today();
  const y = yesterday();

  projects.forEach((p) => {
    if (p.archived) return;

    let weakHabits = [];
    let missedToday = [];
    let strongHabits = [];

    p.activities.forEach((a) => {
      const history = a.history || {};

      let done = 0;
      week.forEach(d => {
        if (history[d]) done++;
      });

      const expected = a.frequency === "weekly" ? a.target : week.length;
      const consistency = expected ? (done / expected) * 100 : 0;

      // 🔴 WEAK (human logic)
      if (consistency < 40) {
        weakHabits.push(a.name);
      }

      // 🟡 INCONSISTENT
      else if (consistency < 70) {
        insights.push({
          type: "neutral",
          text: `You're inconsistent with ${a.name}`,
          sub: "Try fixing a time instead of relying on mood"
        });
      }

      // 🟢 STRONG
      else if (consistency >= 80) {
        strongHabits.push(a.name);
      }

      // 🔥 MISSED TODAY (better logic)
      if (!(t in history) && getStreak(history) > 0) {
        missedToday.push(a.name);
      }
    });

    // ===== GROUPED INSIGHTS =====

    if (missedToday.length) {
      insights.push({
        type: "danger",
        text: "You broke your rhythm today",
        sub: `Missed: ${missedToday.slice(0,3).join(", ")}`,
      });
    }

    if (weakHabits.length) {
      insights.push({
        type: "warning",
        text: `${weakHabits.length} habits are slipping`,
        sub: weakHabits.slice(0,3).join(", "),
      });
    }

    if (strongHabits.length >= 2) {
      insights.push({
        type: "success",
        text: "You're building momentum",
        sub: strongHabits.slice(0,3).join(", "),
      });
    }

    // 🔥 SMART OVERLOAD DETECTION
    if (weakHabits.length >= Math.ceil(p.activities.length * 0.6)) {
      insights.push({
        type: "danger",
        text: `You're overloaded in "${p.name}"`,
        sub: "Reduce focus to 1–2 habits",
      });
    }

  });

  return insights;
}

function renderInsights() {
  const box = document.createElement("div");
  box.className = "card";

  const title = document.createElement("h2");
  title.textContent = "Insights";
  box.appendChild(title);

  const insights = generateWeeklyInsights();

  if (!insights.length) {
    box.innerHTML += `
      <div class="insight success">
        <strong>You're on track</strong>
        <small>Consistency is strong this week</small>
      </div>
    `;
    return box;
  }

  insights.slice(0,4).forEach((i, index) => {
    const item = document.createElement("div");
    item.className = `insight ${i.type}`;

    item.style.animationDelay = `${index * 80}ms`;

    item.innerHTML = `
      <div class="insight-title">${i.text}</div>
      <div class="insight-sub">${i.sub}</div>
    `;

    box.appendChild(item);
  });

  return box;
}
function save() {
  try {
    localStorage.setItem("projects", JSON.stringify(projects));
  } catch (e) {
    showToast("Storage full or error saving");
    console.error(e);
  }
}

/* ===================== PROJECT LIST ===================== */
function renderProjects() {
if (!projectList) return;
  projectList.innerHTML = "";

  const visibleProjects = projects.filter(p =>
  showArchived ? p.archived : !p.archived
);

  // ✅ EMPTY STATE
   if (visibleProjects.length === 0) {
  projectList.innerHTML = `
    <div class="card">
      <p>${showArchived ? "No archived projects" : "No projects yet"}</p>
      <small style="opacity:0.6;">
        ${showArchived ? "Archived items appear here" : "Tap + to create your first project"}
      </small>
    </div>
  `;
  return;
}

  // ✅ RENDER PROJECTS
  visibleProjects.forEach((p) => {
  const realIndex = projects.findIndex(x => x === p);

  const card = document.createElement("div");
  card.className = "project-card";
  card.dataset.index = realIndex;

  const handle = document.createElement("div");
  handle.className = "drag-handle";
  handle.innerHTML = "⋮⋮";

  const name = document.createElement("div");
  name.className = "project-name";
  name.textContent = p.name;
  name.onclick = () => openProject(realIndex);

  const menu = document.createElement("button");
  menu.className = "project-options-btn";
  menu.textContent = "⋮";
  menu.onclick = (e) => {
    e.stopPropagation();
    openProjectOptions(realIndex);
  };

  card.append(handle, name, menu);
  projectList.appendChild(card);
});

 
}


/* ===================== PROJECT OPTIONS ===================== */
function openProjectOptions(index) {
  modalTitle.textContent = "Project Options";
  modalInput.style.display = "none";
  modalActions.innerHTML = "";
  modalMode = "project-options";
  modalPayload = { index };

  const rename = document.createElement("button");
  rename.className = "secondary-btn";
  rename.textContent = "Rename";
  rename.onclick = () =>
    openModal("Rename Project", "Project name", "rename-project", {
      index,
      value: projects[index].name
    });

  const archive = document.createElement("button");
  archive.className = "secondary-btn";
  archive.textContent = "Archive";
  archive.onclick = () => {
    projects[index].archived = true;
    save();
    closeModal();
    activeProjectIndex = null;
    renderProjects();
  };

  const unarchive = document.createElement("button");
  unarchive.className = "secondary-btn";
  unarchive.textContent = "Unarchive";
  unarchive.onclick = () => {
    projects[index].archived = false;
    save();
    closeModal();
    activeProjectIndex = null;
    renderProjects();
  };

  const del = document.createElement("button");
  del.className = "danger-btn";
  del.textContent = "Delete";
  del.onclick = () =>
    openModal(
      "Delete Project",
      "Type DELETE to confirm",
      "confirm-delete-project",
      { index }
    );

  const cancel = document.createElement("button");
  cancel.className = "secondary-btn";
  cancel.textContent = "Cancel";
  cancel.onclick = closeModal;

  if (projects[index].archived) {
    modalActions.append(rename, unarchive, del, cancel);
  } else {
    modalActions.append(rename, archive, del, cancel);
  }
  
  modalBackdrop.classList.remove("hidden");
  inputModal.classList.remove("hidden");
}

/* ===================== OPEN PROJECT ===================== */


function openProject(index) {
  if (!projects[index]) return;

  showArchived = false; // ✅ FIX

  activeProjectIndex = index;

  const titleEl = document.getElementById("projectTitle");
  if (titleEl) titleEl.textContent = projects[index].name;

  switchTab("projectTab");
  renderActivities();
}

/* ===================== ACTIVITIES ===================== */
function renderActivities() {
  if (!activityList) return; // ✅ ADD THIS
  if (!projects[activeProjectIndex]) return;

  activityList.innerHTML = "";

  const project = projects[activeProjectIndex];

  if (project.activities.length === 0) {
    activityList.innerHTML = `
      <div class="card">
        <p>No activities yet</p>
      </div>
    `;
    return;
  }

  const t = today();
  const y = yesterday();
  


  project.activities.forEach(act => {

  
  const history = act.history || {};

const doneToday = history[t] === true;

const missedYesterday =
  !(y in history) && getStreak(history) > 0;

const streak = getStreak(history);

    // ===== UI =====
    const row = document.createElement("div");
    row.className = "activity-item";

    const meta = document.createElement("div");
    meta.className = "activity-meta";

    const name = document.createElement("div");
    name.className = "activity-name";
    name.textContent = act.name;
    name.onclick = () => {
      if (!act.link) return;
      openExternal(act.link);
    };

    const status = document.createElement("div");
    status.className = "activity-status";

    

    if (act.frequency === "daily") {
      status.innerHTML = `
  <span class="status-label ${
    doneToday ? "done" : missedYesterday ? "missed" : "pending"
  }">
    ${
      doneToday
  ? "✔ Completed"
  : missedYesterday
  ? "⚠ Missed"
  : "• Pending"
    }
  </span>
  ${
    streak
      ? `<span class="streak-badge">${streak}d</span>`
      : ""
  }
`;
    } else {
      const week = getCurrentWeekDates();
      let count = 0;

      week.forEach(d => {
        if (act.history?.[d]) count++;
      });

      status.textContent = `✔ ${count}/${act.target} this week`;
    }

    meta.append(name, status);

    const toggle = document.createElement("div");
    toggle.className = "toggle" + (doneToday ? " active" : "");

    toggle.onclick = () => {

  // 🔥 animation
  toggle.style.transform = "scale(1.15)";
  setTimeout(() => {
    toggle.style.transform = "scale(1)";
  }, 120);

  if (act.frequency === "daily") {
act.history = act.history || {};
    if (act.history[t]) {
      delete act.history[t];
    } else {
      act.history[t] = true;
    }
  } else {
    const week = getCurrentWeekDates();
    let count = 0;

    week.forEach(d => {
      if (act.history?.[d]) count++;
    });
act.history = act.history || {};
    if (act.history[t]) {
      delete act.history[t];
    } else {
      if (!act.history[t] && count < act.target) {
  act.history[t] = true;
}
    }
  }

  save();
  renderActivities();

// 🔥 NEW: update analytics if open
const analyticsTab = document.getElementById("analyticsTab");
if (analyticsTab && analyticsTab.classList.contains("active")) {
  renderAnalytics();
}

  // ✅ MOVE THESE INSIDE
  const focusTab = document.getElementById("focusTab");
  if (focusTab && focusTab.classList.contains("active")) {
    renderFocusMode();
  }

  const settingsTab = document.getElementById("settingsTab");
  if (settingsTab && settingsTab.classList.contains("active")) {
    renderSettings();
  }
};

    row.append(meta, toggle);
    activityList.appendChild(row);
  });

  
}

/* ===================== MODAL ===================== */
function openModal(title, placeholder, mode, payload = null) {
if (!modalBackdrop || !inputModal || !modalInput) return;
  modalTitle.textContent = title;
  modalInput.placeholder = placeholder;
  modalInput.value = payload?.value || "";
  modalInput.style.display = "block";
  modalActions.innerHTML = "";
  modalMode = mode;
  modalPayload = payload;


  const cancel = document.createElement("button");
  cancel.className = "secondary-btn";
  cancel.textContent = "Cancel";
  cancel.onclick = closeModal;

  const ok = document.createElement("button");
  ok.className = "primary-btn";
  ok.textContent = mode === "open-link" ? "Open" : "OK";
  ok.onclick = confirmModal;

  modalActions.append(cancel, ok);
  modalBackdrop.classList.remove("hidden");
  inputModal.classList.remove("hidden");
}

if (modalInput) {
  modalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (!modalMode) return;

      const val = modalInput.value.trim();
      if (!val) return;

      confirmModal();
    }
  });
}

function closeModal() {
  if (!modalBackdrop || !inputModal) return; // ✅ ADD

  modalBackdrop.classList.add("hidden");
inputModal.classList.add("hidden");
  modalInput.style.display = "";
  modalInput.value = "";
  modalMode = null;
  modalPayload = null;
}

/* ===================== MODAL CONFIRM ===================== */
function confirmModal() {
  const val = modalInput.value.trim();

  if (modalMode === "project") {
    if (!val || val.length < 2) return;
    projects.push({ name: val, activities: [], archived: false });
  }

  if (modalMode === "activity") {
    if (!val) return;

    const parts = val.split("|").map(v => v.trim());

    const name = parts[0];
    const type = parts[1] || "daily";
    let target = parseInt(parts[2]);
    if (isNaN(target) || target < 1) target = 1;
if (activeProjectIndex === null || !projects[activeProjectIndex]) return;
    projects[activeProjectIndex].activities.push({
      name,
      link: "",
      history: {},
      frequency: type === "weekly" ? "weekly" : "daily",
      target: type === "weekly" ? target : 1,
      weekStart: getWeekStart()
    });
  }

  if (modalMode === "rename-project") {
  if (!val || !modalPayload || !projects[modalPayload.index]) return;
  projects[modalPayload.index].name = val;
}

  if (modalMode === "resource") {
    const [title, url, note] = val.split("|").map(v => v.trim());
    if (!title || !url) return;

    resources.push({ title, url, note });
    saveResources();
    closeModal();
    renderResources();
    return;
  }

  if (modalMode === "wallet") {
    const [name, address] = val.split("|").map(v => v.trim());
    if (!name || !address) return;

    wallets.push({ name, address });
    saveWallets();

    closeModal();
    renderWallets();
    return;
  }

  if (modalMode === "confirm-delete-project") {
    if (val !== "DELETE") return;

    const isCurrent = activeProjectIndex === modalPayload.index;

    lastDeletedProject = {
      data: projects[modalPayload.index],
      index: modalPayload.index
    };

    projects.splice(modalPayload.index, 1);

    if (activeProjectIndex !== null && activeProjectIndex > modalPayload.index) {
      activeProjectIndex--;
    }

    showUndoToast();

    activeProjectIndex = null;
    activityList.innerHTML = "";

    if (isCurrent) {
      switchTab("homeTab");
    }

    if (projects.length === 0) {
      switchTab("homeTab");
      renderProjects();
    }
  }

  if (modalMode === "rename-activity") {
    if (!val) return; // ✅ FIX 4: Prevent empty activity names
    const parts = val.split("|").map(v => v.trim());

    const name = parts[0];
    if (!name) return; // double check

    const type = parts[1] || "daily";
    let target = parseInt(parts[2]);
    if (isNaN(target) || target < 1) target = 1;
if (
  !modalPayload ||
  !projects[modalPayload.p] ||
  !projects[modalPayload.p].activities[modalPayload.a]
) return;

    const act = projects[modalPayload.p].activities[modalPayload.a];

    act.name = name;
    act.frequency = type === "weekly" ? "weekly" : "daily";
    act.target = act.frequency === "weekly" ? target : 1;

    // ✅ FIX 2: Removed act.history = {} so renamed activities don't lose past data
    act.weekStart = getWeekStart();

    save();
  }

  if (modalMode === "edit-link") {

if (
  !modalPayload ||
  !projects[modalPayload.p] ||
  !projects[modalPayload.p].activities[modalPayload.a]
) return;
    projects[modalPayload.p].activities[modalPayload.a].link = val;
  }

  if (modalMode === "confirm-delete-activity") {
    if (val !== "DELETE") return;
if (
  !modalPayload ||
  !projects[modalPayload.p] ||
  !projects[modalPayload.p].activities[modalPayload.a]
) return;
    projects[modalPayload.p].activities.splice(modalPayload.a, 1);
  }

  if (modalMode === "confirm-reset") {
    if (val !== "RESET") return;

    localStorage.removeItem("projects");
    localStorage.removeItem("resources");
    localStorage.removeItem("wallets");

    projects = [];
    resources = [];
    wallets = [];
    activeProjectIndex = null;

    closeModal();
    switchTab("homeTab");
    return;
  }

  if (modalMode === "confirm-delete-resource") {
    if (val !== "DELETE") return;

    if (!modalPayload || modalPayload.index == null) return;
resources.splice(modalPayload.index, 1);
    saveResources();
    closeModal();
    renderResources();
    return;
  }

  save();
  closeModal();
   const homeTab = document.getElementById("homeTab");
if (homeTab && homeTab.classList.contains("active")) {
    renderProjects();
  }
  if (activeProjectIndex !== null && projects[activeProjectIndex]) {
    renderActivities();
  }
  const settingsTab = document.getElementById("settingsTab");
if (settingsTab && settingsTab.classList.contains("active")) {
  renderSettings();
}
}

/* ===================== SETTINGS ===================== */

function renderSettings() {
  const root = document.getElementById("settingsTab");
if (!root) return;
  root.innerHTML = `
  <div class="card">
    <h2>Settings</h2>
    <p>Manage your app data and preferences</p>
  </div>
`;

  const box = document.createElement("div");
  root.appendChild(box);

  // ===== EXPORT / IMPORT =====
  const topRow = document.createElement("div");
  topRow.className = "settings-row";

  const exportBtn = document.createElement("button");
  exportBtn.className = "secondary-btn";
  exportBtn.textContent = "Export Backup";
  exportBtn.onclick = () => {
    const cleanProjects = projects.map(p => ({
      name: p.name,
      archived: p.archived || false, // ✅ FIX 1: Preserves archive status in backup
      activities: p.activities.map(a => ({
        name: a.name,
        link: a.link || "",
        history: a.history || {},
        frequency: a.frequency || "daily",
        target: a.target || 1,
        weekStart: a.weekStart || getWeekStart()
      }))
    }));

    const backup = {
      version: 4,
      projects: cleanProjects,
      resources,
      wallets
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "protocol-desk-backup.json";
    a.click();
  };

  const importBtn = document.createElement("button");
  importBtn.className = "secondary-btn";
  importBtn.textContent = "Import Backup";
  importBtn.onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.onchange = function () {
      const reader = new FileReader();

      reader.onload = function () {
        try {
          const data = JSON.parse(this.result);

if (!data || !Array.isArray(data.projects)) {
  throw new Error("Invalid backup file");
}

          projects = (data.projects || []).map(p => ({
            name: p.name,
            archived: p.archived || false, // ✅ FIX 1: Restores archive status correctly
            activities: (p.activities || []).map(a => ({
              name: a.name,
              link: a.link || "",
              history: a.history || {},
              frequency: a.frequency || "daily",
              target: a.target || 1,
              weekStart: a.weekStart || getWeekStart()
            }))
          }));

          resources = data.resources || [];
          wallets = data.wallets || [];

          save();
          saveResources();
          saveWallets();

          switchTab("homeTab");

          showToast("Import successful");
        } catch {
          showToast("Import failed");
        }
      };

      reader.readAsText(input.files[0]);
    };

    input.click();
  };

  topRow.append(exportBtn, importBtn);
  box.appendChild(topRow);

  // ===== PROJECTS + ACTIVITIES =====
  projects.forEach((p, pi) => {

    if (p.archived) return;
    const header = document.createElement("div");
    header.className = "card";
    header.textContent = p.name;
    box.appendChild(header);

    p.activities.forEach((a, ai) => {

      const row = document.createElement("div");
      row.className = "settings-row-flex";

      const label = document.createElement("div");
      label.textContent = a.name;

      const rename = document.createElement("button");
      rename.className = "secondary-btn";
      rename.textContent = "Rename";
      rename.onclick = () =>
        openModal(
          "Rename Activity",
          "Name | daily OR weekly | target(optional)",
          "rename-activity",
          {
            p: pi,
            a: ai,
            value:
              a.frequency === "weekly"
                ? `${a.name} | weekly | ${a.target}`
                : `${a.name} | daily`
          }
        );

      const link = document.createElement("button");
      link.className = "secondary-btn";
      link.textContent = "Link";
      link.onclick = () =>
        openModal("Activity Link", "https://...", "edit-link", {
          p: pi,
          a: ai,
          value: a.link || ""
        });

      const del = document.createElement("button");
      del.className = "danger-btn";
      del.textContent = "Delete";
      del.onclick = () =>
        openModal(
          "Delete Activity",
          "Type DELETE to confirm",
          "confirm-delete-activity",
          { p: pi, a: ai }
        );

      const actions = document.createElement("div");
      actions.className = "settings-actions";

      actions.append(rename, link, del);

      row.append(label, actions);
      box.appendChild(row);
    });
  });

  // ===== RESET BUTTON =====
  const reset = document.createElement("button");
  reset.className = "danger-btn";
  reset.textContent = "Reset App Data";
  reset.onclick = () =>
    openModal("Reset App Data", "Type RESET to confirm", "confirm-reset");

  box.appendChild(reset);
}
/* ===================== ANALYTICS ===================== */

function renderAnalytics() {
  const overview = document.getElementById("analyticsOverview");
const projectBox = document.getElementById("projectAnalytics");

if (!overview || !projectBox) return; // ✅ ADD

overview.innerHTML = "";
  projectBox.innerHTML = "";

  const t = today();
  const week = getCurrentWeekDates();

  let totalActivities = 0;
  let totalDoneWeek = 0;
  let totalPossibleWeek = 0;

  projects.forEach((p, pi) => {

  if (p.archived) return;   

  totalActivities += p.activities.length;  

  p.activities.forEach(a => {

  let expected = 0;
  let done = 0;

  if (a.frequency === "daily") {
  expected = week.length;
  done = week.filter(d => a.history?.[d]).length;
} else {
  expected = a.target;
  done = Math.min(
    week.filter(d => a.history?.[d]).length,
    a.target || week.length
  );
}

  totalPossibleWeek += expected;
  totalDoneWeek += Math.min(done, expected);

});


  // ✅ MOVE THIS INSIDE LOOP
  const card = document.createElement("div");
  card.className = "analytics-project";
  card.onclick = () => openAnalyticsDetail(pi);

  const title = document.createElement("h3");
  title.textContent = p.name;

  card.appendChild(title);
  projectBox.appendChild(card);

});
  

const header = document.createElement("div");

header.innerHTML = `
  <h2>Overview</h2>

  <div class="analytics-row">
    <span>Total projects</span>
    <span>${projects.filter(p => !p.archived).length}</span>
  </div>

  <div class="analytics-row">
    <span>Total activities</span>
    <span>${totalActivities}</span>
  </div>

  <div class="analytics-row">
    <span>Weekly completion</span>
    <span>${totalPossibleWeek ? Math.round((totalDoneWeek / totalPossibleWeek) * 100) : 0}%</span>
  </div>
`;



  // ===== ANIMATED RINGS =====
  const ringCard = document.createElement("div");
  ringCard.className = "card analytics-rings";

  let totalToday = 0;
  let doneToday = 0;

  projects.forEach(p => {
    if (p.archived) return; 

    p.activities.forEach(a => {
      totalToday++;
      if (t in (a.history || {})) doneToday++;
    });
  });

  const todayPercent = totalToday
    ? Math.round((doneToday / totalToday) * 100)
    : 0;

  const weeklyPercent = totalPossibleWeek
    ? Math.round((totalDoneWeek / totalPossibleWeek) * 100)
    : 0;

  ringCard.innerHTML = `
    <div class="rings">
      <div class="ring">
        <div class="circle" data-value="${todayPercent}">
          <span>${todayPercent}%</span>
        </div>
        <p>Today</p>
      </div>

      <div class="ring">
        <div class="circle blue" data-value="${weeklyPercent}">
          <span>${weeklyPercent}%</span>
        </div>
        <p>Week</p>
      </div>
    </div>
  `;

  const fragment = document.createDocumentFragment();

fragment.appendChild(header);
fragment.appendChild(ringCard);

overview.appendChild(fragment);

  setTimeout(() => {
    overview.querySelectorAll(".circle").forEach(el => {
      const val = el.dataset.value;

      el.style.background =
        `conic-gradient(${el.classList.contains("blue") ? "#3b82f6" : "#22c55e"} ${val}%, #111 ${val}%)`;
    });
  }, 100);

const insightsUI = renderInsights();
overview.appendChild(insightsUI);

requestAnimationFrame(() => {
  insightsUI.querySelectorAll(".insight").forEach((el, i) => {
    el.style.animationDelay = `${i * 80}ms`;
  });
});
}
/* ===================== RESOURCES ===================== */
function renderResources() {
  const list = document.getElementById("resourcesList");
if (!list) return; // ✅ ADD

list.innerHTML = "";
  if (resources.length === 0) {
    list.innerHTML = `
      <div class="card">
        <p>No resources yet</p>
      </div>
    `;
    return;
  }

  resources.forEach((r, i) => {
    const card = document.createElement("div");
    card.className = "activity-item";

    const meta = document.createElement("div");
    meta.style.flex = "1";

    const title = document.createElement("div");
    title.className = "activity-name";
    title.textContent = r.title;
    title.onclick = () => openExternal(r.url);

    const note = document.createElement("div");
    note.className = "activity-status";
    note.textContent = r.note || "";

    meta.append(title, note);

    const del = document.createElement("button");
    del.className = "secondary-btn";
    del.textContent = "✕";
    del.onclick = () => {
      openModal(
        "Delete Resource",
        "Type DELETE to confirm",
        "confirm-delete-resource",
        { index: i }
      );
    };

    card.append(meta, del);
    list.appendChild(card);
  });
}

function renderWallets() {
  const resourcesTab = document.getElementById("resourcesTab");
if (!resourcesTab) return; // ✅ ADD

  const oldBox = document.getElementById("walletBox");
  if (oldBox) oldBox.remove();

  const box = document.createElement("div");
  box.id = "walletBox";
  box.className = "card";

  const title = document.createElement("h2");
  title.textContent = "Wallets";
  box.appendChild(title);

  wallets.forEach((w, i) => {
    const row = document.createElement("div");
    row.className = "wallet-row";

    const info = document.createElement("div");
    info.className = "wallet-info";

    const name = document.createElement("div");
    name.className = "wallet-name";
    name.textContent = w.name;

    const shortAddress = document.createElement("div");
    shortAddress.className = "wallet-address";

    const addr = w.address;
    const short =
      addr.length > 12
        ? addr.slice(0, 6) + "..." + addr.slice(-4)
        : addr;

    shortAddress.textContent = short;

    info.append(name, shortAddress);

    const actions = document.createElement("div");
    actions.className = "wallet-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "wallet-copy";
    copyBtn.innerHTML = "Copy";
    copyBtn.onclick = () => {
      navigator.clipboard?.writeText(w.address)
  .then(() => {
    copyBtn.textContent = "Copied";
    showToast("Address copied");
  })
  .catch(() => {
    showToast("Copy failed");
  });

      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    };

    const delBtn = document.createElement("button");
    delBtn.className = "wallet-delete";
    delBtn.textContent = "✕";
    delBtn.onclick = () => {
      wallets.splice(i, 1);
      saveWallets();
      renderWallets();
    };

    actions.append(copyBtn, delBtn);
    row.append(info, actions);
    box.appendChild(row);
  });

  const addBtn = document.createElement("button");
  addBtn.className = "primary-btn";
  addBtn.textContent = "Add Wallet";
  addBtn.onclick = () =>
    openModal("New Wallet", "Name | Address", "wallet");

  box.appendChild(addBtn);

  resourcesTab.insertBefore(box, resourcesTab.children[1]);
}

/* ===================== TABS ===================== */
document.querySelectorAll(".bottom-nav button").forEach(btn => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});

function switchTab(id) {

if (id !== "homeTab") {
  showArchived = false;
}
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  const tab = document.getElementById(id);
if (!tab) return; // ✅ ADD

tab.classList.add("active");
  const title = document.getElementById("headerTitle");

  if (title) {
    const titles = {
      aboutTab: "Protocol Desk",
      homeTab: "Projects",
      projectTab: "Activities",
      analyticsTab: "Analytics",
      analyticsDetailTab: "Details",
      resourcesTab: "Resources",
      settingsTab: "Settings",
      focusTab: "Focus Mode",
    };

    title.textContent = titles[id] || "Protocol Desk";
  }
  if (id === "homeTab") {
  renderProjects();

  const title = document.getElementById("headerTitle");
  if (title) {
    title.textContent = showArchived
      ? "Archived Projects"
      : "Projects";
  }
}

// ✅ MOVE THIS OUTSIDE
if (id === "focusTab") {
  renderFocusMode();
}
  if (searchBarContainer) {
  searchBarContainer.classList.add("hidden");
}
  if (searchInput) searchInput.value = "";
// ✅ RESET SEARCH RESULTS
document.querySelectorAll(".project-card, .activity-item").forEach(el => {
  el.style.display = "";
});
  if (weeklyChartInstance && typeof weeklyChartInstance.destroy === "function") {
    weeklyChartInstance.destroy();
    weeklyChartInstance = null;
  }
 
  document.querySelectorAll(".bottom-nav button").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === id)
  );

  if (searchToggle) {
    if (
      id === "homeTab" ||
      id === "resourcesTab" ||
      id === "settingsTab"
    ) {
      searchToggle.classList.remove("hidden");
    } else {
      searchToggle.classList.add("hidden");
    }
  }

  if (id === "settingsTab") renderSettings();
  if (id === "analyticsTab") renderAnalytics();
  if (id === "resourcesTab") {
    renderResources();
    renderWallets();
  }

  const radialMenu = document.getElementById("radialMenu");
  if (radialMenu) radialMenu.classList.remove("open");

  const fabEl = document.getElementById("addProjectBtn");

  if (fabEl) {
    if (id === "homeTab") {
      fabEl.classList.remove("fab-hide");
    } else {
      fabEl.classList.add("fab-hide");
    }
  }
}

const indicator = document.querySelector(".glass-indicator");
const navButtons = document.querySelectorAll(".glass-nav button");

function moveIndicator(btn) {
  const rect = btn.getBoundingClientRect();
  const navRect = indicator.parentElement.getBoundingClientRect();
  indicator.style.transform =
    `translate(${rect.left - navRect.left}px, -50%)`;
}

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    moveIndicator(btn);
  });
});

window.addEventListener("load", () => {
  const active = document.querySelector(".glass-nav button.active");
  if (active) moveIndicator(active);
});

/* ===================== BUTTONS ===================== */
function requestNotificationPermission() {
  if (!("Notification" in window)) return;

  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

document.addEventListener("DOMContentLoaded", () => {
requestNotificationPermission();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js")
    .then(() => console.log("SW registered"))
    .catch(err => console.error("SW failed", err));
}

let startY = 0;
let draggedEl = null;
let draggedIndex = null;
let positions = [];
let isDraggingStarted = false;

if (projectList) {
  projectList.addEventListener("touchstart", startDrag, { passive: false });
  projectList.addEventListener("mousedown", startDrag);

if ("Notification" in window) {
  Notification.requestPermission();
}

}

function startDrag(e) {
  if (showArchived) return;
if (!e.target.closest(".drag-handle")) return;
  const card = e.target.closest(".project-card");
  if (!card) return;

  draggedEl = card;
  draggedIndex = Number(card.dataset.index);

  startY = e.touches ? e.touches[0].clientY : e.clientY;
isDraggingStarted = false;

  card.classList.add("dragging");

positions = [...projectList.children].map(el =>
  el.getBoundingClientRect()
);

  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("mousemove", onMove);

  document.addEventListener("touchend", endDrag);
  document.addEventListener("mouseup", endDrag);
}

function onMove(e) {
  if (!draggedEl) return;

  const y = e.touches ? e.touches[0].clientY : e.clientY;
const diff = Math.abs(y - startY);

// 🔥 Only start drag after real movement
if (!isDraggingStarted) {
  if (diff < 12) return;

  isDraggingStarted = true;

  e.preventDefault(); // only now block scroll
}

// 👇 ADD THIS
if (Math.abs(y - startY) < 12) return;

  const cards = [...projectList.querySelectorAll(".project-card:not(.dragging)")];

  let closest = null;
  let closestOffset = Number.NEGATIVE_INFINITY;

  cards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const offset = y - (rect.top + rect.height / 2);

    if (offset < 0 && offset > closestOffset) {
      closestOffset = offset;
      closest = card;
    }
  });

  if (closest && closest !== draggedEl.nextSibling) {
  projectList.insertBefore(draggedEl, closest);
} else if (!closest && draggedEl !== projectList.lastChild) {
  projectList.appendChild(draggedEl);
}
// ✅ SMOOTH ANIMATION (ADD THIS)
const newPositions = [...projectList.children].map(el =>
  el.getBoundingClientRect()
);

[...projectList.children].forEach((child, i) => {
  const oldTop = positions[i]?.top;
  const newTop = newPositions[i]?.top;

  if (oldTop != null && newTop != null) {
    const delta = oldTop - newTop;

    if (delta) {
      child.style.transform = `translateY(${delta}px)`;

      requestAnimationFrame(() => {
        child.style.transform = "";
      });
    }
  }
});

positions = newPositions;
}

function endDrag() {
  if (!draggedEl) return;
if (!projectList.contains(draggedEl)) return;

  const newCards = [...projectList.querySelectorAll(".project-card")];

  const newOrder = [];

newCards.forEach(card => {
  const index = Number(card.dataset.index);
  newOrder.push(projects[index]);
});

projects = [...newOrder];

  draggedEl.classList.remove("dragging");
  draggedEl = null;

isDraggingStarted = false;

  save();
  renderProjects();

  document.removeEventListener("touchmove", onMove);
  document.removeEventListener("mousemove", onMove);
  document.removeEventListener("touchend", endDrag);
  document.removeEventListener("mouseup", endDrag);
}

  

  switchTab("homeTab");
  const toggleBtn = document.getElementById("toggleArchiveBtn");
  if (toggleBtn) toggleBtn.classList.add("hidden");

  document.getElementById("addActivityBtn").onclick = () =>
    openModal("New Activity", "Name | daily OR weekly | target(optional)", "activity");

  document.getElementById("backBtn").onclick = () =>
    switchTab("homeTab");

const focusBackBtn = document.getElementById("backFromFocus");

if (focusBackBtn) {
  focusBackBtn.onclick = () => switchTab("homeTab");
}

  document.getElementById("addResourceBtn").onclick = () =>
    openModal("New Resource", "Title | URL | Note", "resource");

  const backBtn = document.getElementById("backToAnalytics");
  if (backBtn) {
    backBtn.onclick = () => switchTab("analyticsTab");
  }

  const archiveBtn = document.getElementById("toggleArchiveBtn");

  if (archiveBtn) {
    archiveBtn.onclick = () => {
      showArchived = !showArchived;

      archiveBtn.textContent = showArchived
        ? "Hide Archived"
        : "Show Archived";

      renderProjects();

      setTimeout(() => {
        archiveBtn.classList.add("hidden");
      }, 3000);
    };
  }
  
  if (searchToggle) {
    searchToggle.onclick = () => {
      searchBarContainer.classList.toggle("hidden");
      if (searchInput) searchInput.focus();
    };
  }

  if (searchInput) {
    let searchTimer;

    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);

      searchTimer = setTimeout(() => {
        const query = searchInput.value.toLowerCase();
        const activeEl = document.querySelector(".tab.active");
        if (!activeEl) return;

        const activeTab = activeEl.id;

        if (activeTab === "homeTab") {
          document.querySelectorAll(".project-card").forEach(card => {
            card.style.display =
  !query || card.textContent.toLowerCase().includes(query)
    ? ""
    : "none";
          });
        }

        if (activeTab === "resourcesTab") {
          document.querySelectorAll("#resourcesList .activity-item").forEach(item => {
            item.style.display =
  !query || item.textContent.toLowerCase().includes(query)
    ? ""
    : "none";
          });
        }
        if (activeTab === "settingsTab") {

          const headers = [...document.querySelectorAll("#settingsTab .card")]
  .filter(el => el.textContent && !el.querySelector("button"));

headers.forEach(header => {
  let hasMatch = false;

  let el = header.nextElementSibling;

  while (el && !el.classList.contains("card")) {
    const text = el.textContent.toLowerCase();
    const match = text.includes(query);

    el.style.display = !query || match ? "" : "none";

    if (match) hasMatch = true;

    el = el.nextElementSibling;
  }

  header.style.display = !query || hasMatch ? "block" : "none";
});
        }
      }, 250);
    });
  }

  let pressTimer;
  let archiveTimeout;

  const header = document.querySelector(".header");

  // ✅ FIX 3: Adding mousedown/up/leave so desktop users can use the header long press
  if (header) {
    const handleHeaderPressStart = () => {
      pressTimer = setTimeout(() => {
        const btn = document.getElementById("toggleArchiveBtn");
        if (!btn) return;

        const hasArchived = (projects || []).some(p => p.archived);
        if (!hasArchived) return;

        btn.classList.remove("hidden");

        if (archiveTimeout) clearTimeout(archiveTimeout);

        archiveTimeout = setTimeout(() => {
          btn.classList.add("hidden");
        }, 3000);

      }, 500);
    };

    const handleHeaderPressEnd = () => {
      clearTimeout(pressTimer);
    };

    header.addEventListener("touchstart", handleHeaderPressStart);
    header.addEventListener("mousedown", handleHeaderPressStart);
    
    header.addEventListener("touchend", handleHeaderPressEnd);
    header.addEventListener("mouseup", handleHeaderPressEnd);
    header.addEventListener("mouseleave", handleHeaderPressEnd);
  }

  const radialMenu = document.getElementById("radialMenu");
  const fab = document.getElementById("addProjectBtn");

  if (fab) {
  fab.addEventListener("click", () => {
    if (isLongPress) return;

    if (radialMenu.classList.contains("open")) {
      radialMenu.classList.remove("open");
      return;
    }

    openModal("New Project", "Project name", "project");
  });
}
  
  let fabPressTimer;

  // ✅ FIX 3: Adding mousedown/up/leave so desktop users can use the FAB long press
  if (fab && radialMenu) {
    const handleFabPressStart = () => {
      isLongPress = false; 

      fabPressTimer = setTimeout(() => {
        isLongPress = true; 

        if (!modalBackdrop.classList.contains("hidden")) {
          closeModal();
        }

        radialMenu.classList.add("open");
      }, 400);
    };

    const handleFabPressEnd = () => {
      clearTimeout(fabPressTimer);
    };

    fab.addEventListener("touchstart", handleFabPressStart);
    fab.addEventListener("mousedown", handleFabPressStart);

    fab.addEventListener("touchend", handleFabPressEnd);
    fab.addEventListener("mouseup", handleFabPressEnd);
    fab.addEventListener("mouseleave", handleFabPressEnd);
  }

  document.addEventListener("click", (e) => {
    if (!radialMenu || !fab) return;

    if (!radialMenu.contains(e.target) && !fab.contains(e.target)) {
      radialMenu.classList.remove("open");
    }
  });

  document.querySelectorAll(".radial-item").forEach(item => {
    item.onclick = () => {
      const action = item.dataset.action;

      if (action === "today") {
        showToast("Today plan coming soon");
      }

      if (action === "archive") {
  showArchived = !showArchived; // 🔥 toggle ON/OFF
  switchTab("homeTab"); // go to projects tab
  
}

      if (action === "focus") {
  switchTab("focusTab");
  renderFocusMode();
}

      radialMenu.classList.remove("open");
    };
  });

});

function showToast(message) {
  const toast = document.getElementById("toast");
if (!toast) return;
  toast.textContent = message;

  toast.classList.remove("hidden");
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 300);
  }, 2000);
}

function openAnalyticsDetail(index) {
  if (!projects[index]) {
    switchTab("analyticsTab");
    return;
  }
  const project = projects[index];

  const titleEl = document.getElementById("analyticsProjectTitle");
if (titleEl) titleEl.textContent = project.name;

  const container = document.getElementById("analyticsDetailContent");
if (!container) return;
  container.innerHTML = `
  <div class="analytics-grid">

    <div class="card large">
      <h3>Weekly Activity</h3>
      <canvas id="weeklyChart"></canvas>
    </div>

    <div class="card">
      <h3>Completion</h3>
      <div class="progress-circle">
        <span id="progressValue">0%</span>
      </div>
    </div>

    <div class="card">
      <h3>Stats</h3>
      <div id="miniStats"></div>
    </div>

  </div>
`;

  // ===== ACTIVITY MAP =====
  const mapCard = document.createElement("div");
  mapCard.className = "card";

  const mapTitle = document.createElement("h3");
  mapTitle.textContent = "Activity Map";

  const map = document.createElement("div");
  map.className = "calendar-grid";
  map.style.width = "max-content";

  const days = 84;
  const todayDate = new Date();
  let data = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() - i);
    const dateStr = formatLocalDate(d);

    let count = 0;
    project.activities.forEach(a => {
      if (a.history?.[dateStr]) count++;
    });

    data.push({ date: dateStr, count });
  }

  const weeks = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  weeks.forEach(week => {
    const col = document.createElement("div");
    col.className = "calendar-column";

    week.forEach(day => {
      const box = document.createElement("div");
      box.className = "calendar-box level-" + Math.min(day.count, 4);
      box.title = `${day.date} → ${day.count} activities`;

      if (day.date === today()) {
        box.dataset.today = "true";
      }

      col.appendChild(box);
    });

    map.appendChild(col);
  });

  // ===== ADD TO CARD =====
  const scrollWrapper = document.createElement("div");
  scrollWrapper.className = "calendar-wrapper";
  scrollWrapper.style.overflowX = "auto";
  scrollWrapper.style.padding = "0 10px";

  const inner = document.createElement("div");
  inner.style.display = "inline-flex";
  inner.style.flexDirection = "column";

  inner.append(map);
  scrollWrapper.append(inner);

  mapCard.append(mapTitle, scrollWrapper);

  setTimeout(() => {
    scrollWrapper.scrollTo({
      left: scrollWrapper.scrollWidth,
    });
  }, 100);

  // ===== STATS =====
  const statsCard = document.createElement("div");
  statsCard.className = "card";

  const t = today();
  const y = yesterday();
  const week = getCurrentWeekDates();

  let doneToday = 0;
  let missedYesterday = 0;
  let doneWeek = 0;

 project.activities.forEach(a => {
  let done = 0;

  week.forEach(d => {
    if (a.history?.[d]) done++;
  });

  // weekly vs daily handling
  if (a.frequency === "weekly") {
    doneWeek += Math.min(done, a.target);
  } else {
    doneWeek += done;
  }

  // ✅ moved inside loop
  if (a.history?.[t]) doneToday++;

  const history = a.history || {};
  const streak = getStreak(history);

  if (!(y in history) && streak > 0) {
    missedYesterday++;
  }
});

  let totalTargets = 0;

project.activities.forEach(a => {
  if (a.frequency === "daily") {
  totalTargets += week.length;
}
else {
    totalTargets += a.target;
  }
});

const percent = totalTargets
  ? Math.round((doneWeek / totalTargets) * 100)
  : 0;

  statsCard.innerHTML = `
    <div class="analytics-row"><span>Activities</span><span>${project.activities.length}</span></div>
    <div class="analytics-row"><span>Done today</span><span>${doneToday}</span></div>
    <div class="analytics-row"><span>Missed yesterday</span><span>${missedYesterday}</span></div>
    <div class="analytics-row"><span>Weekly completion</span><span>${percent}%</span></div>
  `;

  const miniStats = document.getElementById("miniStats");

  miniStats.innerHTML = `
    <div class="analytics-row"><span>Activities</span><span>${project.activities.length}</span></div>
    <div class="analytics-row"><span>Done today</span><span>${doneToday}</span></div>
    <div class="analytics-row"><span>Missed</span><span>${missedYesterday}</span></div>
    <div class="analytics-row"><span>Weekly</span><span>${percent}%</span></div>
  `;

  container.prepend(mapCard);

  switchTab("analyticsDetailTab");

  // ===== WEEKLY CHART =====
  requestAnimationFrame(() => {

    const ctx = document.getElementById("weeklyChart");

    if (ctx) {
      const weekData = getCurrentWeekDates();
const activities = project.activities;

const data = weekData.map(d => {
  let count = 0;

  for (let i = 0; i < activities.length; i++) {
    if (activities[i].history?.[d]) {
      count++;
    }
  }

  return count;
});

      if (weeklyChartInstance) {
        weeklyChartInstance.destroy();
        weeklyChartInstance = null;
      }

      weeklyChartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: weekData.map(d => {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}),
          datasets: [{
            data: data,
            tension: 0.4, 
            fill: true,

            borderWidth: 2,
            borderColor: "#3b82f6",

            pointRadius: 4,
            pointBackgroundColor: "#3b82f6",

            backgroundColor: (ctx) => {
              const chart = ctx.chart;
              const {ctx: c, chartArea} = chart;

              if (!chartArea) return "rgba(59,130,246,0.2)";

              const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, "rgba(59,130,246,0.4)");
              gradient.addColorStop(1, "rgba(59,130,246,0.05)");

              return gradient;
            }
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,

          layout: {   
            padding: {
              bottom: 20
            }
          },

          plugins: { legend: { display: false } },

          animation: {
            duration: 900,
            easing: "easeOutBounce"
          },

          elements: {
            line: {
              borderJoinStyle: "round"
            }
          },

          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#aaa" }
            },
            y: {
              display: false
            }
          }
        }
      });
    }

  });

  // ===== PROGRESS CIRCLE =====

  const progress = document
    .getElementById("analyticsDetailTab")
    .querySelector(".progress-circle");

  const progressText = document.getElementById("progressValue");

  if (progress && progressText) {
    setTimeout(() => {
      progress.style.setProperty(
        "--progress",
        `conic-gradient(#60a5fa ${percent}%, rgba(255,255,255,0.05) ${percent}%)`
      );
    }, 50);

    progressText.textContent = percent + "%";
  }
}

function showUndoToast() {
  const toast = document.getElementById("toast");
if (!toast) return;

  toast.innerHTML = `
  <span>Project deleted</span>
  <button id="undoBtn" class="undo-btn">Undo</button>
 `;

  toast.classList.remove("hidden");
  toast.classList.add("show");

  document.getElementById("undoBtn").onclick = () => {
    if (lastDeletedProject) {
      const safeIndex = Math.min(
        lastDeletedProject.index,
        projects.length
      );

      projects.splice(
        safeIndex,
        0,
        lastDeletedProject.data
      );
      save();
      renderProjects();
    }

    toast.classList.remove("show");
    toast.classList.add("hidden");
  };

  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hidden");
    lastDeletedProject = null;
  }, 5000);
}

function renderFocusMode() {
  const root = document.getElementById("focusContent");
  const progressContainer = document.querySelector(".focus-progress");

  if (!root) return;

  root.innerHTML = "";

  if (projects.length === 0) {
    root.innerHTML = `
      <div class="card">
        <p>No projects yet</p>
        <small style="opacity:0.6;">Create a project to start focus mode</small>
      </div>
    `;
    if (progressContainer) progressContainer.style.display = "none";
    return;
  }

  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");

  let total = 0;
let done = 0;
const t = today();

// ✅ COUNT FIRST
projects.forEach((p) => {
  if (p.archived) return;

  p.activities.forEach((a) => {
    total++;

    if (t in (a.history || {})) {
      done++;
    }
  });
});

// ✅ RENDER AFTER
projects.forEach((p) => {
  if (p.archived) return;

  p.activities.forEach((a) => {

    let showTask = false;

    if (a.frequency === "daily") {
      showTask = !(t in (a.history || {}));
    } else {
      const week = getCurrentWeekDates();
      let count = 0;

      week.forEach(d => {
        if (a.history?.[d]) count++;
      });

      showTask = count < a.target;
    }

    if (!showTask) return; // ✅ IMPORTANT

    const row = document.createElement("div");
    row.className = "activity-item focus-task";

    const meta = document.createElement("div");
    meta.className = "activity-meta";

    const name = document.createElement("div");
    name.className = "activity-name";
    name.textContent = a.name;

    const project = document.createElement("div");
    project.className = "activity-status";
    project.textContent = p.name;

    meta.append(name, project);

    const toggle = document.createElement("div");
    toggle.className = "toggle";

    toggle.onclick = () => {
  if (a.frequency === "daily") {
    a.history[t] = true;
  } else {
    const week = getCurrentWeekDates();
    let count = 0;

    week.forEach(d => {
      if (a.history?.[d]) count++;
    });

    if (count < a.target) {
      a.history[t] = true;
    }
  }

      row.style.opacity = "0";
      row.style.transform = "translateX(20px)";

      setTimeout(() => {
        save();
        renderFocusMode();
      }, 200);
    };

    row.append(meta, toggle);
    root.appendChild(row);
  });
});

  // ===== PROGRESS =====
  if (progressText && progressFill) {
    if (total === 0) {
      if (progressContainer) progressContainer.style.display = "none";
    } else {
      if (progressContainer) progressContainer.style.display = "block";
    }

    const percent = total ? Math.round((done / total) * 100) : 0;

    progressText.textContent = `${done}/${total} tasks done`;

    requestAnimationFrame(() => {
      progressFill.style.transition = "width 0.4s ease";
progressFill.style.width = percent + "%";
    });
  }
}

function openExternal(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

// ✅ REGISTER SERVICE WORKER
if ("serviceWorker" in navigator) {
  
    .then(() => console.log("SW registered"))
    .catch(err => console.log("SW failed", err));
}



// 🔥 START REMINDER SYSTEM

setInterval(checkDailyReminder, 1000 * 60 * 30); // every 30 mins

setTimeout(checkDailyReminder, 5000); // run once after load
