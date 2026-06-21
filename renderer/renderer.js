/* global api */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── DOM refs ────────────────────────────────────────────────────────────────
const userBox = $("#userBox");
const subscriptionBox = $("#subscriptionBox");
const dashTorrentsBox = $("#dashTorrentsBox");
const torrentsBox = $("#torrentsBox");
const downloadsBox = $("#downloadsBox");
const toastContainer = $("#toastContainer");

// ─── State ───────────────────────────────────────────────────────────────────
let torrentPage = 1;
let downloadOffset = 0;
const PAGE_SIZE = 25;
let autoRefreshTimer = null;
let allTorrents = [];
let allDownloads = [];

// ─── Tabs ────────────────────────────────────────────────────────────────────
$$(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".tab-btn").forEach((b) => b.classList.remove("active"));
    $$(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(`#panel-${btn.dataset.tab}`).classList.add("active");
  });
});

// ─── Toast Notifications ─────────────────────────────────────────────────────
function showToast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── Token Management ────────────────────────────────────────────────────────
async function ensureToken() {
  const token = await api.getToken();
  if (!token) {
    await openTokenModal();
  }
}

async function openTokenModal() {
  const dlg = document.getElementById("tokenModal");
  const input = document.getElementById("tokenInput");
  input.value = "";
  dlg.showModal();
  const result = await new Promise((resolve) => {
    dlg.addEventListener("close", () => resolve(dlg.returnValue), { once: true });
  });
  if (result === "ok") {
    const value = input.value.trim();
    if (value) {
      // Validate token before saving
      try {
        await api.setToken(value);
        await api.getUser(); // Test the token
        showToast("Token saved successfully!", "success");
      } catch (e) {
        await api.clearToken();
        showToast("Invalid token – could not authenticate", "error");
      }
    }
  }
}

// ─── Dashboard: User ─────────────────────────────────────────────────────────
async function loadUser() {
  try {
    userBox.textContent = "Loading…";
    const u = await api.getUser();

    const totalHours = (u?.premium || 0) / 3600;
    const d = Math.floor(totalHours / 24);
    const h = Math.floor(totalHours % 24);
    const daysLeftStr = `${d}d ${h}h`;

    const premium = d > 0 ? "Premium" : "Free";
    const email = u?.email || u?.username || "—";
    const expiration = u?.expiration || u?.expire || "—";

    userBox.innerHTML = `
      <div class="row">
        <span class="pill ${d > 0 ? "premium" : ""}">${premium}</span>
      </div>
      <div style="margin-top:8px;">
        <div><strong>User:</strong> ${escapeHtml(email)}</div>
        <div><strong>Expires:</strong> ${escapeHtml(String(expiration))}</div>
        <div class="muted"><strong>ID:</strong> ${escapeHtml(String(u?.id ?? "—"))}</div>
      </div>`;

    subscriptionBox.innerHTML = d + h / 24 > 0
      ? `<div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:2.5rem;font-weight:bold;line-height:1">${daysLeftStr}</div>
          <div class="muted">remaining</div>
          <button id="buyDays" class="btn primary" style="margin-left:auto;">Add Days</button>
        </div>`
      : `<div class="danger" style="display:flex;align-items:center;gap:12px;">
          <strong>Expired or none</strong>
          <button id="buyDays" class="btn primary">Add Days</button>
        </div>`;

    document.getElementById("buyDays")?.addEventListener("click", () => {
      api.open("https://real-debrid.com/offers-3");
    });
  } catch (e) {
    userBox.innerHTML = `<span class="danger">Failed: ${escapeHtml(e.message)}</span>`;
  }
}

// ─── Shared Torrent Fetch (single API call, reused everywhere) ─────────
let cachedTorrentList = [];

async function fetchTorrentsOnce() {
  const list = await api.getTorrents({ limit: 50, page: 1 });
  cachedTorrentList = Array.isArray(list) ? list : [];
  return cachedTorrentList;
}

// ─── Dashboard: Failed & Stuck Download Detector ───────────────────────────────
const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
let previousTorrentState = new Map(); // id -> { progress, timestamp }

// RD error statuses that indicate a failed torrent
const FAILED_STATUSES = [
  "error",
  "dead",
  "virus",
  "magnet_error",
  "magnet_conversion",
  "compressing",
];

function isFailedStatus(status) {
  if (!status) return false;
  const s = status.toLowerCase();
  return FAILED_STATUSES.includes(s) || s.includes("error");
}

