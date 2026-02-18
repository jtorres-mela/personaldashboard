const DEFAULT_BASE = "http://127.0.0.1:3000";
const STORAGE_KEY = "dashboardApiBase";

const statusText = document.getElementById("statusText");
const openBtn = document.getElementById("openBtn");
const retryBtn = document.getElementById("retryBtn");
const saveBtn = document.getElementById("saveBtn");
const apiBaseInput = document.getElementById("apiBase");

function storageGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key]));
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}

function setStatus(kind, message) {
  statusText.classList.remove("status--online", "status--offline", "status--pending");
  statusText.classList.add(kind);
  statusText.textContent = message;
}

function showUi() {
  document.body.classList.remove("booting");
}

function normalizeBase(input) {
  const raw = (input || "").trim();
  if (!raw) return DEFAULT_BASE;
  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return DEFAULT_BASE;
  }
}

async function getBase() {
  const stored = await storageGet(STORAGE_KEY);
  const base = normalizeBase(stored);
  apiBaseInput.value = base;
  return base;
}

async function checkHealth(base) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${base}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const body = await res.json();
      if (body && body.ok === true) return { online: true, mode: "health" };
    }
    if (res.status === 404) {
      const rootRes = await fetch(`${base}/`, { method: "GET" });
      if (rootRes.ok) return { online: true, mode: "legacy" };
    }
    return { online: false, mode: "offline" };
  } catch {
    return { online: false, mode: "offline" };
  }
}

function openDashboard(base) {
  const url = `${base}/`;
  window.location.replace(url);
}

async function refreshStatus() {
  setStatus("status--pending", "Checking local service...");
  const base = await getBase();
  const status = await checkHealth(base);
  if (status.online && status.mode === "health") {
    openDashboard(base);
    return;
  }
  if (status.online && status.mode === "legacy") {
    openDashboard(base);
    return;
  }
  setStatus("status--offline", `Cannot reach ${base}. Start the local server, then retry.`);
  showUi();
}

openBtn.addEventListener("click", async () => {
  const base = await getBase();
  openDashboard(base);
});

retryBtn.addEventListener("click", () => {
  refreshStatus();
});

saveBtn.addEventListener("click", async () => {
  const base = normalizeBase(apiBaseInput.value);
  apiBaseInput.value = base;
  await storageSet({ [STORAGE_KEY]: base });
  refreshStatus();
});

refreshStatus();
