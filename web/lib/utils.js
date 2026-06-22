export function fmtBytes(n) {
  if (!n || isNaN(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = Number(n);
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

export function truncate(str, len) {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

export function fmtDate(dateStr) {
  return new Date(dateStr || Date.now()).toLocaleString("en-GB", {
    timeZone: "UTC",
    dateStyle: "short",
    timeStyle: "short",
  });
}
