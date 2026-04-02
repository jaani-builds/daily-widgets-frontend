function normalize(value) {
  return String(value || "").trim();
}

// Simple in-memory cache with 5-minute TTL
const newsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(location) {
  const city = normalize(location.city);
  const state = normalize(location.state);
  const country = normalize(location.country);
  return `${city}|${state}|${country}`;
}

function getFromCache(key) {
  const entry = newsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    newsCache.delete(key);
    return null;
  }
  return entry.data;
}

function setInCache(key, data) {
  newsCache.set(key, { data, timestamp: Date.now() });
}

export function createNewsWidget({ getJson, setStatus }) {
  const formEl = document.querySelector("#news-form");
  const cityInputEl = document.querySelector("#news-city");
  const stateInputEl = document.querySelector("#news-state");
  const countryInputEl = document.querySelector("#news-country");
  const contextEl = document.querySelector("#news-context");
  const listEl = document.querySelector("#news-list");

  function renderNews(items) {
    if (!listEl) {
      return;
    }

    if (!items.length) {
      listEl.innerHTML = '<li class="muted">No recent headlines available for this location right now.</li>';
      return;
    }

    listEl.innerHTML = items
      .map((item) => {
        const title = item.title || "Untitled";
        const url = item.url || "#";
        const source = item.source || "News";
        return `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a> <span class="muted mono">(${source})</span></li>`;
      })
      .join("");
  }

  function describeLocation(location) {
    const parts = [normalize(location.city), normalize(location.state), normalize(location.country)].filter(Boolean);
    return parts.join(", ") || "selected location";
  }

  /**
   * Load news using optimized fallback logic:
   * 1. Try with city + country (if both exist - most specific)
   * 2. If no city, try with state + country
   * 3. If no state, try with country only
   * 4. If no country, try with city/state alone as last resort
   */
  async function loadNews(location, { silent = false } = {}) {
    const city = normalize(location.city);
    const state = normalize(location.state);
    const country = normalize(location.country);

    // Build query with most specific combination available
    let payload = {};
    let displayName = "";

    // Priority: city+country (most specific) → state+country → country → state → city
    if (city && country) {
      payload = { city, country, limit: 10 };
      displayName = `${city}, ${country}`;
    } else if (state && country) {
      payload = { state, country, limit: 10 };
      displayName = `${state}, ${country}`;
    } else if (country) {
      payload = { country, limit: 10 };
      displayName = country;
    } else if (state) {
      payload = { state, limit: 10 };
      displayName = state;
    } else if (city) {
      payload = { city, limit: 10 };
      displayName = city;
    }

    if (!Object.keys(payload).length) {
      if (!silent) {
        setStatus("Provide at least one location field for news.");
      }
      renderNews([]);
      if (contextEl) {
        contextEl.textContent = "Location required";
      }
      return;
    }

    if (!silent) {
      setStatus(`Loading news for ${displayName}...`);
    }

    // Check cache first for instant response
    const cacheKey = getCacheKey(payload);
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      renderNews(cachedData.articles || []);
      if (contextEl) {
        contextEl.textContent = `Top ${cachedData.articles?.length || 0} headlines for ${displayName} (cached)`;
      }
      return;
    }

    try {
      // Add 8 second timeout for faster feedback on slow networks
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await getJson("/news", payload, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      // Cache the response
      setInCache(cacheKey, response);
      
      const articles = (response.articles || []).slice(0, 10);
      renderNews(articles);
      if (contextEl) {
        contextEl.textContent = `Top ${articles.length} headlines for ${displayName}`;
      }
      if (!silent) {
        setStatus("");
      }
    } catch (error) {
      renderNews([]);
      const errorMsg = error.name === "AbortError" ? `Timeout loading news for ${displayName}` : `Could not load headlines for ${displayName}`;
      if (contextEl) {
        contextEl.textContent = errorMsg;
      }
      if (!silent) {
        setStatus(`News error: ${error.message}`);
      }
    }
  }

  function setLocationFromWeather({ city, country }) {
    // Automatically load news for the weather location with fallback logic
    loadNews({ city, country }, { silent: true });
  }

  function getFormElement() {
    return formEl;
  }

  return {
    getFormElement,
    loadNews,
    setLocationFromWeather,
  };
}
