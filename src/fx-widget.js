import { formatDateLabel } from "./utils.js";

export function createFxWidget({ getJson, setStatus }) {
  const fxSummaryEl = document.querySelector("#fx-summary");
  const chartCanvas = document.querySelector("#fx-chart");
  const chartTooltipEl = document.querySelector("#fx-tooltip");

  const chartState = {
    points: [],
    labels: [],
    coordinates: [],
    hoveredIndex: null,
  };

  function resizeCanvas() {
    const bounds = chartCanvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    chartCanvas.width = Math.max(320, Math.floor(bounds.width * ratio));
    chartCanvas.height = Math.floor(300 * ratio);
  }

  function drawChart(items, labels) {
    const context = chartCanvas.getContext("2d");
    const width = chartCanvas.width;
    const height = chartCanvas.height;
    const pad = 42;

    context.clearRect(0, 0, width, height);
    if (!items.length) {
      context.fillStyle = "#5b6f68";
      context.font = `${12 * (window.devicePixelRatio || 1)}px IBM Plex Mono`;
      context.fillText("No chart data loaded.", pad, pad);
      return;
    }

    const rates = items.map((point) => point.rate);
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);
    const spread = maxRate - minRate || 1;

    context.strokeStyle = "rgba(24, 38, 31, 0.35)";
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(pad, pad);
    context.lineTo(pad, height - pad);
    context.lineTo(width - pad, height - pad);
    context.stroke();

    context.strokeStyle = "rgba(24, 38, 31, 0.14)";
    context.lineWidth = 1;
    for (let step = 0; step < 4; step += 1) {
      const y = pad + step * ((height - pad * 2) / 3);
      context.beginPath();
      context.moveTo(pad, y);
      context.lineTo(width - pad, y);
      context.stroke();
    }

    const coordinates = items.map((point, index) => {
      const x = pad + (index / Math.max(items.length - 1, 1)) * (width - pad * 2);
      const y = height - pad - ((point.rate - minRate) / spread) * (height - pad * 2);
      return { x, y };
    });
    chartState.coordinates = coordinates;

    context.beginPath();
    context.moveTo(coordinates[0].x, height - pad);
    coordinates.forEach(({ x, y }) => context.lineTo(x, y));
    context.lineTo(coordinates[coordinates.length - 1].x, height - pad);
    context.closePath();
    context.fillStyle = "rgba(0, 104, 71, 0.14)";
    context.fill();

    context.beginPath();
    coordinates.forEach(({ x, y }, index) => {
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.strokeStyle = "#006847";
    context.lineWidth = 3;
    context.stroke();

    coordinates.forEach(({ x, y }, index) => {
      const isHovered = chartState.hoveredIndex === index;
      context.beginPath();
      context.arc(x, y, isHovered ? 6 : 3.5, 0, Math.PI * 2);
      context.fillStyle = isHovered ? "#d96a2b" : "#006847";
      context.fill();
    });

    context.fillStyle = "#18261f";
    context.font = `${11 * (window.devicePixelRatio || 1)}px IBM Plex Mono`;

    const yTickCount = 6;
    for (let i = 0; i < yTickCount; i += 1) {
      const ratio = i / (yTickCount - 1);
      const y = pad + ratio * (height - pad * 2);
      const value = maxRate - ratio * spread;
      context.fillText(value.toFixed(4), 4, y + 3);
    }

    const xTickCount = Math.min(8, labels.length);
    const xStep = (labels.length - 1) / Math.max(1, xTickCount - 1);
    for (let i = 0; i < xTickCount; i += 1) {
      const index = Math.round(i * xStep);
      const point = coordinates[index];
      if (point) {
        context.fillText(labels[index], point.x - 18, height - 10);
      }
    }

    const highIndex = rates.indexOf(maxRate);
    const lowIndex = rates.indexOf(minRate);
    [highIndex, lowIndex].forEach((index) => {
      const point = coordinates[index];
      if (!point) {
        return;
      }
      context.beginPath();
      context.arc(point.x, point.y, 5, 0, Math.PI * 2);
      context.fillStyle = "#d96a2b";
      context.fill();
      context.fillStyle = "#18261f";
      context.fillText(rates[index].toFixed(4), point.x - 20, point.y - 10);
    });

    if (chartState.hoveredIndex !== null) {
      const hoverPoint = coordinates[chartState.hoveredIndex];
      const hoverRate = rates[chartState.hoveredIndex];
      context.fillStyle = "#18261f";
      context.fillText(hoverRate.toFixed(4), hoverPoint.x - 20, hoverPoint.y - 16);
    }
  }

  function updateChartHover(event) {
    if (!chartState.points.length) {
      return;
    }

    const bounds = chartCanvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const pointerX = (event.clientX - bounds.left) * ratio;
    const pointerY = (event.clientY - bounds.top) * ratio;

    let hoveredIndex = -1;
    let closestDistance = Number.POSITIVE_INFINITY;

    chartState.coordinates.forEach(({ x, y }, index) => {
      const distance = Math.hypot(x - pointerX, y - pointerY);
      if (distance < closestDistance) {
        closestDistance = distance;
        hoveredIndex = index;
      }
    });

    if (hoveredIndex === -1 || closestDistance > 24 * ratio) {
      chartState.hoveredIndex = null;
      chartTooltipEl.hidden = true;
      drawChart(chartState.points, chartState.labels);
      return;
    }

    chartState.hoveredIndex = hoveredIndex;
    drawChart(chartState.points, chartState.labels);

    const point = chartState.points[hoveredIndex];
    chartTooltipEl.hidden = false;
    chartTooltipEl.textContent = `${point.date}: ${Number(point.rate).toFixed(4)}`;
    chartTooltipEl.style.left = `${Math.min(bounds.width - 140, event.offsetX + 20)}px`;
    chartTooltipEl.style.top = `${Math.max(14, event.offsetY - 18)}px`;
  }

  function clearChartHover() {
    if (!chartState.points.length) {
      return;
    }
    chartState.hoveredIndex = null;
    chartTooltipEl.hidden = true;
    drawChart(chartState.points, chartState.labels);
  }

  function renderFx(payload) {
    const rates = payload.rates || [];
    const labels = rates.map((entry) => formatDateLabel(entry.date));

    chartState.points = rates;
    chartState.labels = labels;
    fxSummaryEl.textContent = "";
    chartState.hoveredIndex = null;
    chartTooltipEl.hidden = true;
    resizeCanvas();
    drawChart(rates, labels);
  }

  async function loadExchangeRates({ base, target, periodValue, periodUnit }) {
    setStatus(`Loading ${base}/${target} rates...`);

    const latest = await getJson("/exchange-rates", { base, target });
    const history = await getJson("/exchange-rates", {
      base,
      target,
      period_value: periodValue,
      period_unit: periodUnit,
    });

    renderFx({
      base: latest.base || base,
      target: latest.target || target,
      latestRate: latest.rate,
      period: history.period,
      date: latest.date,
      rates: history.rates,
    });

    setStatus("");
  }

  function handleResize() {
    if (chartState.points.length) {
      resizeCanvas();
      drawChart(chartState.points, chartState.labels);
    }
  }

  function wireChartEvents() {
    chartCanvas.addEventListener("mousemove", updateChartHover);
    chartCanvas.addEventListener("mouseleave", clearChartHover);
  }

  return {
    loadExchangeRates,
    handleResize,
    wireChartEvents,
  };
}