function checkStuckDownloads(list) {
  if (!Array.isArray(list)) return;

  const now = Date.now();
  const stuck = [];
  const failed = [];

  for (const t of list) {
    // Check for failed/errored torrents
    if (isFailedStatus(t.status)) {
      failed.push(t);
      continue;
    }

    // Check for stuck (downloading but no progress)
    if (t.status !== "downloading") continue;

    const prev = previousTorrentState.get(t.id);
    if (prev) {
      if (t.progress === prev.progress) {
        if (now - prev.timestamp >= STUCK_THRESHOLD_MS) {
          stuck.push(t);
        }
      } else {
        previousTorrentState.set(t.id, { progress: t.progress, timestamp: now });
      }
    } else {
      previousTorrentState.set(t.id, { progress: t.progress, timestamp: now });
    }
  }

  // Clean up entries for torrents no longer in the list
  const activeIds = new Set(list.map((t) => t.id));
  for (const id of previousTorrentState.keys()) {
    if (!activeIds.has(id)) previousTorrentState.delete(id);
  }

  renderFailedDownloads(failed);
  renderStuckDownloads(stuck);
}

// ─── Failed Downloads ───────────────────────────────────────────────────
function renderFailedDownloads(failed) {
  const card = $("#failedCard");
  const box = $("#failedBox");

  if (!failed.length) {
    card.style.display = "none";
    return;
  }

  card.style.display = "";
  const rows = failed
    .map((t) => `<tr>
      <td>${escapeHtml(truncate(t.filename || t.title || "—", 40))}</td>
      <td><span class="danger">${escapeHtml(t.status || "error")}</span></td>
      <td>${fmtBytes(t.bytes || 0)}</td>
      <td>${escapeHtml(new Date(t.added || Date.now()).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" }))}</td>
      <td><button class="btn sm danger" data-cancel-failed="${t.id}">Remove</button></td>
    </tr>`)
    .join("");

  box.innerHTML = `<table>
    <thead><tr><th>Name</th><th>Error</th><th>Size</th><th>Added</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  box.querySelectorAll("[data-cancel-failed]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api.deleteTorrent(btn.dataset.cancelFailed);
        showToast("Failed torrent removed", "success");
        await refreshTorrentsAll();
      } catch (e) {
        showToast(`Remove failed: ${e.message}`, "error");
      }
    });
  });
}

// Cancel all failed button
document.getElementById("cancelAllFailed")?.addEventListener("click", async () => {
  const box = $("#failedBox");
  const btns = box.querySelectorAll("[data-cancel-failed]");
  if (!btns.length) return;

  if (!confirm(`Remove ${btns.length} failed torrent(s)?`)) return;

  let removed = 0;
  for (const btn of btns) {
    try {
      await api.deleteTorrent(btn.dataset.cancelFailed);
      removed++;
    } catch (e) { /* continue */ }
  }
  showToast(`Removed ${removed} failed torrent(s)`, "success");
  await refreshTorrentsAll();
});

function renderStuckDownloads(stuck) {
  const card = $("#stuckCard");
  const box = $("#stuckBox");

  if (!stuck.length) {
    card.style.display = "none";
    return;
  }

  card.style.display = "";
  const rows = stuck
    .map((t) => `<tr>
      <td>${escapeHtml(truncate(t.filename || t.title || "—", 45))}</td>
      <td>${t.progress || 0}%</td>
      <td>${fmtBytes(t.bytes || 0)}</td>
      <td><button class="btn sm danger" data-cancel-stuck="${t.id}">Cancel</button></td>
    </tr>`)
    .join("");

  box.innerHTML = `<table>
    <thead><tr><th>Name</th><th>Progress</th><th>Size</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  // Individual cancel buttons
  box.querySelectorAll("[data-cancel-stuck]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api.deleteTorrent(btn.dataset.cancelStuck);
        previousTorrentState.delete(btn.dataset.cancelStuck);
        showToast("Stuck torrent canceled", "success");
        await refreshTorrentsAll();
      } catch (e) {
        showToast(`Cancel failed: ${e.message}`, "error");
      }
    });
  });
}

// Cancel all stuck button
document.getElementById("cancelAllStuck")?.addEventListener("click", async () => {
  const card = $("#stuckCard");
  const box = $("#stuckBox");
  const btns = box.querySelectorAll("[data-cancel-stuck]");
  if (!btns.length) return;

  if (!confirm(`Cancel ${btns.length} stuck torrent(s)?`)) return;

  let canceled = 0;
  for (const btn of btns) {
    try {
      await api.deleteTorrent(btn.dataset.cancelStuck);
      previousTorrentState.delete(btn.dataset.cancelStuck);
      canceled++;
    } catch (e) { /* continue */ }
  }
  showToast(`Canceled ${canceled} stuck torrent(s)`, "success");
  await refreshTorrentsAll();
});

