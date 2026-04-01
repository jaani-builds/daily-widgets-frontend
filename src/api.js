const API_BASES = {
  local: "http://localhost:8000",
  production: "https://daily-widgets-backend.onrender.com",
};

function resolveApiConfig() {
  const apiOverride = new URLSearchParams(window.location.search).get("api");
  if (apiOverride === "local") {
    return { base: API_BASES.local, mode: "local" };
  }
  if (apiOverride === "prod" || apiOverride === "production") {
    return { base: API_BASES.production, mode: "production" };
  }

  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  return isLocalHost
    ? { base: API_BASES.local, mode: "local" }
    : { base: API_BASES.production, mode: "production" };
}

export const API_CONFIG = resolveApiConfig();
const API_BASE = API_CONFIG.base;

function buildUrl(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim() !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

export async function getJson(path, params) {
  const response = await fetch(buildUrl(path, params));
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {
      // Non-JSON errors are surfaced via the HTTP status text.
    }
    throw new Error(`${response.status} ${detail}`);
  }
  return response.json();
}

export async function getJsonFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}
