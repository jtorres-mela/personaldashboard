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
    if (!res.ok) return false;
    const body = await res.json();
    return body && body.ok === true;
  } catch {
    return false;
  }
}

async function refreshStatus() {
  setStatus("status--pending", "Checking local service...");
  const base = await getBase();
  const ok = await checkHealth(base);
  if (ok) {
    setStatus("status--online", `Online at ${base}`);
    return;
  }
  setStatus("status--offline", `Cannot reach ${base}. Start the local server, then retry.`);
}

openBtn.addEventListener("click", async () => {
  const base = await getBase();
  chrome.tabs.update({ url: `${base}/` });
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