// ─── Dashboard: Latest Torrents ──────────────────────────────────────────────
function renderDashTorrents(list) {
  if (!list.length) {
    dashTorrentsBox.innerHTML = `<span class="ghost">No torrents yet.</span>`;
    return;
  }

  const rows = list
    .slice(0, 20)
    .map((t) => {
      const progress = t.progress || 0;
      const status = t.status || "unknown";
      const progressBar = `<div class="progress-bar ${progress >= 100 ? "done" : ""}">
        <div class="fill" style="width:${progress}%"></div>
      </div>`;
      return `<tr>
        <td title="${escapeHtml(t.filename || "")}">${escapeHtml(truncate(t.filename || t.title || "—", 45))}</td>
        <td>${escapeHtml(status)} ${progress}%<br>${progressBar}</td>
        <td>${fmtBytes(t.bytes || t.filesize || 0)}</td>
        <td>${escapeHtml(new Date(t.added || Date.now()).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" }))}</td>
      </tr>`;
    })
    .join("");

  dashTorrentsBox.innerHTML = `<table>
    <thead><tr><th>Name</th><th>Status</th><th>Size</th><th>Added</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ─── Torrents Tab ────────────────────────────────────────────────────────────
async function loadTorrents() {
  // Only make a separate API call if user navigated beyond page 1
  if (torrentPage !== 1) {
    try {
      torrentsBox.textContent = "Loading…";
      const list = await api.getTorrents({ limit: PAGE_SIZE, page: torrentPage });
      allTorrents = Array.isArray(list) ? list : [];
      renderTorrents();
      renderTorrentsPagination();
    } catch (e) {
      torrentsBox.innerHTML = `<span class="danger">Failed: ${escapeHtml(e.message)}</span>`;
    }
  } else {
    // Reuse cached data from the shared fetch (no extra API call)
    allTorrents = cachedTorrentList.slice(0, PAGE_SIZE);
    renderTorrents();
    renderTorrentsPagination();
  }
}

/**
 * Single function that fetches torrents ONCE and updates all views:
 * dashboard, stuck/failed detector, and torrents tab (page 1).
 */
async function refreshTorrentsAll() {
  try {
    dashTorrentsBox.textContent = "Loading…";
    if (torrentPage === 1) torrentsBox.textContent = "Loading…";
    const list = await fetchTorrentsOnce();
    renderDashTorrents(list);
    checkStuckDownloads(list);
    loadTorrents();
  } catch (e) {
    dashTorrentsBox.innerHTML = `<span class="danger">Failed: ${escapeHtml(e.message)}</span>`;
    torrentsBox.innerHTML = `<span class="danger">Failed: ${escapeHtml(e.message)}</span>`;
  }
}

function renderTorrents() {
  const filter = ($("#torrentSearch")?.value || "").toLowerCase();
  const filtered = allTorrents.filter(
    (t) => !filter || (t.filename || t.title || "").toLowerCase().includes(filter)
  );

  if (!filtered.length) {
    torrentsBox.innerHTML = `<span class="ghost">No torrents to show.</span>`;
    return;
  }

  const rows = filtered
    .map((t) => {
      const progress = t.progress || 0;
      const status = t.status || "unknown";
      const progressBar = `<div class="progress-bar ${progress >= 100 ? "done" : ""}">
        <div class="fill" style="width:${progress}%"></div>
      </div>`;

      return `<tr>
        <td title="${escapeHtml(t.filename || "")}">${escapeHtml(truncate(t.filename || t.title || t.id || "—", 50))}</td>
        <td>${escapeHtml(status)} ${progress}%<br>${progressBar}</td>
        <td>${fmtBytes(t.bytes || t.filesize || 0)}</td>
        <td>${escapeHtml(new Date(t.added || Date.now()).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" }))}</td>
        <td>
          <button class="btn sm danger" data-delete-torrent="${t.id}">✕</button>
        </td>
      </tr>`;
    })
    .join("");

  torrentsBox.innerHTML = `<table>
    <thead><tr><th>Name</th><th>Status</th><th>Size</th><th>Added</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  // Attach delete handlers
  torrentsBox.querySelectorAll("[data-delete-torrent]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.deleteTorrent;
      if (!confirm("Delete this torrent?")) return;
      try {
        await api.deleteTorrent(id);
        showToast("Torrent deleted", "success");
        loadTorrents();
      } catch (e) {
        showToast(`Delete failed: ${e.message}`, "error");
      }
    });
  });
}

