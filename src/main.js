import { API_CONFIG, getJson, getJsonFromUrl } from "./api.js";
import { createFxWidget } from "./fx-widget.js";
import { setButtonBusy } from "./utils.js";
import { createWeatherWidget } from "./weather-widget.js";

const statusEl = document.querySelector("#status");
const apiModeBadgeEl = document.querySelector("#api-mode-badge");

const DEFAULT_FX = {
  base: "SGD",
  target: "INR",
  periodValue: "1",
  periodUnit: "months",
};

function setStatus(message = "") {
  statusEl.textContent = message;
}

function renderApiModeBadge() {
  if (!apiModeBadgeEl) {
    return;
  }
  apiModeBadgeEl.classList.remove("local", "production");
  apiModeBadgeEl.classList.add(API_CONFIG.mode);
  apiModeBadgeEl.textContent = API_CONFIG.mode === "local" ? "Mode: Local" : "Mode: Production";
}

const fxWidget = createFxWidget({ getJson, setStatus });
const weatherWidget = createWeatherWidget({ getJson, getJsonFromUrl, setStatus });

function wireEvents() {
  const refreshButton = document.querySelector("#refresh-time");
  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      try {
        setButtonBusy(refreshButton, true, "Loading...");
        const city = weatherWidget.getSelectedCity();
        if (city) {
          await weatherWidget.loadWeather(city);
        }
      } catch (error) {
        setStatus(`Time error: ${error.message}`);
      } finally {
        setButtonBusy(refreshButton, false, "Loading...");
      }
    });
  }

  document.querySelector("#weather-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.querySelector("#weather-submit");
    const city = String(new FormData(event.currentTarget).get("city") || "");
    if (!city.trim()) {
      setStatus("Enter a city name first.");
      return;
    }

    try {
      setButtonBusy(button, true, "Loading...");
      await weatherWidget.loadWeather(city);
    } catch (error) {
      setStatus(`Weather error: ${error.message}`);
    } finally {
      setButtonBusy(button, false, "Loading...");
    }
  });

  document.querySelector("#fx-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.querySelector("#fx-submit");
    const form = new FormData(event.currentTarget);
    const payload = {
      base: String(form.get("base") || "").toUpperCase(),
      target: String(form.get("target") || "").toUpperCase(),
      periodValue: String(form.get("periodValue") || "30"),
      periodUnit: String(form.get("periodUnit") || "months"),
    };

    try {
      setButtonBusy(button, true, "Loading...");
      await fxWidget.loadExchangeRates(payload);
    } catch (error) {
      setStatus(`FX error: ${error.message}`);
    } finally {
      setButtonBusy(button, false, "Loading...");
    }
  });

  window.addEventListener("resize", () => {
    fxWidget.handleResize();
    weatherWidget.handleResize();
  });

  fxWidget.wireChartEvents();
}

async function init() {
  renderApiModeBadge();
  wireEvents();

  await weatherWidget.init();

  try {
    await fxWidget.loadExchangeRates(DEFAULT_FX);
  } catch {
    // Keep app usable even if default FX fetch fails.
  }
}

init();