/* global rd */
const $ = (sel) => document.querySelector(sel);

const userBox = $("#userBox");
const subscriptionBox = $("#subscriptionBox");
const torrentsBox = $("#torrentsBox");
const downloadsBox = $("#downloadsBox");

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
    dlg.addEventListener("close", () => resolve(dlg.returnValue), {
      once: true,
    });
  });
  if (result === "ok") {
    const value = input.value.trim();
    if (value) {
      await api.setToken(value);
    }
  }
}

async function loadUser() {
  try {
    userBox.textContent = "Loading…";
    const u = await api.getUser();

    const totalHours = u?.premium / 3600;
    const d = Math.floor(totalHours / 24);
    const h = Math.floor(totalHours % 24);
    const daysLeftStr = `${d} days ${h} hours`;

    const premium = d > 0 ? "Premium" : "Free";
    const email = u?.email || u?.username || "—";
    const expiration = u?.expiration || u?.expire || "—";

    userBox.innerHTML = `
      <div class="row">
        <span class="pill">${premium}</span>
      </div>
      <div style="margin-top:8px;">
        <div><strong>User:</strong> ${escapeHtml(email)}</div>
        <div><strong>Expires:</strong> ${escapeHtml(String(expiration))}</div>
        <div class="muted"><strong>ID:</strong> ${escapeHtml(
          String(u?.id ?? "—")
        )}</div>
      </div>`;

    subscriptionBox.textContent = "Loading…";
    subscriptionBox.innerHTML =
      d + h / 24 > 0
        ? `
    <div style="font-size: 3rem; font-weight: bold; margin-bottom: 8px;">
      ${daysLeftStr}
    </div>
    <div class="muted">left</div>
  `
        : `<div class="danger"><strong>Subscription:</strong> Expired or none</div>`;
  } catch (e) {
    userBox.innerHTML = `<span class="danger">Failed to load user: ${escapeHtml(
      e.message
    )}</span>`;
  }
}

async function loadDownloads() {
  try {
    downloadsBox.textContent = "Loading…";
    const d = await api.getDownloads({ limit: 25 });
    if (Array.isArray(d) && d.length) {
      const rows = d
        .map(
          (it) => `
        <tr>
          <td>${escapeHtml(it?.filename || it?.id || "—")}</td>
          <td>${fmtBytes(it?.bytes || it?.filesize || 0)}</td>
          <td>${escapeHtml(
            new Date(it?.download || it?.added || Date.now()).toLocaleString()
          )}</td>
        </tr>
      `
        )
        .join("");
      downloadsBox.innerHTML = `<table>
        <thead><tr><th>Name</th><th>Size</th><th>When</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    } else {
      downloadsBox.innerHTML = `<span class="ghost">No recent downloads.</span>`;
    }
  } catch (e) {
    downloadsBox.innerHTML = `<span class="danger">Failed to load downloads: ${escapeHtml(
      e.message
    )}</span>`;
  }
}

async function loadTorrents() {
  try {
    torrentsBox.textContent = "Loading…";
    const list = await api.getTorrents({ limit: 25, page: 1 });
    if (Array.isArray(list) && list.length) {
      const rows = list
        .map(
          (t) => `
        <tr>
          <td>${escapeHtml(t?.filename || t?.title || t?.id || "—")}</td>
          <td>${escapeHtml(
            t?.status || t?.progress ? `${t?.progress}%` : "—"
          )}</td>
          <td>${fmtBytes(t?.bytes || t?.filesize || 0)}</td>
          <td>${escapeHtml(
            new Date(t?.added || Date.now()).toLocaleString()
          )}</td>
        </tr>
      `
        )
        .join("");
      torrentsBox.innerHTML = `<table>
        <thead><tr><th>Torrent</th><th>Status</th><th>Size</th><th>Added</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    } else {
      torrentsBox.innerHTML = `<span class="ghost">No torrents to show.</span>`;
    }
  } catch (e) {
    torrentsBox.innerHTML = `<span class="danger">Failed to load torrents: ${escapeHtml(
      e.message
    )}</span>`;
  }
}

document.getElementById("buyDays").addEventListener("click", async () => {
  try {
    await api.open("https://real-debrid.com/offers-3");
  } catch (e) {
    console.error(e);
    alert("Could not open the subscription page.");
  }
});

function fmtBytes(n) {
  if (!n || isNaN(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = Number(n);
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}

async function refreshAll() {
  await ensureToken();
  await Promise.all([loadUser(), loadDownloads(), loadTorrents()]);
}

document.getElementById("refresh").addEventListener("click", refreshAll);
document.getElementById("setToken").addEventListener("click", openTokenModal);
document.getElementById("clearToken").addEventListener("click", async () => {
  await rd.clearToken();
  userBox.innerHTML =
    trafficBox.innerHTML =
    torrentsBox.innerHTML =
    downloadsBox.innerHTML =
      '<span class="ghost">Token cleared.</span>';
});

refreshAll().catch(console.error);