function renderTorrentsPagination() {
  const pag = $("#torrentsPagination");
  pag.innerHTML = `
    <button class="btn sm" id="torrentPrev" ${torrentPage <= 1 ? "disabled" : ""}>← Prev</button>
    <span class="page-info">Page ${torrentPage}</span>
    <button class="btn sm" id="torrentNext" ${allTorrents.length < PAGE_SIZE ? "disabled" : ""}>Next →</button>
  `;
  $("#torrentPrev")?.addEventListener("click", () => {
    if (torrentPage > 1) { torrentPage--; loadTorrents(); }
  });
  $("#torrentNext")?.addEventListener("click", () => {
    if (allTorrents.length >= PAGE_SIZE) { torrentPage++; loadTorrents(); }
  });
}

// Filter on type
$("#torrentSearch")?.addEventListener("input", renderTorrents);

// ─── Downloads ───────────────────────────────────────────────────────────────
async function loadDownloads() {
  try {
    downloadsBox.textContent = "Loading…";
    const list = await api.getDownloads({ limit: PAGE_SIZE, offset: downloadOffset });
    allDownloads = Array.isArray(list) ? list : [];
    renderDownloads();
    renderDownloadsPagination();
  } catch (e) {
    downloadsBox.innerHTML = `<span class="danger">Failed: ${escapeHtml(e.message)}</span>`;
  }
}

