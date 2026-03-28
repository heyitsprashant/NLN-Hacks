export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  const diff = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const ranges: Array<{ unit: Intl.RelativeTimeFormatUnit; amount: number }> = [
    { unit: "year", amount: 1000 * 60 * 60 * 24 * 365 },
    { unit: "month", amount: 1000 * 60 * 60 * 24 * 30 },
    { unit: "week", amount: 1000 * 60 * 60 * 24 * 7 },
    { unit: "day", amount: 1000 * 60 * 60 * 24 },
    { unit: "hour", amount: 1000 * 60 * 60 },
    { unit: "minute", amount: 1000 * 60 },
  ];

  for (const range of ranges) {
    const value = diff / range.amount;
    if (Math.abs(value) >= 1) {
      return rtf.format(Math.round(value), range.unit);
    }
  }

  return "just now";
}

export function formatReadableDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
