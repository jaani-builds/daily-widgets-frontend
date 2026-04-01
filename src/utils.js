export function setButtonBusy(button, busy, label) {
  if (!button) {
    return;
  }
  if (!button.dataset.label) {
    button.dataset.label = button.textContent;
  }
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.label;
}

export function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

export function formatDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatLocalTime(value) {
  if (!value) {
    return "-";
  }

  const localMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (localMatch) {
    const [, year, month, day, hour, minute] = localMatch;
    const localDate = new Date(Number(year), Number(month) - 1, Number(day));
    const dayLabel = localDate.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return `${dayLabel}, ${hour}:${minute}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  const fallback = new Date(`${value}:00`);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toLocaleString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return value;
}

export function normalizeCityInput(value) {
  return value.trim().replace(/\s+/g, " ");
}

export function formatNowInTimeZone(timeZone) {
  try {
    const now = new Date();
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
  } catch {
    return null;
  }
}