function renderDownloads() {
  const filter = ($("#downloadSearch")?.value || "").toLowerCase();
  const filtered = allDownloads.filter(
    (d) => !filter || (d.filename || "").toLowerCase().includes(filter)
  );

  if (!filtered.length) {
    downloadsBox.innerHTML = `<span class="ghost">No recent downloads.</span>`;
    return;
  }

  const rows = filtered
    .map((it) => `<tr>
      <td title="${escapeHtml(it.filename || "")}">${escapeHtml(truncate(it.filename || it.id || "—", 50))}</td>
      <td>${fmtBytes(it.filesize || it.bytes || 0)}</td>
      <td>${escapeHtml(new Date(it.generated || it.download || Date.now()).toLocaleDateString())}</td>
      <td>
        ${it.download ? `<a href="#" class="btn sm" data-open-link="${escapeHtml(it.download)}">Open</a>` : ""}
        <button class="btn sm danger" data-delete-download="${it.id}">✕</button>
      </td>
    </tr>`)
    .join("");

  downloadsBox.innerHTML = `<table>
    <thead><tr><th>Name</th><th>Size</th><th>Date</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  // Open link handlers
  downloadsBox.querySelectorAll("[data-open-link]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      api.open(a.dataset.openLink);
    });
  });

  // Delete handlers
  downloadsBox.querySelectorAll("[data-delete-download]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.deleteDownload;
      if (!confirm("Delete this download?")) return;
      try {
        await api.deleteDownload(id);
        showToast("Download deleted", "success");
        loadDownloads();
      } catch (e) {
        showToast(`Delete failed: ${e.message}`, "error");
      }
    });
  });
}

function renderDownloadsPagination() {
  const pag = $("#downloadsPagination");
  const currentPage = Math.floor(downloadOffset / PAGE_SIZE) + 1;
  pag.innerHTML = `
    <button class="btn sm" id="dlPrev" ${downloadOffset <= 0 ? "disabled" : ""}>← Prev</button>
    <span class="page-info">Page ${currentPage}</span>
    <button class="btn sm" id="dlNext" ${allDownloads.length < PAGE_SIZE ? "disabled" : ""}>Next →</button>
  `;
  $("#dlPrev")?.addEventListener("click", () => {
    if (downloadOffset > 0) { downloadOffset -= PAGE_SIZE; loadDownloads(); }
  });
  $("#dlNext")?.addEventListener("click", () => {
    if (allDownloads.length >= PAGE_SIZE) { downloadOffset += PAGE_SIZE; loadDownloads(); }
  });
}

$("#downloadSearch")?.addEventListener("input", renderDownloads);

// ─── Unrestrict ──────────────────────────────────────────────────────────────
$("#unrestrictBtn")?.addEventListener("click", async () => {
  const input = $("#unrestrictInput");
  const link = input.value.trim();
  const resultBox = $("#unrestrictResult");

  if (!link || !/^https?:\/\//i.test(link)) {
    showToast("Please enter a valid URL", "error");
    return;
  }

  resultBox.innerHTML = `<span class="muted">Unrestricting…</span>`;
  try {
    const result = await api.unrestrict(link);
    resultBox.innerHTML = `
      <div class="success" style="margin-bottom:8px;">✓ Unrestricted successfully!</div>
      <div><strong>File:</strong> ${escapeHtml(result.filename || "—")}</div>
      <div><strong>Size:</strong> ${fmtBytes(result.filesize || 0)}</div>
      <div style="margin-top:8px;">
        <a href="#" class="btn primary" id="openUnrestricted">Open Download Link</a>
      </div>`;
    $("#openUnrestricted")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (result.download) api.open(result.download);
    });
    input.value = "";
    showToast("Link unrestricted!", "success");
  } catch (e) {
    resultBox.innerHTML = `<span class="danger">Failed: ${escapeHtml(e.message)}</span>`;
    showToast("Unrestrict failed", "error");
  }
});

// ─── Add Magnet ──────────────────────────────────────────────────────────────
$("#magnetBtn")?.addEventListener("click", async () => {
  const input = $("#magnetInput");
  const magnet = input.value.trim();
  const resultBox = $("#magnetResult");

  if (!magnet || !magnet.startsWith("magnet:")) {
    showToast("Please enter a valid magnet link", "error");
    return;
  }

  resultBox.innerHTML = `<span class="muted">Adding torrent…</span>`;
  try {
    const result = await api.addMagnet(magnet);
    // Auto-select all files
    if (result?.id) {
      await api.selectFiles(result.id, "all");
    }
    resultBox.innerHTML = `<div class="success">✓ Torrent added! ID: ${escapeHtml(result?.id || "—")}</div>`;
    input.value = "";
    showToast("Torrent added successfully!", "success");
    loadTorrents();
  } catch (e) {
    resultBox.innerHTML = `<span class="danger">Failed: ${escapeHtml(e.message)}</span>`;
    showToast("Failed to add torrent", "error");
  }
});

// ─── Settings ────────────────────────────────────────────────────────────────
async function loadSettings() {
  const refreshInterval = (await api.getSetting("refreshInterval")) ?? 60;
  const minimizeToTray = (await api.getSetting("minimizeToTray")) ?? true;
  const clipboardMonitor = (await api.getSetting("clipboardMonitor")) ?? false;

  $("#settingRefreshInterval").value = refreshInterval;
  $("#settingMinimizeToTray").checked = minimizeToTray;
  $("#settingClipboard").checked = clipboardMonitor;

  setupAutoRefresh(refreshInterval);
}

$("#settingRefreshInterval")?.addEventListener("change", (e) => {
  const val = parseInt(e.target.value, 10) || 0;
  api.setSetting("refreshInterval", val);
  setupAutoRefresh(val);
});

$("#settingMinimizeToTray")?.addEventListener("change", (e) => {
  api.setSetting("minimizeToTray", e.target.checked);
});

$("#settingClipboard")?.addEventListener("change", (e) => {
  api.setSetting("clipboardMonitor", e.target.checked);
});

// ─── Auto Refresh ────────────────────────────────────────────────────────────
function setupAutoRefresh(seconds) {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  const interval = Math.max(seconds, seconds > 0 ? 30 : 0); // minimum 30s to avoid rate limits
  if (interval > 0) {
    autoRefreshTimer = setInterval(() => {
      refreshTorrentsAll();
      loadDownloads();
    }, interval * 1000);
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function fmtBytes(n) {
  if (!n || isNaN(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = Number(n);
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function refreshAll() {
  await ensureToken();
  await Promise.all([loadUser(), refreshTorrentsAll(), loadDownloads()]);
}

document.getElementById("refresh").addEventListener("click", refreshAll);
document.getElementById("setToken").addEventListener("click", openTokenModal);
document.getElementById("clearToken").addEventListener("click", async () => {
  await api.clearToken();
  userBox.innerHTML =
    subscriptionBox.innerHTML =
    dashTorrentsBox.innerHTML =
    torrentsBox.innerHTML =
    downloadsBox.innerHTML =
      '<span class="ghost">Token cleared.</span>';
  showToast("Token cleared", "info");
});

// Init
(async () => {
  await loadSettings();
  await refreshAll();
})().catch(console.error);
