const DEFAULT_BASE = "http://127.0.0.1:3000";
const STORAGE_KEY = "dashboardApiBase";
const EXPECTED_APP_NAME = "PersonalDashboard";
const AUTO_PORTS = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];
const AUTO_HOSTS = ["127.0.0.1", "localhost"];

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

function unique(values) {
  return [...new Set(values)];
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

async function fetchWithTimeout(url, options = {}, timeoutMs = 900) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isLegacyDashboardHtml(html) {
  return (
    html.includes("<title>My Dashboard</title>") &&
    html.includes('id="appContent"') &&
    html.includes('data-app="tasks"')
  );
}

async function checkHealth(base) {
  try {
    const versionRes = await fetchWithTimeout(`${base}/api/version`);
    if (versionRes.ok) {
      const versionBody = await versionRes.json();
      if (versionBody && versionBody.name === EXPECTED_APP_NAME) {
        return { online: true, mode: "version" };
      }
      return { online: false, mode: "wrong-service" };
    }
    if (versionRes.status === 404) {
      const rootRes = await fetchWithTimeout(`${base}/`);
      if (rootRes.ok) {
        const html = await rootRes.text();
        if (isLegacyDashboardHtml(html)) return { online: true, mode: "legacy-signature" };
        return { online: false, mode: "wrong-service" };
      }
      return { online: false, mode: "offline" };
    }
    return { online: false, mode: "offline" };
  } catch {
    return { online: false, mode: "offline" };
  }
}

function buildProbeBases(primaryBase) {
  const candidates = [primaryBase, DEFAULT_BASE];
  AUTO_HOSTS.forEach((host) => {
    AUTO_PORTS.forEach((port) => {
      candidates.push(`http://${host}:${port}`);
    });
  });
  return unique(candidates.map((base) => normalizeBase(base)));
}

async function findReachableBase(primaryBase) {
  const candidates = buildProbeBases(primaryBase);
  const firstBase = candidates[0];
  const firstStatus = await checkHealth(firstBase);
  if (firstStatus.online) {
    return { base: firstBase, status: firstStatus };
  }

  const restResults = await Promise.all(
    candidates.slice(1).map(async (base) => ({ base, status: await checkHealth(base) }))
  );
  const found = restResults.find((result) => result.status.online);
  if (found) return found;

  return { base: firstBase, status: firstStatus };
}

function openDashboard(base) {
  const url = `${base}/`;
  window.location.replace(url);
}

async function refreshStatus() {
  setStatus("status--pending", "Checking local service...");
  const preferredBase = await getBase();
  const { base, status } = await findReachableBase(preferredBase);

  if (status.online) {
    if (base !== preferredBase) {
      apiBaseInput.value = base;
      await storageSet({ [STORAGE_KEY]: base });
    }
    openDashboard(base);
    return;
  }

  setStatus("status--offline", `Cannot reach ${preferredBase}. Start the local server, then retry.`);
  if (status.mode === "wrong-service") {
    setStatus("status--offline", `Found a service at ${preferredBase}, but it is not Personal Dashboard.`);
  }
  showUi();
}

openBtn.addEventListener("click", async () => {
  const base = normalizeBase(apiBaseInput.value || (await getBase()));
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
