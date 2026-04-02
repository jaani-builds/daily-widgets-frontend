import { formatDateLabel, formatLocalTime, formatNowInTimeZone, formatNumber, normalizeCityInput } from "./utils.js";

const DEFAULT_CITY = "London";

export function createWeatherWidget({ getJson, getJsonFromUrl, setStatus, onLocationResolved }) {
  const weatherResultEl = document.querySelector("#weather-result");
  const trendStates = {
    localUsd: { canvas: null, valueEl: null, directionEl: null, forecastEl: null, tooltipEl: null, points: [], coordinates: [], hoveredIndex: null },
    localEur: { canvas: null, valueEl: null, directionEl: null, forecastEl: null, tooltipEl: null, points: [], coordinates: [], hoveredIndex: null },
  };

  let selectedCity = "";
  let locationClockTimer = null;

  async function loadLocationProfile(payload) {
    try {
      return await getJson("/location-profile", { city: payload.city, country: payload.country });
    } catch {
      return { currency_code: "USD" };
    }
  }

  function bindWeatherTrendElements() {
    trendStates.localUsd.valueEl = document.querySelector("#trend-local-usd-value");
    trendStates.localUsd.directionEl = document.querySelector("#trend-local-usd-direction");
    trendStates.localUsd.forecastEl = document.querySelector("#trend-local-usd-forecast");
    trendStates.localUsd.canvas = document.querySelector("#trend-local-usd-chart");
    trendStates.localUsd.tooltipEl = document.querySelector("#trend-local-usd-tooltip");

    trendStates.localEur.valueEl = document.querySelector("#trend-local-eur-value");
    trendStates.localEur.directionEl = document.querySelector("#trend-local-eur-direction");
    trendStates.localEur.forecastEl = document.querySelector("#trend-local-eur-forecast");
    trendStates.localEur.canvas = document.querySelector("#trend-local-eur-chart");
    trendStates.localEur.tooltipEl = document.querySelector("#trend-local-eur-tooltip");
  }

  async function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      });
    });
  }

  async function resolveCityFromCoordinates(latitude, longitude) {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
    url.searchParams.set("latitude", `${latitude}`);
    url.searchParams.set("longitude", `${longitude}`);
    url.searchParams.set("count", "1");

    const payload = await getJsonFromUrl(url.toString());
    const location = payload.results?.[0];
    if (!location?.name) {
      throw new Error("Could not resolve your current city.");
    }
    return location.name;
  }

  function resolveCityFromBrowserTimeZone() {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone || timeZone.toUpperCase().includes("UTC") || timeZone.startsWith("Etc/")) {
      return null;
    }
    const parts = timeZone.split("/");
    const cityPart = parts[parts.length - 1];
    return cityPart ? cityPart.replace(/_/g, " ") : null;
  }

  async function resolveWeatherCityQuery(input) {
    const normalizedInput = normalizeCityInput(input);
    if (!normalizedInput) {
      return null;
    }

    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", normalizedInput);
    url.searchParams.set("count", "8");

    const payload = await getJsonFromUrl(url.toString());
    const results = payload.results || [];
    const cityLike = results.find((item) => String(item.feature_code || "").startsWith("PPL"));
    return cityLike?.name || results[0]?.name || null;
  }

  function setSelectedLocationTime(localTime, timezoneLabel, cityLabel) {
    const weatherTimeValueEl = document.querySelector("#weather-time-value");
    const weatherTimeMetaEl = document.querySelector("#weather-time-meta");
    if (weatherTimeValueEl) {
      weatherTimeValueEl.textContent = localTime;
    }
    if (weatherTimeMetaEl) {
      weatherTimeMetaEl.textContent = `${cityLabel} (${timezoneLabel})`;
    }
  }

  function clearLocationClock() {
    if (locationClockTimer) {
      clearInterval(locationClockTimer);
      locationClockTimer = null;
    }
  }

  function startLocationClock(timeZone, timezoneLabel, cityLabel, fallbackLocalTime) {
    clearLocationClock();
    const updateClock = () => {
      const liveValue = formatNowInTimeZone(timeZone);
      setSelectedLocationTime(liveValue || fallbackLocalTime, timezoneLabel, cityLabel);
    };
    updateClock();
    locationClockTimer = setInterval(updateClock, 1000);
  }

  function computeTrendForecast(rates) {
    if (!rates.length) {
      return { latest: null, trend: "-", forecastDays: [] };
    }
    const first = rates[0].rate;
    const last = rates[rates.length - 1].rate;
    const slope = rates.length > 1 ? (last - first) / (rates.length - 1) : 0;
    let trend = "Flat";
    if (slope > 0.0001) {
      trend = "Upward";
    } else if (slope < -0.0001) {
      trend = "Downward";
    }
    return {
      latest: last,
      trend,
      forecastDays: [1, 2, 3, 4].map((day) => last + slope * day),
    };
  }

  function drawMiniTrend(state) {
    const { canvas, points, hoveredIndex, tooltipEl } = state;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    const bounds = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(240, Math.floor(bounds.width * ratio));
    canvas.height = Math.floor(170 * ratio);

    const width = canvas.width;
    const height = canvas.height;
    const pad = 22 * ratio;

    context.clearRect(0, 0, width, height);
    if (!points.length) {
      tooltipEl.hidden = true;
      return;
    }

    const values = points.map((item) => item.rate);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 1;

    const coordinates = points.map((item, index) => {
      const x = pad + (index / Math.max(points.length - 1, 1)) * (width - pad * 2);
      const y = height - pad - ((item.rate - min) / spread) * (height - pad * 2);
      return { x, y };
    });
    state.coordinates = coordinates;

    context.strokeStyle = "rgba(24, 38, 31, 0.14)";
    context.lineWidth = 1;
    for (let i = 0; i < 4; i += 1) {
      const y = pad + (i / 3) * (height - pad * 2);
      context.beginPath();
      context.moveTo(pad, y);
      context.lineTo(width - pad, y);
      context.stroke();
    }

    context.beginPath();
    coordinates.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.strokeStyle = "#006847";
    context.lineWidth = 2 * ratio;
    context.stroke();

    if (hoveredIndex !== null && coordinates[hoveredIndex]) {
      const point = coordinates[hoveredIndex];
      context.beginPath();
      context.arc(point.x, point.y, 4.5 * ratio, 0, Math.PI * 2);
      context.fillStyle = "#d96a2b";
      context.fill();

      tooltipEl.hidden = false;
      tooltipEl.textContent = `${points[hoveredIndex].date}: ${points[hoveredIndex].rate.toFixed(4)}`;
    } else {
      tooltipEl.hidden = true;
    }
  }

  function attachTrendHover(state) {
    if (!state.canvas || state.canvas.dataset.hoverBound === "true") {
      return;
    }
    state.canvas.dataset.hoverBound = "true";

    state.canvas.addEventListener("mousemove", (event) => {
      if (!state.points.length || !state.coordinates.length) {
        return;
      }

      const rect = state.canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const x = (event.clientX - rect.left) * ratio;
      const y = (event.clientY - rect.top) * ratio;

      let hoveredIndex = null;
      let minDistance = Number.POSITIVE_INFINITY;
      state.coordinates.forEach((point, idx) => {
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < minDistance) {
          minDistance = distance;
          hoveredIndex = idx;
        }
      });

      if (hoveredIndex === null || minDistance > 24 * ratio) {
        state.hoveredIndex = null;
        state.tooltipEl.hidden = true;
        drawMiniTrend(state);
        return;
      }

      state.hoveredIndex = hoveredIndex;
      state.tooltipEl.style.left = `${Math.min(rect.width - 150, event.offsetX + 12)}px`;
      state.tooltipEl.style.top = `${Math.max(8, event.offsetY - 18)}px`;
      drawMiniTrend(state);
    });

    state.canvas.addEventListener("mouseleave", () => {
      state.hoveredIndex = null;
      state.tooltipEl.hidden = true;
      drawMiniTrend(state);
    });
  }

  async function loadSplitTrends(baseCurrency) {
    const [localUsd, localEur] = await Promise.all([
      getJson("/exchange-rates", { base: baseCurrency, target: "USD", period_value: "1", period_unit: "months" }),
      getJson("/exchange-rates", { base: baseCurrency, target: "EUR", period_value: "1", period_unit: "months" }),
    ]);

    trendStates.localUsd.points = localUsd.rates || [];
    trendStates.localUsd.hoveredIndex = null;
    trendStates.localEur.points = localEur.rates || [];
    trendStates.localEur.hoveredIndex = null;

    const usdInfo = computeTrendForecast(trendStates.localUsd.points);
    const eurInfo = computeTrendForecast(trendStates.localEur.points);

    trendStates.localUsd.valueEl.textContent = usdInfo.latest !== null ? usdInfo.latest.toFixed(4) : "-";
    trendStates.localEur.valueEl.textContent = eurInfo.latest !== null ? eurInfo.latest.toFixed(4) : "-";
    trendStates.localUsd.directionEl.textContent = `Trend: ${usdInfo.trend}`;
    trendStates.localEur.directionEl.textContent = `Trend: ${eurInfo.trend}`;
    trendStates.localUsd.forecastEl.textContent = usdInfo.forecastDays.length
      ? `Forecast (1-4d): ${usdInfo.forecastDays.map((value, idx) => `D${idx + 1} ${value.toFixed(4)}`).join(" | ")}`
      : "Forecast (1-4d): -";
    trendStates.localEur.forecastEl.textContent = eurInfo.forecastDays.length
      ? `Forecast (1-4d): ${eurInfo.forecastDays.map((value, idx) => `D${idx + 1} ${value.toFixed(4)}`).join(" | ")}`
      : "Forecast (1-4d): -";

    drawMiniTrend(trendStates.localUsd);
    drawMiniTrend(trendStates.localEur);
  }

  function renderWeather(payload, profile) {
    const localTime = formatLocalTime(payload.local_time || payload.time);
    const timezoneLabel = payload.timezone_abbreviation || payload.timezone || "Local time";
    const timezoneValue = payload.timezone;
    const cityLabel = payload.country ? `${payload.city}, ${payload.country}` : payload.city;
    const localCurrency = profile?.currency_code || "USD";
    const trendCurrency = profile?.trend_currency_code || localCurrency;
    const trendUsesFallback = profile?.currency_supported_for_trends === false;
    const trendBadgeClass = trendUsesFallback ? "trend-badge fallback" : "trend-badge supported";
    const trendBadgeLabel = trendUsesFallback ? `Fallback: ${trendCurrency}` : "Supported";
    const trendSupportNote = profile?.currency_supported_for_trends === false
      ? `<p class="weather-card-subvalue muted">${localCurrency} is not supported by the trend provider, using ${trendCurrency} for charts.</p>`
      : "";

    weatherResultEl.classList.remove("empty");
    weatherResultEl.innerHTML = `
      <div class="weather-main">
        <div class="weather-grid">
          <article class="weather-card"><div class="weather-card-body"><p class="label">Time</p><p id="weather-time-value" class="value">${localTime}</p><p id="weather-time-meta" class="weather-card-subvalue">${timezoneLabel}</p></div></article>
          <article class="weather-card"><div class="weather-card-body"><p class="label">Location</p><p class="value">${cityLabel}</p><p class="weather-card-subvalue">Country profile</p></div></article>
          <article class="weather-card"><div class="weather-card-body"><p class="label">Temperature</p><p class="value">${formatNumber(payload.temperature_c, 1)} C</p><p class="weather-card-subvalue">Current outside temp</p></div></article>
          <article class="weather-card"><div class="weather-card-body"><p class="label">Wind</p><p class="value">${formatNumber(payload.windspeed_kmh, 1)} km/h</p><p class="weather-card-subvalue">Current wind speed</p></div></article>
        </div>
        <div class="weather-trend-split">
          <article class="trend-card"><h3><span>${trendCurrency} to USD (Last 1 Month)</span><span class="${trendBadgeClass}">${trendBadgeLabel}</span></h3><p id="trend-local-usd-value" class="trend-value mono">-</p><p id="trend-local-usd-direction" class="muted mono">Trend: -</p><p id="trend-local-usd-forecast" class="muted mono">Forecast (1-4d): -</p>${trendSupportNote}<canvas id="trend-local-usd-chart" aria-label="Local currency to USD one month trend"></canvas><div id="trend-local-usd-tooltip" class="chart-tooltip trend-tooltip" hidden></div></article>
          <article class="trend-card"><h3><span>${trendCurrency} to EUR (Last 1 Month)</span><span class="${trendBadgeClass}">${trendBadgeLabel}</span></h3><p id="trend-local-eur-value" class="trend-value mono">-</p><p id="trend-local-eur-direction" class="muted mono">Trend: -</p><p id="trend-local-eur-forecast" class="muted mono">Forecast (1-4d): -</p>${trendSupportNote}<canvas id="trend-local-eur-chart" aria-label="Local currency to EUR one month trend"></canvas><div id="trend-local-eur-tooltip" class="chart-tooltip trend-tooltip" hidden></div></article>
        </div>
      </div>
    `;

    bindWeatherTrendElements();
    attachTrendHover(trendStates.localUsd);
    attachTrendHover(trendStates.localEur);
    loadSplitTrends(trendCurrency);
    if (typeof onLocationResolved === "function") {
      Promise.resolve(onLocationResolved({ city: payload.city, country: payload.country })).catch(() => {
        // Keep weather rendering resilient if downstream news loading fails.
      });
    }
    startLocationClock(timezoneValue, timezoneLabel, cityLabel, localTime);
  }

  function renderWeatherError(city, message) {
    weatherResultEl.classList.remove("empty");
    weatherResultEl.innerHTML = `
      <div class="weather-main">
        <div class="weather-headline"><p class="weather-city">No matching location</p></div>
        <p class="weather-meta">${city ? `Could not find a weather result for "${city}".` : "Enter a real city name."}</p>
        <p class="weather-meta">${message}</p>
      </div>
    `;
    clearLocationClock();
  }

  async function loadWeather(city) {
    const normalizedCity = normalizeCityInput(city);
    setStatus(`Loading weather for ${normalizedCity}...`);

    try {
      const payload = await getJson("/weather", { city: normalizedCity });
      const profile = await loadLocationProfile(payload);
      renderWeather(payload, profile);
      selectedCity = payload.city || normalizedCity;
      setStatus("");
      return selectedCity;
    } catch (error) {
      try {
        const resolvedCity = await resolveWeatherCityQuery(normalizedCity);
        if (resolvedCity && resolvedCity.toLowerCase() !== normalizedCity.toLowerCase()) {
          const payload = await getJson("/weather", { city: resolvedCity });
          const profile = await loadLocationProfile(payload);
          renderWeather(payload, profile);
          document.querySelector("#weather-city").value = payload.city || resolvedCity;
          selectedCity = payload.city || resolvedCity;
          setStatus(`Showing weather for ${selectedCity} (matched from ${normalizedCity}).`);
          return selectedCity;
        }
      } catch {
        // Fall through to show original error.
      }

      renderWeatherError(normalizedCity, error.message);
      throw error;
    }
  }

  async function loadWeatherForCurrentLocation() {
    setStatus("Detecting your current location...");
    const position = await getCurrentPosition();
    const city = await resolveCityFromCoordinates(position.coords.latitude, position.coords.longitude);
    document.querySelector("#weather-city").value = city;
    selectedCity = city;
    await loadWeather(city);
  }

  async function init() {
    try {
      await loadWeatherForCurrentLocation();
      return;
    } catch {
      // Fall through to timezone/default fallback.
    }

    const tzCity = resolveCityFromBrowserTimeZone();
    if (tzCity) {
      selectedCity = tzCity;
      document.querySelector("#weather-city").value = tzCity;
      try {
        await loadWeather(tzCity);
        return;
      } catch {
        // Continue to hard fallback.
      }
    }

    setStatus("Using default city because current location could not be detected.");
    selectedCity = DEFAULT_CITY;
    document.querySelector("#weather-city").value = DEFAULT_CITY;
    try {
      await loadWeather(DEFAULT_CITY);
    } catch {
      // Keep app usable even if default city fetch fails.
    }
  }

  function handleResize() {
    drawMiniTrend(trendStates.localUsd);
    drawMiniTrend(trendStates.localEur);
  }

  return {
    init,
    loadWeather,
    handleResize,
    getSelectedCity: () => selectedCity,
  };
}
